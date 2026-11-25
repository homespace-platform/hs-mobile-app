// Port of the rules in hs-web-app components/contract/detail/InvoiceLineCalculation.tsx:3-22 as texts.
import { currencyVnd } from '@/lib/rental/format';
import type { InvoiceLine } from '@/types/rental/monthly-invoice.type';

export const money = (value: number) => currencyVnd(value);

/** `formula` is the small grey text; `capNote` is set when the cap lowered a late fee. */
export function invoiceLineCalculation(line: InvoiceLine): {
  formula: string;
  capNote: string | null;
} {
  if (line.type !== 'LATE_FEE')
    return { formula: `(${line.quantity} × ${money(line.unitPrice)})`, capNote: null };
  if (!line.quantityUnit)
    return {
      formula: '(Khoản phí đã chốt; hóa đơn cũ chưa lưu chi tiết số ngày)',
      capNote: null,
    };
  const beforeCap = line.quantity * line.unitPrice;
  return {
    formula: `(${money(line.unitPrice)}${line.quantityUnit === 'ngày' ? '/ngày' : ''} × ${line.quantity} ${line.quantityUnit})`,
    capNote:
      beforeCap > line.amount
        ? `Phí tính theo đơn giá: ${money(beforeCap)}; áp dụng mức trần còn ${money(line.amount)}.`
        : null,
  };
}
