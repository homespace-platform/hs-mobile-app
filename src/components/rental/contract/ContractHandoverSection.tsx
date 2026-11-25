// Web: components/contract/detail/ContractHandoverSection.tsx.
import { useContext, type ReactNode } from 'react';
import { TextInput, View } from 'react-native';

import FieldFrame, {
  FieldTextColor,
  inputBoxClass,
  inputTextClass,
} from '@/components/rental/shared/FieldFrame';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';

import { Anchor } from './anchors';
import { ContractEditField, FieldRow, Section } from './fields';

function MeterInput({
  label,
  value,
  required,
  disabled,
  placeholder,
  error,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  required: boolean;
  disabled?: boolean;
  placeholder: string;
  error?: string;
  hint: string;
  onChange?: (value: string) => void;
}) {
  const textColor = useContext(FieldTextColor);
  const name = required ? `${label} *` : label;
  return (
    <FieldFrame label={name} error={error} hint={error ? undefined : hint}>
      <View className={inputBoxClass(Boolean(error), disabled)}>
        <TextInput
          accessibilityLabel={name}
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          keyboardType="decimal-pad"
          maxLength={20}
          placeholder={placeholder}
          className={inputTextClass(disabled, textColor)}
        />
      </View>
    </FieldFrame>
  );
}

export default function ContractHandoverSection({
  electricityInitial,
  waterInitial,
  originalElectricityInitial,
  originalWaterInitial,
  isWaterPerPerson,
  electricityRequired,
  waterRequired,
  isDraft,
  isLandlord,
  disabled,
  priority = false,
  missingFieldsNotice,
  errors,
  onElectricityChange,
  onWaterChange,
}: {
  electricityInitial?: string | null;
  waterInitial?: string | null;
  originalElectricityInitial?: string | null;
  originalWaterInitial?: string | null;
  isWaterPerPerson?: boolean;
  electricityRequired: boolean;
  waterRequired: boolean;
  isDraft: boolean;
  isLandlord: boolean;
  disabled?: boolean;
  /** A draft still missing a required reading: shown first, with the missing fields. */
  priority?: boolean;
  missingFieldsNotice?: ReactNode;
  errors?: { electricity?: string; water?: string };
  onElectricityChange?: (value: string) => void;
  onWaterChange?: (value: string) => void;
}) {
  const differs = (value?: string | null, original?: string | null) =>
    original !== undefined && String(value ?? '').trim() !== String(original ?? '').trim();
  const editable = isDraft && isLandlord;
  return (
    <Anchor id="contract-handover">
      <View className={priority ? 'gap-3 rounded-2xl border-2 border-warning p-1' : 'gap-3'}>
        {priority ? missingFieldsNotice : null}
        <Section
          icon="speedometer-outline"
          title="Chỉ số công tơ ban đầu"
          subtitle="Nhập chỉ số ban đầu khi khoản phí được tính theo đồng hồ để ghi vào hợp đồng."
          badge="Bắt buộc với phí tính theo đồng hồ">
          {editable ? (
            <>
              <ContractEditField
                group="meters"
                changed={differs(electricityInitial, originalElectricityInitial)}>
                <MeterInput
                  label="Chỉ số điện ban đầu (kWh)"
                  value={electricityInitial || ''}
                  required={electricityRequired}
                  disabled={disabled}
                  placeholder="Ví dụ: 1250"
                  error={errors?.electricity}
                  hint={
                    electricityRequired
                      ? 'Nhập số không âm; 0 là hợp lệ.'
                      : 'Không bắt buộc nếu điện không tính theo công tơ.'
                  }
                  onChange={onElectricityChange}
                />
              </ContractEditField>
              <ContractEditField
                group="meters"
                readonly={isWaterPerPerson}
                changed={differs(waterInitial, originalWaterInitial)}>
                <MeterInput
                  label="Chỉ số nước ban đầu (m³)"
                  value={isWaterPerPerson ? '' : waterInitial || ''}
                  required={waterRequired}
                  disabled={isWaterPerPerson || disabled}
                  placeholder={isWaterPerPerson ? 'Không áp dụng đồng hồ nước' : 'Ví dụ: 85'}
                  error={errors?.water}
                  hint={
                    isWaterPerPerson
                      ? 'Nước tính theo đầu người; không cần chỉ số đồng hồ.'
                      : waterRequired
                        ? 'Nhập số không âm; 0 là hợp lệ.'
                        : 'Không bắt buộc nếu nước không tính theo đồng hồ.'
                  }
                  onChange={onWaterChange}
                />
              </ContractEditField>
            </>
          ) : (
            <View>
              <FieldRow
                label="Chỉ số điện ban đầu (kWh)"
                value={electricityInitial?.trim() ? electricityInitial : 'Chưa ghi nhận'}
              />
              <FieldRow
                label="Chỉ số nước ban đầu (m³)"
                value={
                  isWaterPerPerson
                    ? 'Không áp dụng đồng hồ nước (Tính theo đầu người)'
                    : waterInitial?.trim()
                      ? waterInitial
                      : 'Chưa ghi nhận'
                }
              />
            </View>
          )}
          <PolicyNotice
            tone="neutral"
            title="Chỉ số công tơ ban đầu"
            text={
              editable
                ? 'Kiểm tra chỉ số thực tế cùng người thuê. Các giá trị này được lưu cùng bản nháp khi bấm Lưu.'
                : 'Chỉ số ban đầu dùng để đối chiếu với nội dung hợp đồng và kỳ tính phí đầu tiên.'
            }
          />
        </Section>
      </View>
    </Anchor>
  );
}
