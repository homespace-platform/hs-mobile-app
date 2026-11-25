export interface ListingPolicyInput {
  code: string;
  value: string;
  note?: string;
}
export interface ListingPolicyDefinition {
  code: string;
  label: string;
  valueType: 'PERMISSION' | 'INTEGER' | 'TEXT';
  helpText?: string;
  unitLabel?: string;
  required: boolean;
  minimumValue?: number | null;
  maximumValue?: number | null;
  sortOrder: number;
  choices?: { value: string; label: string }[];
}
export interface ListingPolicyValue extends ListingPolicyDefinition, ListingPolicyInput {
  displayValue: string;
}
export const policyPermissions = [
  { value: 'ALLOWED', label: 'Cho phép' },
  { value: 'NOT_ALLOWED', label: 'Không cho phép' },
  { value: 'APPROVAL_REQUIRED', label: 'Cần chủ nhà chấp thuận trước' },
];
export function policyInputs(
  rows: ListingPolicyInput[],
  definitions: ListingPolicyDefinition[]
): ListingPolicyInput[] {
  return rows
    .filter((row) => row.value.trim() && definitions.some((d) => d.code === row.code))
    .map((row) => ({ code: row.code, value: row.value.trim(), note: row.note?.trim() || '' }));
}
