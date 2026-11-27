// Web components/membership/PaymentProviderPicker; shared by the plan and extra-use checkouts.
import { Pressable, Text, View } from 'react-native';

import { MOBILE_ETH_DISABLED_MESSAGE, MOBILE_ETH_PAYMENT_ENABLED } from '@/lib/membership';
import type { MembershipPaymentMethod } from '@/services/membershipApi';

const PROVIDERS = [
  {
    code: 'SEPAY',
    label: 'SePay (Cổng thanh toán & Chuyển khoản QR)',
    badge: 'Đang hỗ trợ',
    description:
      'Thanh toán trực tuyến an toàn qua cổng SePay. Tự động kích hoạt đơn sau khi máy chủ xác nhận giao dịch.',
  },
  {
    code: 'ETH',
    label: 'MetaMask (Sepolia ETH)',
    badge: 'Thử nghiệm',
    description:
      'Thanh toán bằng ETH thử nghiệm; hệ thống xác nhận giao dịch trước khi kích hoạt đơn.',
  },
] as const;

export default function PaymentProviderPicker({
  value,
  disabled,
  onChange,
}: {
  value: MembershipPaymentMethod;
  disabled: boolean;
  onChange: (provider: MembershipPaymentMethod) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Chọn cổng thanh toán"
      className="gap-2">
      <Text className="text-sm font-bold text-foreground">Phương thức thanh toán</Text>
      {PROVIDERS.map((option) => {
        const selected = value === option.code;
        const off = option.code === 'ETH' && !MOBILE_ETH_PAYMENT_ENABLED;
        return (
          <Pressable
            key={option.code}
            disabled={disabled || off}
            onPress={() => onChange(option.code)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: disabled || off }}
            className={`min-h-12 flex-row items-start gap-3 rounded-2xl border-2 p-3 ${selected ? 'border-primary bg-primary-soft' : off ? 'border-border bg-muted' : 'border-border bg-surface'}`}>
            <View
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-primary' : 'border-border-strong'}`}>
              {selected ? <View className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
            </View>
            <View className="flex-1 gap-1">
              <Text
                className={`text-sm font-bold ${off ? 'text-muted-foreground' : 'text-foreground'}`}>
                {option.label}
              </Text>
              <Text className="text-xs font-semibold text-secondary">
                {off ? MOBILE_ETH_DISABLED_MESSAGE : option.badge}
              </Text>
              {off ? null : (
                <Text className="text-xs leading-5 text-secondary">{option.description}</Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
