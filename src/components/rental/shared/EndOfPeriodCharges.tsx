// Mobile counterpart of hs-web-app components/rental-request/EndOfPeriodCharges.tsx.
import { Text, View } from 'react-native';

import {
  formatExcludedChargeValue,
  formatVND,
  partitionExcludedCharges,
  partitionPredictableCharges,
} from '@/lib/rental/rental-request.helper';
import type { ExcludedChargeItem, PredictableChargeItem } from '@/types/rental/rental-request.type';

import Accordion from './Accordion';
import InfoRow from './InfoRow';

const NOTE = 'text-sm leading-6 text-muted-foreground';
const HEADING = 'text-sm font-semibold text-foreground';

export default function EndOfPeriodCharges({
  predictableCharges,
  excludedCharges,
  prepaidFees = 0,
}: {
  predictableCharges?: PredictableChargeItem[] | null;
  excludedCharges?: ExcludedChargeItem[] | null;
  prepaidFees?: number;
}) {
  const { payableCharges } = partitionPredictableCharges(predictableCharges ?? []);
  const fixedCharges = payableCharges.filter((charge) => charge.amount > 0);
  const { meteredCharges, negotiableOrCustomCharges } = partitionExcludedCharges(
    excludedCharges ?? []
  );

  return (
    <Accordion title="Phí dịch vụ và điện/nước tính cuối kỳ" icon="receipt-outline">
      <View className="gap-3">
        <Text className={NOTE}>
          Những khoản dưới đây{' '}
          <Text className="font-bold text-foreground">không nằm trong tổng thanh toán ban đầu</Text>
          . Chủ nhà sẽ quyết toán sau kỳ thuê theo hợp đồng và mức sử dụng thực tế.
        </Text>
        {fixedCharges.length > 0 ? (
          <View>
            <Text className={HEADING}>Phí cố định theo bài đăng</Text>
            {fixedCharges.map((charge, index) => (
              <InfoRow
                key={`${charge.chargeType}-${index}`}
                label={charge.displayName}
                value={`${formatVND(charge.amount)}/tháng`}
              />
            ))}
          </View>
        ) : null}
        {meteredCharges.length > 0 ? (
          <View>
            <Text className={HEADING}>Theo sử dụng thực tế</Text>
            {meteredCharges.map((charge, index) => (
              <InfoRow
                key={`${charge.chargeType}-${index}`}
                label={charge.displayName}
                value={formatExcludedChargeValue(charge)}
              />
            ))}
          </View>
        ) : null}
        {negotiableOrCustomCharges.length > 0 ? (
          <Text className={NOTE}>
            Các khoản cần thỏa thuận hoặc tự thanh toán sẽ được hai bên xác nhận riêng.
          </Text>
        ) : null}
        {prepaidFees > 0 ? (
          <Text className={NOTE}>
            Yêu cầu cũ đã trả trước {formatVND(prepaidFees)} tiền phí; khoản này sẽ không bị thu
            lại.
          </Text>
        ) : null}
        <Text className={NOTE}>
          Chi phí phát sinh chưa biết trước sẽ chỉ được tính khi có thực tế và được ghi rõ trên hóa
          đơn cuối kỳ.
        </Text>
      </View>
    </Accordion>
  );
}
