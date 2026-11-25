import type { Bank } from '@/services/bankAccountApi';

/** Accent/case-insensitive key, like the web BankPicker search, but lowercases first so a capital Đ also matches "d". */
export const normalizeSearch = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export function filterBanks(banks: Bank[], query: string) {
  const q = normalizeSearch(query.trim());
  if (!q) return banks;
  return banks.filter((bank) =>
    normalizeSearch(`${bank.code} ${bank.shortName} ${bank.name} ${bank.bin}`).includes(q)
  );
}

/** Edit mode: the account's own bank may be missing from the catalog, so it is prepended. */
export function withExtraBank(banks: Bank[], extra: Bank | null) {
  return extra && !banks.some((bank) => bank.bin === extra.bin) ? [extra, ...banks] : banks;
}

export const cleanAccountNumber = (value: string) => value.replace(/\s+/g, '');
export const cleanHolderName = (value: string) => value.toUpperCase();

/** Client-side UX check only; the backend stays the authority on account rules. */
export function bankFormError(accountNumber: string, holder: string, hasBank: boolean) {
  if (!accountNumber.trim() || !holder.trim()) {
    return 'Vui lòng điền đầy đủ số tài khoản và tên chủ tài khoản.';
  }
  return hasBank ? null : 'Vui lòng chọn ngân hàng.';
}
