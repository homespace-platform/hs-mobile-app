export function deviceUrl(value: string, androidHost?: string) {
  if (!androidHost) return value;
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return value;
  url.hostname = androidHost;
  return url.toString().replace(/\/$/, '');
}
