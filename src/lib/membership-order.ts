// Pending-order and Sepolia flows of the web checkout modals and the eth/return pages, with the
// storage, API and wallet passed in so they can be tested without a device.
import {
  formatExactVnd,
  getMembershipErrorMessage,
  isMembershipPendingOrderError,
  isOrderCancelledStatus,
  isOrderFailedStatus,
  isOrderPaidStatus,
  isOrderPendingStatus,
  isOrderReviewStatus,
  MOBILE_ETH_DISABLED_MESSAGE,
  MOBILE_ETH_PAYMENT_ENABLED,
} from '@/lib/membership';
import { buildSepayCheckout, isMembershipOrderId } from '@/lib/membership-checkout';
import {
  assertPayableEthOrder,
  buildMembershipEthTransaction,
  isTransactionHash,
  isWalletSignature,
  readEthSubmission,
  type EthSubmission,
} from '@/lib/membership-eth-payment';
import type {
  MembershipCheckout,
  MembershipEthQuote,
  MembershipOrder,
  MembershipPaymentMethod,
} from '@/services/membershipApi';

export type OrderStore = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

/**
 * What survives a restart, per account: the id of the last unfinished order, and per order the
 * Sepolia submission. The key format is the one earlier app versions wrote.
 */
export function createOrderMemory(store: OrderStore, accountKey: string) {
  const proofKey = (orderId: string) => `${accountKey}.${orderId}`;
  const reviewKey = `${accountKey}.review`;
  const storedId = async (key: string) => {
    const id = await store.get(key);
    return isMembershipOrderId(id) ? id : null;
  };
  const removeIf = async (key: string, orderId: string) => {
    if ((await store.get(key)) === orderId) await store.remove(key);
  };
  return {
    pending: () => storedId(accountKey),
    remember: (orderId: string) => store.set(accountKey, orderId),
    forget: (orderId: string) => removeIf(accountKey, orderId),
    /** The last REVIEW order, kept apart: it blocks no checkout and a new order keeps it. */
    review: () => storedId(reviewKey),
    keepForReview: (orderId: string) => store.set(reviewKey, orderId),
    clearReview: (orderId: string) => removeIf(reviewKey, orderId),
    proof: async (orderId: string) => readEthSubmission(await store.get(proofKey(orderId))),
    saveProof: (orderId: string, proof: EthSubmission) =>
      store.set(proofKey(orderId), JSON.stringify(proof)),
    clearProof: (orderId: string) => store.remove(proofKey(orderId)),
  };
}

export type OrderMemory = ReturnType<typeof createOrderMemory>;

/**
 * Applies a server order status to the stored state and returns the Sepolia submission still open.
 * A transaction hash is dropped only once the order is PAID; a REVIEW order keeps it too.
 */
export async function syncOrderMemory(
  memory: OrderMemory,
  order: Pick<MembershipOrder, 'id' | 'status' | 'provider'>
): Promise<EthSubmission | null> {
  if (isOrderPaidStatus(order.status)) {
    await memory.clearProof(order.id);
    await memory.clearReview(order.id);
    await memory.forget(order.id);
    return null;
  }
  let proof = order.provider === 'ETH' ? await memory.proof(order.id) : null;
  if (isOrderPendingStatus(order.status)) return proof;
  // The web drops a REVIEW order, but a phone has no history to find it again.
  if (isOrderReviewStatus(order.status)) await memory.keepForReview(order.id);
  else await memory.clearReview(order.id);
  // The server cancels or expires a Sepolia order only after the chain shows it unpaid.
  if (proof && !proof.txHash && isOrderFailedStatus(order.status)) {
    await memory.clearProof(order.id);
    proof = null;
  }
  // A failed order that still has a hash stays reachable so it can be reconciled.
  if (!(proof?.txHash && isOrderFailedStatus(order.status))) await memory.forget(order.id);
  return proof;
}

/**
 * One order read at a time, shared by polling, the recheck button and the foreground refresh.
 * A finished order never goes back to waiting, whatever order the answers arrive in.
 */
export function createOrderFeed(read: () => Promise<MembershipOrder>) {
  let flight: Promise<MembershipOrder> | null = null;
  let shown: string | null = null;
  function join() {
    if (flight) return flight;
    const started: Promise<MembershipOrder> = read().finally(() => {
      if (flight === started) flight = null;
    });
    flight = started;
    return started;
  }
  return {
    read: join,
    /** A read that starts after this call: the one in flight is waited out first. */
    async readFresh() {
      await flight?.catch(() => undefined);
      return join();
    },
    /** A cancel or settle has answered: a read started before it is not joined any more. */
    drop() {
      flight = null;
    },
    /** False for an answer that must not replace what is shown. */
    accept(next: Pick<MembershipOrder, 'status'>) {
      if (shown && !isOrderPendingStatus(shown) && isOrderPendingStatus(next.status)) return false;
      shown = next.status;
      return true;
    },
    status: () => shown,
  };
}

