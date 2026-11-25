// Web: components/contract/detail/ContractMissingFieldsNotice.tsx.
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import type { InitialMeterField } from '@/lib/rental/contract-initial-meters';
import type { ContractCompletenessResponse } from '@/types/rental/contract.type';

import { missingFieldsSummary } from './contractDetailLogic';

const line = 'text-sm leading-6 text-warning';

export default function ContractMissingFieldsNotice({
  completeness,
  isLandlord,
  meterFields,
  hasLandlordPhone,
  onOpenKyc,
}: {
  completeness: ContractCompletenessResponse | null;
  isLandlord: boolean;
  meterFields?: InitialMeterField[];
  hasLandlordPhone?: boolean;
  /** Web link /settings/account-security; the screen asks about unsaved input first. */
  onOpenKyc: () => void;
}) {
  const summary = missingFieldsSummary({
    completeness,
    isLandlord,
    meterFields,
    hasLandlordPhone,
  });
  if (summary.count === 0) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row items-start gap-3 rounded-2xl border border-warning bg-warning-soft p-4">
      <Icon name="warning-outline" size={20} className="text-warning" />
      <View className="flex-1 gap-1">
        <Text className="text-sm font-bold leading-6 text-warning">
          Hợp đồng còn {summary.count} thông tin bắt buộc chưa có dữ liệu
        </Text>
        {summary.filled !== null ? (
          <Text className={line}>
            Đã điền {summary.filled}/{summary.total} trường.
          </Text>
        ) : null}
        <Text className={line}>
          {summary.hasMeterEditor
            ? isLandlord
              ? 'Vui lòng nhập chỉ số thực tế vào các ô bên dưới. Số 0 là hợp lệ. Chọn Lưu sau khi đã rà soát bản nháp.'
              : 'Chủ nhà cần bổ sung và lưu chỉ số công tơ ban đầu trước khi kết xuất, ký hợp đồng. Người thuê vui lòng kiểm tra chỉ số thực tế cùng chủ nhà.'
            : 'Vui lòng bổ sung thông tin còn thiếu trước khi kết xuất và gửi hợp đồng.'}
        </Text>
        {summary.listed.length > 0 ? (
          <View>
            {summary.hasMeterEditor ? (
              <Text className="pt-1 text-xs font-semibold text-warning">
                Thông tin khác cần bổ sung:
              </Text>
            ) : null}
            {summary.listed.slice(0, 6).map((field) => (
              <Text key={field.key} className={line}>
                • {field.label}
              </Text>
            ))}
            {summary.listed.length > 6 ? (
              <Text className={line}>• … và {summary.listed.length - 6} trường khác</Text>
            ) : null}
          </View>
        ) : null}
        {summary.kycLink ? (
          <Pressable
            onPress={onOpenKyc}
            accessibilityRole="link"
            className="min-h-11 justify-center self-start">
            <Text className="text-sm font-bold text-warning underline">
              Kiểm tra thông tin KYC đã xác thực
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
