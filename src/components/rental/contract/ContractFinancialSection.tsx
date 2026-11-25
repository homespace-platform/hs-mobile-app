// Web: components/contract/detail/ContractFinancialSection.tsx.
import { View } from 'react-native';

import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import VndMoneyInput from '@/components/rental/shared/VndMoneyInput';
import { isZeroDeposit } from '@/lib/rental/utils';
import type { TermRow } from '@/types/rental/contract-amendment.type';

import { Anchor } from './anchors';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { ContractEditField, FieldRow, NoticeText, Section } from './fields';
import InlineAmendmentFields, {
  BillingSystemRuleLabels,
  ContractTermFields,
} from './InlineAmendmentFields';

export default function ContractFinancialSection({ financial: original }: { financial: TermRow }) {
  const w = useAmendmentWorkspace();
  const financial =
    (w?.editing ? w.listingSync?.terms.financial : undefined) ??
    w?.data?.currentTerms.financial ??
    original;
  const noDeposit = isZeroDeposit(financial.depositAmountValue ?? financial.depositAmountNumber);

  if (w?.editing && w.editingFinancial)
    return (
      <Anchor id="amendment-rent">
        <Section title="Giá thuê định kỳ và tiền đặt cọc">
          <InlineAmendmentFields group="rent" />
          <ContractTermFields
            group="financial"
            fields={[
              [
                'paymentCycle',
                'Kỳ hạn thanh toán',
                false,
                'Hàng tháng, Hàng quý, Hàng năm hoặc Mỗi N tháng (1–12). Phí điện/nước vẫn quyết toán hàng tháng.',
              ],
              ['paymentMethod', 'Phương thức thanh toán'],
              ['depositDescription', 'Điều kiện hoàn cọc'],
            ]}
          />
          <BillingSystemRuleLabels deadlineOnly />
          <ContractEditField group="financial" field="depositAmountValue">
            <VndMoneyInput
              label="Tiền đặt cọc bảo đảm (đ)"
              value={
                w.values.financial.depositAmountValue ??
                String(financial.depositAmountNumber ?? '').replace(/\D/g, '')
              }
              onValueChange={(depositAmountValue) =>
                w.patch('financial', { ...w.values.financial, depositAmountValue })
              }
            />
          </ContractEditField>
          <PolicyNotice
            tone="neutral"
            title="Điều chỉnh tiền cọc"
            summary="Số tiền bằng chữ được tính lại.">
            <NoticeText>
              Số tiền bằng chữ được tính lại. Đổi tiền cọc tạo khoản thu thêm hoặc hoàn phần chênh
              lệch sau khi phụ lục có hiệu lực; không sửa khoản cọc đã thanh toán.
            </NoticeText>
          </PolicyNotice>
        </Section>
      </Anchor>
    );

  return (
    <Anchor id="amendment-rent">
      <Section
        icon="cash-outline"
        title="Giá thuê định kỳ và tiền đặt cọc"
        badge="Giá thuê và cọc theo điều khoản đang áp dụng">
        <View>
          <FieldRow
            editable
            label="Tiền thuê hàng tháng"
            value={financial.amountNumber}
            highlight
          />
          <FieldRow label="Bằng chữ" value={financial.amountWords} />
          <FieldRow editable label="Kỳ hạn thanh toán" value={financial.paymentCycle} />
          <FieldRow label="Hạn đóng tiền định kỳ" value={financial.paymentDueDay} />
          <FieldRow editable label="Phương thức thanh toán" value={financial.paymentMethod} />
          <FieldRow
            editable
            label="Tiền đặt cọc bảo đảm"
            value={financial.depositAmountNumber}
            highlight
          />
          <FieldRow label="Tiền cọc bằng chữ" value={financial.depositAmountWords} />
          <FieldRow
            editable={!noDeposit}
            label={noDeposit ? 'Quy định về tiền cọc' : 'Điều kiện & thời hạn hoàn cọc'}
            value={noDeposit ? 'Không đặt cọc theo điều khoản này.' : financial.depositDescription}
          />
        </View>
      </Section>
    </Anchor>
  );
}