export type PlaceOrderResult =
  | { kind: 'ok'; orderId: string; hosted: ReturnType<typeof buildSepayCheckout> | null }
  | {
      kind: 'price-changed' | 'error';
      message: string;
      /** An order that still blocks a new checkout. */
      pendingOrderId: string | null;
    };

// No API lists the pending order, so only the place that created it can open it.
export const PENDING_ORDER_UNKNOWN_MESSAGE =
  'Bạn đang có một đơn thanh toán hội viên chờ xử lý nhưng thiết bị này không có mã đơn để mở. Nếu đơn được tạo trên web, hãy hoàn tất hoặc hủy tại đúng trình duyệt đã tạo đơn. Nếu không mở lại được, hãy đợi đơn hết hạn (15 phút kể từ lúc tạo) rồi tạo đơn mới.';

/** Web handleConfirmCheckout / MembershipAddonModal.handleCheckout. */
export async function placeMembershipOrder({
  create,
  cancel,
  memory,
  provider,
  expectedAmount,
}: {
  create: () => Promise<MembershipCheckout>;
  cancel: (orderId: string) => Promise<Pick<MembershipOrder, 'status'>>;
  memory: OrderMemory;
  provider: MembershipPaymentMethod;
  expectedAmount: number;
}): Promise<PlaceOrderResult> {
  if (provider === 'ETH' && !MOBILE_ETH_PAYMENT_ENABLED)
    return { kind: 'error', message: MOBILE_ETH_DISABLED_MESSAGE, pendingOrderId: null };
  let checkout: MembershipCheckout;
  try {
    checkout = await create();
  } catch (error) {
    const blocked = isMembershipPendingOrderError(error);
    const pendingOrderId = blocked ? await memory.pending().catch(() => null) : null;
    return {
      kind: 'error',
      message:
        blocked && !pendingOrderId
          ? PENDING_ORDER_UNKNOWN_MESSAGE
          : getMembershipErrorMessage(
              error,
              'Không thể khởi tạo giao dịch thanh toán. Vui lòng thử lại.'
            ),
      pendingOrderId,
    };
  }
  const orderId = isMembershipOrderId(checkout?.orderId) ? checkout.orderId : null;

  /** Cancels the order that cannot be paid; true when the server confirms CANCELLED. */
  async function discard() {
    if (!orderId) return false;
    try {
      if (!isOrderCancelledStatus((await cancel(orderId)).status)) return false;
    } catch {
      return false;
    }
    await memory.forget(orderId).catch(() => undefined);
    return true;
  }

  try {
    if (!orderId) throw new Error('Máy chủ không trả về mã đơn hàng thanh toán (orderId) hợp lệ.');
    // Stored before anything else can fail or the app can be closed.
    await memory.remember(orderId);
    const amount = checkout.amountVnd;
    if (Number.isFinite(amount) && amount > 0 && amount !== expectedAmount) {
      const changed = formatExactVnd(amount);
      const cancelled = await discard();
      return {
        kind: 'price-changed',
        message: cancelled
          ? `Số tiền thanh toán từ máy chủ đã cập nhật thành ${changed}. Đơn tạm đã được hủy, vui lòng kiểm tra lại và xác nhận.`
          : `Số tiền thanh toán từ máy chủ đã thay đổi thành ${changed}, nhưng chưa thể tự động hủy đơn tạm #${orderId}. Vui lòng kiểm tra trạng thái đơn hàng trước khi thử lại.`,
        pendingOrderId: cancelled ? null : orderId,
      };
    }
    if (checkout.provider !== provider)
      throw new Error(
        `Máy chủ trả về cổng thanh toán không hợp lệ (${checkout.provider ?? 'UNKNOWN'}). Vui lòng thử lại.`
      );
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new Error('Số tiền đơn hàng từ máy chủ không hợp lệ.');
    return {
      kind: 'ok',
      orderId,
      hosted: provider === 'SEPAY' ? buildSepayCheckout(checkout, expectedAmount) : null,
    };
  } catch (error) {
    const cancelled = await discard();
    return {
      kind: 'error',
      message: getMembershipErrorMessage(error),
      pendingOrderId: cancelled ? null : orderId,
    };
  }
}

type Wallet = {
  provider: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> };
  account: string;
};

function requireMobileEth() {
  if (!MOBILE_ETH_PAYMENT_ENABLED) throw new Error(MOBILE_ETH_DISABLED_MESSAGE);
}

