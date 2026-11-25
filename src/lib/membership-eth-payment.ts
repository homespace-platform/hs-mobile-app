import type { MembershipEthQuote, MembershipOrder } from '@/services/membershipApi';

export const SEPOLIA_CHAIN_ID = '0xaa36a7';
export const isWalletAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
export const isTransactionHash = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
export const isWalletSignature = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-f]{130}$/i.test(value);

export type EthSubmission = { paymentId: string; txHash?: string };

export function readEthSubmission(raw: string | null): EthSubmission | null {
  if (raw === null) return null;
  const saved = JSON.parse(raw) as Partial<EthSubmission> | null;
  if (!saved || !isTransactionHash(saved.paymentId) ||
      (saved.txHash !== undefined && !isTransactionHash(saved.txHash))) {
    throw new Error('Không đọc được thông tin giao dịch đã lưu. Kiểm tra lịch sử MetaMask.');
  }
  return { paymentId: saved.paymentId, txHash: saved.txHash };
}

export function assertPayableEthOrder(order: MembershipOrder, id: string, confirmedAmount: number) {
  if (order?.id !== id || order.status !== 'PENDING' || order.provider !== 'ETH' ||
      order.amountVnd !== confirmedAmount || !Number.isSafeInteger(confirmedAmount) || confirmedAmount <= 0) {
    throw new Error('Đơn Sepolia đã thay đổi. Hãy kiểm tra lại trạng thái đơn.');
  }
}

const word = (value: bigint) => value.toString(16).padStart(64, '0');

export function buildMembershipEthTransaction(quote: MembershipEthQuote, account: string, amountVnd: number) {
  if (!quote || quote.chainId !== 11155111 || !isWalletAddress(account) || !isWalletAddress(quote.payer) ||
      account.toLowerCase() !== quote.payer.toLowerCase()) {
    throw new Error('Ví thanh toán hoặc mạng Sepolia không khớp báo giá.');
  }
  if (!isWalletAddress(quote.contractAddress) || !isWalletAddress(quote.recipient) || !isTransactionHash(quote.paymentId)) {
    throw new Error('Địa chỉ hoặc mã thanh toán trong báo giá không hợp lệ.');
  }
  if (!Number.isSafeInteger(amountVnd) || amountVnd <= 0 || quote.amountVnd !== amountVnd) {
    throw new Error('Số tiền thanh toán đã thay đổi. Vui lòng kiểm tra lại đơn.');
  }
  if (typeof quote.amountWei !== 'string' || !/^[1-9]\d{0,77}$/.test(quote.amountWei) ||
      !isWalletSignature(quote.signature)) {
    throw new Error('Số wei hoặc chữ ký báo giá không hợp lệ.');
  }
  const expiresMs = Date.parse(quote.expiresAt);
  if (!Number.isFinite(expiresMs) || Date.now() >= expiresMs) {
    throw new Error('Báo giá ETH đã hết hạn. Vui lòng lấy báo giá mới.');
  }
  const amountWei = BigInt(quote.amountWei);
  if (amountWei >= (1n << 256n)) throw new Error('Số wei vượt giới hạn hợp đồng.');

  // pay(bytes32,address,address,uint256,uint256,bytes) on the membership contract.
  const data = '0xfe908b7a'
    + quote.paymentId.slice(2)
    + quote.payer.slice(2).padStart(64, '0')
    + quote.recipient.slice(2).padStart(64, '0')
    + word(amountWei)
    + word(BigInt(Math.floor(expiresMs / 1000)))
    + word(192n)
    + word(65n)
    + quote.signature.slice(2).padEnd(192, '0');
  return { from: account, to: quote.contractAddress, value: `0x${amountWei.toString(16)}`, data: data.toLowerCase(), chainId: SEPOLIA_CHAIN_ID };
}

export function formatSepoliaEth(wei: string) {
  const digits = wei.padStart(19, '0');
  const fraction = digits.slice(-18).replace(/0+$/, '');
  return fraction ? `${digits.slice(0, -18)}.${fraction}` : digits.slice(0, -18);
}
