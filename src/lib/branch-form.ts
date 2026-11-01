import type { Branch, BranchCategory, BranchCharge, BranchInput } from '@/services/branchApi';

export const BRANCH_CATEGORIES: { value: BranchCategory; label: string }[] = [
  { value: 'APARTMENT', label: 'Căn hộ' },
  { value: 'HOUSE', label: 'Nhà nguyên căn' },
  { value: 'ROOM', label: 'Phòng trọ' },
];
export const CHARGE_FIELDS = [
  {
    key: 'ELECTRICITY',
    label: 'Tiền điện',
    methods: [
      ['PER_KWH', 'Theo kWh'],
      ['INCLUDED', 'Đã bao gồm'],
    ],
  },
  {
    key: 'WATER',
    label: 'Tiền nước',
    methods: [
      ['PER_M3', 'Theo m³'],
      ['PER_PERSON_MONTH', 'Theo người'],
      ['PER_MONTH', 'Theo phòng'],
      ['INCLUDED', 'Đã bao gồm'],
    ],
  },
  {
    key: 'MANAGEMENT',
    label: 'Phí quản lý',
    methods: [
      ['PER_MONTH', 'Theo tháng'],
      ['PER_M2_MONTH', 'Theo m²'],
      ['INCLUDED', 'Đã bao gồm'],
      ['NOT_APPLICABLE', 'Không áp dụng'],
    ],
  },
  {
    key: 'INTERNET',
    label: 'Internet / WiFi',
    methods: [
      ['PER_MONTH', 'Theo tháng'],
      ['INCLUDED', 'Đã bao gồm'],
      ['NOT_APPLICABLE', 'Tự túc'],
    ],
  },
  {
    key: 'SERVICE_OR_GARBAGE',
    label: 'Phí rác & vệ sinh',
    methods: [
      ['PER_MONTH', 'Theo tháng'],
      ['INCLUDED', 'Đã bao gồm'],
      ['NOT_APPLICABLE', 'Không có'],
    ],
  },
  {
    key: 'MOTORBIKE_PARKING',
    label: 'Gửi xe máy',
    methods: [
      ['PER_VEHICLE_MONTH', 'Theo xe'],
      ['FREE', 'Miễn phí'],
      ['INCLUDED', 'Đã bao gồm'],
      ['NOT_APPLICABLE', 'Không nhận xe'],
    ],
  },
  {
    key: 'CAR_PARKING',
    label: 'Gửi ô tô',
    methods: [
      ['PER_VEHICLE_MONTH', 'Theo xe'],
      ['FREE', 'Miễn phí'],
      ['INCLUDED', 'Đã bao gồm'],
      ['NOT_APPLICABLE', 'Không nhận xe'],
    ],
  },
] as const;
export type ChargeKey = (typeof CHARGE_FIELDS)[number]['key'];
type ChargeDraft = { method: string; amount: string };
export type BranchFormState = {
  name: string;
  code: string;
  category: BranchCategory;
  refId: string;
  display: string;
  addressNote: string;
  description: string;
  buildingRules: string;
  coverImageId: string | null;
  motorbikeCapacity: string;
  carCapacity: string;
  charges: Record<ChargeKey, ChargeDraft>;
  customFees: { name: string; amount: string; unit: string }[];
  buildingAmenityCodes: string[];
};

const defaults: Record<ChargeKey, ChargeDraft> = {
  ELECTRICITY: { method: 'PER_KWH', amount: '3500' },
  WATER: { method: 'PER_PERSON_MONTH', amount: '100000' },
  MANAGEMENT: { method: 'NOT_APPLICABLE', amount: '' },
  INTERNET: { method: 'NOT_APPLICABLE', amount: '' },
  SERVICE_OR_GARBAGE: { method: 'INCLUDED', amount: '' },
  MOTORBIKE_PARKING: { method: 'FREE', amount: '' },
  CAR_PARKING: { method: 'NOT_APPLICABLE', amount: '' },
};