/** Connect, prove wallet ownership for this order, and get the signed amount. */
export async function quoteMembershipEth(
  orderId: string,
  amountVnd: number,
  deps: {
    getWallet: (connect: boolean) => Promise<Wallet>;
    encodeMessage: (message: string) => string;
    getChallenge: (
      orderId: string,
      wallet: string
    ) => Promise<{ challengeId: string; message: string }>;
    getQuote: (
      orderId: string,
      challengeId: string,
      signature: string
    ) => Promise<MembershipEthQuote>;
  }
) {
  requireMobileEth();
  const { provider, account } = await deps.getWallet(true);
  const challenge = await deps.getChallenge(orderId, account);
  if (
    !challenge?.challengeId ||
    typeof challenge.message !== 'string' ||
    !challenge.message.startsWith(
      `HomeSpace Sepolia membership wallet ownership\nOrder: ${orderId}\n`
    ) ||
    !challenge.message.includes(`\nWallet: ${account}\n`)
  )
    throw new Error('Thông điệp xác thực ví không khớp đơn hội viên hiện tại.');
  const signature = await provider.request({
    method: 'personal_sign',
    params: [deps.encodeMessage(challenge.message), account],
  });
  if (!isWalletSignature(signature)) throw new Error('MetaMask chưa trả về chữ ký hợp lệ.');
  const quote = await deps.getQuote(orderId, challenge.challengeId, signature);
  buildMembershipEthTransaction(quote, account, amountVnd);
  return quote;
}

// Held across screen re-opens while MetaMask has not answered.
const sending = new Set<string>();

/**
 * Sends the payment at most once per order: a draft is stored before MetaMask opens, and only an
 * explicit rejection removes it. `onSubmission` reports every change, the hash before it is stored.
 */
export async function sendMembershipEth(
  orderId: string,
  quote: MembershipEthQuote,
  deps: {
    memory: OrderMemory;
    getOrder: (orderId: string) => Promise<MembershipOrder>;
    getWallet: (connect: boolean) => Promise<Wallet>;
    onSubmission: (submission: EthSubmission | null) => void;
  }
): Promise<EthSubmission & { txHash: string }> {
  requireMobileEth();
  const { memory } = deps;
  const used = 'Đơn này đã có giao dịch ETH đang xử lý. Không gửi thêm ETH.';
  if (sending.has(orderId)) throw new Error(used);
  sending.add(orderId);
  try {
    const saved = await memory.proof(orderId);
    if (saved) {
      deps.onSubmission(saved);
      throw new Error(used);
    }
    const order = await deps.getOrder(orderId);
    assertPayableEthOrder(order, orderId, quote.amountVnd);
    const { provider, account } = await deps.getWallet(false);
    const transaction = buildMembershipEthTransaction(quote, account, order.amountVnd);
    const draft = { paymentId: quote.paymentId };
    await memory.remember(orderId);
    await memory.saveProof(orderId, draft);
    deps.onSubmission(draft);

    let hash: unknown;
    try {
      hash = await provider.request({ method: 'eth_sendTransaction', params: [transaction] });
    } catch (cause) {
      if ((cause as { code?: number } | null)?.code === 4001) {
        await memory.clearProof(orderId);
        deps.onSubmission(null);
      }
      throw cause;
    }
    if (!isTransactionHash(hash))
      throw new Error(
        'MetaMask chưa trả về mã giao dịch hợp lệ. Hãy kiểm tra lịch sử ví trước khi thử lại.'
      );
    const record = { ...draft, txHash: hash };
    deps.onSubmission(record);
    try {
      await memory.saveProof(orderId, record).catch(() => memory.saveProof(orderId, record));
    } catch {
      throw new Error(
        `Không lưu được mã giao dịch trên máy. Hãy sao chép và giữ lại: ${hash}. Không gửi thêm ETH.`
      );
    }
    return record;
  } finally {
    sending.delete(orderId);
  }
}

/** Asks the server to reconcile; safe to repeat. `knownHash` covers a hash that is not stored. */
export async function settleMembershipPayment(
  orderId: string,
  deps: {
    memory: OrderMemory;
    settle: (orderId: string, paymentId: string, txHash: string) => Promise<MembershipOrder>;
    knownHash?: string;
  }
) {
  const proof = await deps.memory.proof(orderId);
  const txHash = proof?.txHash ?? deps.knownHash?.trim();
  if (!proof || !isTransactionHash(txHash)) throw new Error('Mã giao dịch Sepolia không hợp lệ.');
  const order = await deps.settle(orderId, proof.paymentId, txHash);
  // The server accepted this hash, so it is worth keeping even when it was typed in.
  if (!proof.txHash)
    await deps.memory.saveProof(orderId, { ...proof, txHash }).catch(() => undefined);
  return order;
}
