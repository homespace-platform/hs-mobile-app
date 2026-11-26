// Web MonthlyExpensesSection: always editable, also with a branch selected.
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import VndMoneyInput from '@/components/rental/shared/VndMoneyInput';
import { EXPENSE_CONTROLS } from '@/lib/listing-fields';
import { newCustomFee, type CustomMonthlyFee, type MonthlyExpensesData } from '@/lib/listing-form';
import { customFeeUnit, type ListingChargeRequest } from '@/lib/listing-payload';

import { RemoveButton, Section, SelectField, TextField, type SectionProps } from './ui';

export default function ExpensesSection({
  state,
  update,
  storedCharges,
}: SectionProps & {
  /** Edit / duplicate: the loaded fees keep their billing method. */
  storedCharges?: ListingChargeRequest[];
}) {
  const data = state.monthlyExpenses;
  const set = (change: (data: MonthlyExpensesData) => Partial<MonthlyExpensesData>) =>
    update((s) => ({
      ...s,
      monthlyExpenses: { ...s.monthlyExpenses, ...change(s.monthlyExpenses) },
    }));
  const setFee = (id: string, patch: Partial<CustomMonthlyFee>) =>
    set((d) => ({
      customFees: d.customFees.map((fee) => (fee.id === id ? { ...fee, ...patch } : fee)),
    }));

  return (
    <Section title="Chi phí hàng tháng" description="Điện, nước và các phí dịch vụ đi kèm.">
      {EXPENSE_CONTROLS.filter(
        (control) => !control.apartmentOnly || state.basicInfo.category === 'apartment'
      ).map((control) => {
        const type = String(data[control.typeKey]);
        const option = control.options.find((item) => item.value === type);
        return (
          <View
            key={control.typeKey}
            className="gap-2 rounded-xl border border-border bg-background p-3">
            <SelectField
              label={control.label}
              value={type}
              options={control.options}
              onChange={(value) => set(() => ({ [control.typeKey]: value }))}
            />
            {option?.unit ? (
              <VndMoneyInput
                label={`Đơn giá (${option.unit})`}
                ariaLabel={`${control.label} (${option.unit})`}
                value={data[control.priceKey]}
                placeholder={control.placeholder}
                onValueChange={(value) => set(() => ({ [control.priceKey]: value }))}
              />
            ) : (
              <Text className="text-sm text-muted-foreground">{option?.note}</Text>
            )}
          </View>
        );
      })}
      <View className="gap-3 rounded-xl border border-border bg-background p-3">
        <View>
          <Text className="text-sm font-bold text-foreground">Các khoản phí tùy chỉnh khác</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            Thang máy, hồ bơi, giặt ủi... (nếu có)
          </Text>
        </View>
        {data.customFees.map((fee, index) => (
          <View key={fee.id} className="gap-2 rounded-xl border border-border bg-surface p-3">
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <TextField
                  ariaLabel={`Tên khoản phí ${index + 1}`}
                  value={fee.name}
                  onChangeText={(name) => setFee(fee.id, { name })}
                  placeholder="Tên khoản phí (VD: Thang máy)"
                />
              </View>
              <RemoveButton
                label={`Xóa khoản phí ${index + 1}`}
                onPress={() =>
                  set((d) => ({ customFees: d.customFees.filter((item) => item.id !== fee.id) }))
                }
              />
            </View>
            <VndMoneyInput
              ariaLabel={`Số tiền khoản phí ${index + 1} (${customFeeUnit(fee, storedCharges)})`}
              value={fee.amount}
              placeholder="Số tiền"
              hint={customFeeUnit(fee, storedCharges)}
              onValueChange={(amount) => setFee(fee.id, { amount })}
            />
          </View>
        ))}
        <ActionButton
          label="Thêm khoản phí"
          icon="add"
          variant="secondary"
          onClick={() => {
            const fee = newCustomFee();
            set((d) => ({ customFees: [...d.customFees, fee] }));
          }}
        />
      </View>
    </Section>
  );
}
