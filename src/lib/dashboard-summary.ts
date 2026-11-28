export type DashboardMoney = number | string;

export function dashboardMonthRangeError(from: string, to: string): string | null {
  const month = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
  if (!month.test(from) || !month.test(to)) return 'Nhập tháng theo dạng YYYY-MM, ví dụ 2026-11.';
  const monthIndex = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5));
  const span = monthIndex(to) - monthIndex(from);
  return span < 0 || span > 23
    ? 'Chọn khoảng từ 1 đến 24 tháng, tháng kết thúc từ tháng bắt đầu.'
    : null;
}

/** Quote decimal and unsafe integer tokens outside JSON strings before JS can round them. */
export function parseDashboardResponse(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  return JSON.parse(
    raw.replace(/"(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token) =>
      token.startsWith('"') || (!/[.eE]/.test(token) && Number.isSafeInteger(Number(token)))
        ? token
        : JSON.stringify(token)
    )
  );
}

export function dashboardMoney(value: DashboardMoney | null | undefined): string {
  if (value == null) return '—';
  let text = String(value);
  const scientific = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (scientific) {
    const [, sign, integer, fraction = '', exponent] = scientific;
    const digits = integer + fraction;
    const point = integer.length + Number(exponent);
    if (Math.abs(point) > 1000) return '—';
    text =
      sign +
      (point <= 0
        ? `0.${'0'.repeat(-point)}${digits}`
        : point >= digits.length
          ? digits + '0'.repeat(point - digits.length)
          : `${digits.slice(0, point)}.${digits.slice(point)}`);
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return '—';
  const [whole, fraction] = text.split('.');
  const decimals = fraction?.replace(/0+$/, '');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimals ? `,${decimals}` : ''} ₫`;
}

export function dashboardDate(value: string | null | undefined, includeTime = false): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa xác định';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {}),
  }).format(new Date(value));
}

/** Only the supported web origin receives dashboard fallback links. */
export function dashboardWebUrl(base: string | undefined, path: string): string | null {
  if (!/^\/(?!\/)/.test(path) || /[\\\u0000-\u0020]/.test(path)) return null;
  try {
    const origin = new URL(base || 'https://www.homespace.id.vn');
    if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password)
      return null;
    return new URL(path, origin.origin).toString();
  } catch {
    return null;
  }
}
