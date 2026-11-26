// Web components/listing/ListingPolicyFields inside the editor's policy section.
import { Pressable, Text, View } from 'react-native';

import { Anchor } from '@/components/rental/contract/anchors';
import ActionButton from '@/components/rental/shared/ActionButton';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { categoryCode } from '@/lib/listing-form';
import {
  CATALOG_LOADING,
  POLICY_NOTE_MAX,
  POLICY_TEXT_MAX,
  policyField,
  replacePolicy,
  selectPermission,
  withSystemRules,
  type ListingPolicyDefinition,
  type ListingPolicyInput,
} from '@/lib/listing-policy';

import {
  ErrorText,
  IntegerField,
  Notice,
  Section,
  SelectField,
  TextField,
  type SectionProps,
} from './ui';

export default function PoliciesSection({
  state,
  update,
  errors,
  definitions,
  catalogError,
  onRetry,
}: SectionProps & {
  definitions: ListingPolicyDefinition[];
  /** Loading or unusable catalog: replaces the policy fields. */
  catalogError: string;
  onRetry: () => void;
}) {
  const category = categoryCode(state.basicInfo.category);
  const rows = withSystemRules(state.listingPolicies, definitions, category);
  const write = (row: ListingPolicyInput) =>
    update((s) => ({ ...s, listingPolicies: replacePolicy(s.listingPolicies, row) }));

  return (
    <Section title="Chính sách & nội quy thuê">
      <PolicyNotice
        tone="neutral"
        title="Chính sách & nội quy thuê"
        summary="Người thuê sẽ xem các quy định này trước khi gửi yêu cầu thuê."
        text="Người thuê sẽ xem các quy định này trước khi gửi yêu cầu thuê. Phí phạt đóng trễ chỉ nhập khi soạn hợp đồng, không nhập ở đây."
      />
      <Anchor id="policies">
        <ErrorText message={errors.policies} />
      </Anchor>
      {catalogError ? (
        <>
          <Notice
            tone={catalogError === CATALOG_LOADING ? 'info' : 'warning'}
            text={catalogError}
          />
          {catalogError === CATALOG_LOADING ? null : (
            <ActionButton label="Tải lại chính sách" icon="refresh" onClick={onRetry} />
          )}
        </>
      ) : (
        definitions.map((definition) => {
          const field = policyField(definition, rows, category);
          const { row, template } = field;
          const label = `${definition.label}${definition.required ? ' *' : ''}`;
          return (
            <View
              key={`${category}-${definition.code}`}
              className="gap-2 rounded-xl border border-border bg-background p-3">
              <Text className="text-sm font-semibold text-foreground">
                {field.fixedValue === undefined ? label : definition.label}
              </Text>
              {definition.helpText ? (
                <Text className="text-xs leading-5 text-muted-foreground">
                  {definition.helpText}
                </Text>
              ) : null}
              {field.fixedValue !== undefined ? (
                <>
                  <Text className="text-lg font-bold text-foreground">
                    {field.fixedValue} {definition.unitLabel}
                  </Text>
                  <Text className="text-xs font-semibold text-primary">Quy định hệ thống</Text>
                  {field.fixedNote ? (
                    <Text className="text-xs leading-5 text-muted-foreground">
                      {field.fixedNote}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  {definition.valueType === 'PERMISSION' ? (
                    <SelectField
                      ariaLabel={definition.label}
                      value={row.value}
                      options={[{ value: '', label: 'Chọn quy định…' }, ...field.choices]}
                      onChange={(value) => write(selectPermission(row, value, category))}
                    />
                  ) : definition.valueType === 'INTEGER' ? (
                    <IntegerField
                      ariaLabel={definition.label}
                      value={row.value}
                      suffix={definition.unitLabel}
                      onValueChange={(value) => write({ ...row, value })}
                    />
                  ) : (
                    <TextField
                      ariaLabel={definition.label}
                      multiline
                      maxLength={POLICY_TEXT_MAX}
                      value={row.value}
                      onChangeText={(value) => write({ ...row, value })}
                      placeholder="Nhập quy định thực tế áp dụng cho tài sản này…"
                    />
                  )}
                  {definition.valueType !== 'TEXT' ? (
                    <TextField
                      label={`Điều kiện / ghi chú ${definition.label.toLowerCase()}`}
                      multiline
                      maxLength={POLICY_NOTE_MAX}
                      value={row.note ?? ''}
                      onChangeText={(note) => write({ ...row, note })}
                      placeholder="Điều kiện cụ thể, khu vực áp dụng… (không bắt buộc)"
                    />
                  ) : null}
                  {template ? (
                    <Pressable
                      onPress={() => write({ ...row, [template.target]: template.text })}
                      accessibilityRole="button"
                      accessibilityLabel={`Dùng mẫu gợi ý cho ${definition.label}`}
                      className="min-h-11 justify-center self-start">
                      <Text className="text-sm font-bold text-primary">Dùng mẫu gợi ý</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          );
        })
      )}
    </Section>
  );
}
