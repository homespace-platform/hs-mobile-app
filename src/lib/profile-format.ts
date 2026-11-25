/** Web: Intl vi-VN {month:'long', year:'numeric'} -> "tháng 11 năm 2026". Hermes Intl is unreliable, so format by hand. */
export function formatMonthYear(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}

/** Same path as web `/u/{username}`; null when no public web URL is configured. */
export function buildProfileLink(baseUrl: string | undefined, username?: string | null) {
  const base = baseUrl?.trim().replace(/\/+$/, '');
  return base && username ? `${base}/u/${encodeURIComponent(username)}` : null;
}