export function branchForm(branch?: Branch): BranchFormState {
  const charges = Object.fromEntries(
    CHARGE_FIELDS.map(({ key }) => {
      const saved = branch?.defaultCharges?.find((charge) => charge.chargeType === key);
      return [
        key,
        saved
          ? { method: saved.billingMethod, amount: String(saved.amount ?? '') }
          : { ...defaults[key] },
      ];
    })
  ) as Record<ChargeKey, ChargeDraft>;
  if (
    branch &&
    !branch.defaultCharges?.some((charge) => charge.chargeType === 'MOTORBIKE_PARKING') &&
    !branch.motorbikeParkingCapacity
  )
    charges.MOTORBIKE_PARKING.method = 'NOT_APPLICABLE';
  return {
    name: branch?.name ?? '',
    code: branch?.code ?? '',
    category: branch?.category ?? 'HOUSE',
    refId: branch?.refId ?? '',
    display: branch?.display ?? '',
    addressNote: branch?.addressNote ?? '',
    description: branch?.description ?? '',
    buildingRules: branch?.buildingRules ?? '',
    coverImageId: branch?.coverImageId ?? null,
    motorbikeCapacity: String(branch ? (branch.motorbikeParkingCapacity ?? 0) : 10),
    carCapacity: String(branch?.carParkingCapacity ?? 0),
    charges,
    customFees: (branch?.defaultCharges ?? [])
      .filter((charge) => charge.chargeType === 'OTHER')
      .map((charge) => ({
        name: charge.customName ?? '',
        amount: String(charge.amount ?? ''),
        unit: charge.unit ?? 'tháng',
      })),
    buildingAmenityCodes: branch?.buildingAmenityCodes ?? [],
  };
}

const paidMethods = new Set([
  'PER_KWH',
  'PER_M3',
  'PER_PERSON_MONTH',
  'PER_MONTH',
  'PER_M2_MONTH',
  'PER_VEHICLE_MONTH',
]);
const units: Record<string, string> = {
  PER_KWH: 'kWh',
  PER_M3: 'm³',
  PER_PERSON_MONTH: 'người/tháng',
  PER_MONTH: 'tháng',
  PER_M2_MONTH: 'm²/tháng',
  PER_VEHICLE_MONTH: 'xe/tháng',
};

export function buildBranchInput(form: BranchFormState): BranchInput {
  if (!form.name.trim()) throw new Error('Vui lòng nhập tên chi nhánh.');
  if (!form.refId.trim()) throw new Error('Vui lòng chọn địa chỉ từ kết quả tìm kiếm.');
  const motorbikeCapacity =
    form.charges.MOTORBIKE_PARKING.method === 'NOT_APPLICABLE' ? 0 : Number(form.motorbikeCapacity);
  const carCapacity =
    form.charges.CAR_PARKING.method === 'NOT_APPLICABLE' ? 0 : Number(form.carCapacity);
  if (
    !Number.isInteger(motorbikeCapacity) ||
    motorbikeCapacity < 0 ||
    (form.charges.MOTORBIKE_PARKING.method !== 'NOT_APPLICABLE' && motorbikeCapacity < 1)
  )
    throw new Error('Sức chứa xe máy phải lớn hơn 0, hoặc chọn không nhận xe.');
  if (
    !Number.isInteger(carCapacity) ||
    carCapacity < 0 ||
    (form.charges.CAR_PARKING.method !== 'NOT_APPLICABLE' && carCapacity < 1)
  )
    throw new Error('Sức chứa ô tô phải lớn hơn 0, hoặc chọn không nhận xe.');
  const defaultCharges: BranchCharge[] = CHARGE_FIELDS.filter(
    ({ key }) =>
      !(['MANAGEMENT', 'INTERNET', 'SERVICE_OR_GARBAGE'] as string[]).includes(key) ||
      form.charges[key].method !== 'NOT_APPLICABLE'
  ).map(({ key }) => {
    const { method, amount } = form.charges[key];
    const index = CHARGE_FIELDS.findIndex((field) => field.key === key);
    if (paidMethods.has(method) && !(Number(amount) > 0))
      throw new Error(`Vui lòng nhập đơn giá cho ${CHARGE_FIELDS[index].label}.`);
    return {
      chargeType: key,
      billingMethod: method,
      amount: paidMethods.has(method) ? Number(amount) : undefined,
      currency: 'VND',
      unit: method === 'PER_MONTH' && key !== 'ELECTRICITY' ? 'phòng/tháng' : (units[method] ?? ''),
      includedInRent: method === 'INCLUDED' || method === 'FREE',
      sortOrder: index + 1,
    };
  });
  form.customFees.forEach((fee, index) => {
    if (!fee.name.trim() || !(Number(fee.amount) > 0))
      throw new Error(`Vui lòng nhập tên và số tiền cho khoản phí khác ${index + 1}.`);
    defaultCharges.push({
      chargeType: 'OTHER',
      billingMethod: 'PER_MONTH',
      amount: Number(fee.amount),
      currency: 'VND',
      unit: fee.unit.trim() || 'tháng',
      customName: fee.name.trim(),
      includedInRent: false,
      sortOrder: index + 10,
    });
  });
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase() || undefined,
    category: form.category,
    refId: form.refId,
    addressNote: form.addressNote.trim() || undefined,
    description: form.description.trim() || undefined,
    buildingRules: form.buildingRules.trim() || undefined,
    coverImageId: form.coverImageId,
    motorbikeParkingCapacity: motorbikeCapacity,
    carParkingCapacity: carCapacity,
    defaultCharges,
    buildingAmenityCodes: form.buildingAmenityCodes,
  };
}
