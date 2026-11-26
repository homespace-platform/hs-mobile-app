import type {
  MembershipCheckout,
  MembershipQuote,
  PaidMembershipTier,
} from '@/services/membershipApi';

// The same two gateways the web accepts (SEPAY_ALLOWED_HOSTS).
const SEPAY_ORIGINS = ['https://pay-sandbox.sepay.vn', 'https://pay.sepay.vn'];

// The SePay form preserves the same field order as the Core API signer.
const FORM_FIELDS = [
  'order_amount',
  'merchant',
  'currency',
  'operation',
  'order_description',
  'order_invoice_number',
  'customer_id',
  'payment_method',
  'success_url',
  'error_url',
  'cancel_url',
  'lang',
  'signature',
] as const;

export function isMembershipOrderId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{32}$/i.test(value);
}

export function isMembershipQuote(quote: MembershipQuote | null, tier: PaidMembershipTier) {
  return (
    quote?.tier === tier &&
    Number.isSafeInteger(quote.amountVnd) &&
    quote.amountVnd > 0 &&
    Number.isSafeInteger(quote.remainingUsesAfter) &&
    quote.remainingUsesAfter >= 0
  );
}

export function buildSepayCheckout(checkout: MembershipCheckout, confirmedAmount: number) {
  const uri = SEPAY_ORIGINS.map((origin) => `${origin}/v1/checkout/init`).find(
    (url) => url === checkout.paymentUrl
  );
  if (checkout.provider !== 'SEPAY' || !uri) {
    throw new Error('Địa chỉ cổng thanh toán SePay từ máy chủ không hợp lệ.');
  }
  if (
    !Number.isSafeInteger(confirmedAmount) ||
    confirmedAmount <= 0 ||
    checkout.amountVnd !== confirmedAmount
  ) {
    throw new Error('Số tiền đã thay đổi. Vui lòng kiểm tra lại báo giá.');
  }

  const fields = checkout.formFields;
  if (
    !isMembershipOrderId(checkout.orderId) ||
    !fields ||
    fields.order_amount !== String(confirmedAmount) ||
    fields.order_invoice_number !== checkout.orderId ||
    fields.currency !== 'VND' ||
    fields.operation !== 'PURCHASE' ||
    ![fields.merchant, fields.signature, fields.order_description].every(
      (value) => typeof value === 'string' && value.trim()
    )
  )
    throw new Error('Dữ liệu biểu mẫu SePay không hợp lệ.');

  const returnUrls = [fields.success_url, fields.error_url, fields.cancel_url];
  for (const [index, outcome] of ['success', 'error', 'cancel'].entries()) {
    const url = returnUrls[index];
    const expectedQuery = new RegExp(`(?:[?&])orderId=${checkout.orderId}(?:&|$)`);
    if (
      !/^https:\/\/[^\s@/?#\\]+\/[^\s#]*\?/.test(url) ||
      !expectedQuery.test(url) ||
      !url.endsWith(`&sepayReturn=${outcome}`)
    ) {
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
      uri,
      method: 'POST' as const,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  };
}

export function isSepayPaymentPage(url: string) {
  return SEPAY_ORIGINS.some((origin) => url === origin || url.startsWith(`${origin}/`));
}
