import { Anchor } from '@/components/rental/contract/anchors';
import VndMoneyInput from '@/components/rental/shared/VndMoneyInput';
import {
  DEPOSIT_TYPES,
  PAYMENT_CYCLES,
  PRICE_UNITS_BY_CATEGORY,
  type PricingData,
} from '@/lib/listing-form';

import { CheckRow, IntegerField, Section, SelectField, type SectionProps } from './ui';

// The web has no price ceiling; the shared input needs one.
const MAX_PRICE = 1_000_000_000_000;

const spelled = (value: unknown) => {
  const amount = Number(value);
  return amount && Number.isFinite(amount)
    ? `Bằng chữ số: ${new Intl.NumberFormat('vi-VN').format(amount)} ₫`
    : undefined;
};

export default function PricingSection({ state, update, errors }: SectionProps) {
  const data = state.pricing;
  const set = (patch: Partial<PricingData>) =>
    update((s) => ({ ...s, pricing: { ...s.pricing, ...patch } }));

  return (
    <Section title="Giá & Điều kiện thuê" description="Giá thuê, tiền cọc và điều kiện hợp đồng.">
      <Anchor id="priceMonthly">
        <VndMoneyInput
          label="Giá thuê *"
          value={data.priceMonthly}
          max={MAX_PRICE}
          placeholder="Ví dụ: 12.000.000"
          hint={spelled(data.priceMonthly) ?? 'Nhập số tiền bằng VNĐ.'}
          error={errors.priceMonthly}
          onValueChange={(priceMonthly) => set({ priceMonthly })}
        />
      </Anchor>
      <SelectField
        label="Đơn vị tính giá *"
        value={data.priceUnit}
        options={PRICE_UNITS_BY_CATEGORY[state.basicInfo.category]}
        onChange={(priceUnit) => set({ priceUnit })}
      />
      <SelectField
        label="Quy định tiền cọc *"
        value={data.depositType}
        options={DEPOSIT_TYPES}
        onChange={(value) => set({ depositType: value as PricingData['depositType'] })}
      />
      {data.depositType === 'AMOUNT' ? (
        <Anchor id="depositAmount">
          <VndMoneyInput
            label="Số tiền cọc (VNĐ) *"
            value={data.depositAmount}
            max={MAX_PRICE}
            placeholder="Ví dụ: 24.000.000"
            hint={spelled(data.depositAmount)}
            error={errors.depositAmount}
            onValueChange={(depositAmount) => set({ depositAmount })}
          />
        </Anchor>
      ) : null}
      {data.depositType === 'MONTHS' ? (
        <Anchor id="depositMonths">
          <IntegerField
            label="Số tháng tiền cọc *"
            value={data.depositMonths}
            suffix="tháng"
            placeholder="Ví dụ: 1 hoặc 2 tháng (số nguyên)"
            error={errors.depositMonths}
            onValueChange={(depositMonths) => set({ depositMonths })}
          />
        </Anchor>
      ) : null}
      <SelectField
        label="Chu kỳ thanh toán *"
        value={data.paymentCycle}
        options={PAYMENT_CYCLES}
        onChange={(value) => set({ paymentCycle: value as PricingData['paymentCycle'] })}
      />
      <Anchor id="minimumLeaseMonths">
        <IntegerField
          label="Thời hạn thuê tối thiểu *"
          value={data.minimumLeaseMonths}
          suffix="tháng"
          placeholder="Ví dụ: 6 hoặc 12"
          error={errors.minimumLeaseMonths}
          onValueChange={(minimumLeaseMonths) => set({ minimumLeaseMonths })}
        />
      </Anchor>
      <CheckRow
        label="Thương lượng"
        checked={data.isNegotiable}
        onPress={() => set({ isNegotiable: !data.isNegotiable })}
      />
    </Section>
  );
}
