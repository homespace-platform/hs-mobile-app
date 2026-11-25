// Port of the countdown in hs-web-app components/rental/NextActionCard.tsx:17-27.
export function remaining(dueAt: string | null | undefined, now: number) {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now;
  if (Number.isNaN(ms)) return null;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span =
    d > 0 ? `${d} ngày ${h} giờ` : h > 0 ? `${h} giờ ${m} phút` : `${Math.max(m, 1)} phút`;
  return {
    late: ms <= 0,
    text: ms <= 0 ? `Đã quá hạn ${span}` : `Còn ${span}`,
    at: new Date(dueAt),
  };
}
