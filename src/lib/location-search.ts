function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

export function matchesProvince(name: string, query: string) {
  return normalize(name).includes(normalize(query));
}
