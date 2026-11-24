import wardsCatalog from '@/data/wards.json';

export type Ward = { code: string; name: string; name_with_type: string; parent_code: string };

const WARDS = Object.values(wardsCatalog) as Ward[];

export function wardsOfCity(cityCode: string) {
  return WARDS.filter((ward) => ward.parent_code === cityCode);
}
