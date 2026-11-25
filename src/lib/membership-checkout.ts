import type { MembershipCheckout, MembershipQuote, PaidMembershipTier } from '@/services/membershipApi';

const SANDBOX_ORIGIN = 'https://pay-sandbox.sepay.vn';
const CHECKOUT_URL = `${SANDBOX_ORIGIN}/v1/checkout/init`;

// The SePay form preserves the same field order as the Core API signer.
const FORM_FIELDS = [
  'order_amount', 'merchant', 'currency', 'operation', 'order_description', 'order_invoice_number',
  'customer_id', 'payment_method', 'success_url', 'error_url', 'cancel_url', 'lang', 'signature',
] as const;

export function isPaidMembershipTier(tier: string): tier is PaidMembershipTier {
  return tier === 'STARTER' || tier === 'PRO' || tier === 'BUSINESS';
}

export function isMembershipOrderId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value);
}

export function isMembershipQuote(quote: MembershipQuote | null, tier: PaidMembershipTier) {
  return quote?.tier === tier && Number.isSafeInteger(quote.amountVnd) && quote.amountVnd > 0 &&
    Number.isSafeInteger(quote.remainingUsesAfter) && quote.remainingUsesAfter >= 0;
}

export function buildSandboxCheckout(checkout: MembershipCheckout, confirmedAmount: number) {
  if (checkout.provider !== 'SEPAY' || checkout.paymentUrl !== CHECKOUT_URL) {
    throw new Error('Máy chủ chưa trả về cổng SePay Sandbox. Vui lòng kiểm tra cấu hình Core API.');
  }
  if (!Number.isSafeInteger(confirmedAmount) || confirmedAmount <= 0 || checkout.amountVnd !== confirmedAmount) {
    throw new Error('Số tiền đã thay đổi. Vui lòng kiểm tra lại báo giá.');
  }

  const fields = checkout.formFields;
  if (
    !isMembershipOrderId(checkout.orderId) || !fields ||
    fields.order_amount !== String(confirmedAmount) || fields.order_invoice_number !== checkout.orderId ||
    fields.currency !== 'VND' || fields.operation !== 'PURCHASE' ||
    ![fields.merchant, fields.signature, fields.order_description].every(
      (value) => typeof value === 'string' && value.trim()
    )
  ) throw new Error('Dữ liệu biểu mẫu SePay không hợp lệ.');

  const returnUrls = [fields.success_url, fields.error_url, fields.cancel_url];
  for (const [index, outcome] of ['success', 'error', 'cancel'].entries()) {
    const url = returnUrls[index];
    const expectedQuery = new RegExp(`(?:[?&])orderId=${checkout.orderId}(?:&|$)`);
    if (!/^https:\/\/[^\s@/?#\\]+\/[^\s#]*\?/.test(url) || !expectedQuery.test(url) ||
      !url.endsWith(`&sepayReturn=${outcome}`)) {
      throw new Error('Địa chỉ trả kết quả của SePay không hợp lệ.');
    }
  }

  const body = FORM_FIELDS.flatMap((name) => {
    const value = fields[name];
    return typeof value === 'string' ? [`${name}=${encodeURIComponent(value)}`] : [];
  }).join('&');

  return {
    returnUrls,
    source: {
      uri: CHECKOUT_URL,
      method: 'POST' as const,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  };
}

export function isSandboxPaymentPage(url: string) {
  return url === SANDBOX_ORIGIN || url.startsWith(`${SANDBOX_ORIGIN}/`);
}
