// Web: components/contract/detail/AmendmentEffectiveDatePicker.tsx. Dates stay local "yyyy-MM-dd"
// keys (fromDateKey/toDateKey), never UTC instants: a billing boundary must not shift.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import AppCalendar from '@/components/appointment/AppCalendar';
import Icon from '@/components/Icon';
import { inputBoxClass } from '@/components/rental/shared/FieldFrame';
import { fromDateKey, toDateKey } from '@/components/rental/shared/logic';
import ModalShell from '@/components/rental/shared/ModalShell';
import { amendmentDate } from '@/lib/rental/ContractAmendmentWorkspace';

export default function AmendmentEffectiveDatePicker({
  availableDates,
  value,
  onChange,
  disabled,
}: {
  availableDates: string[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dates = [...new Set(availableDates)].sort();
  const allowed = new Set(dates);
  const chosen = allowed.has(value);
  const off = disabled || !dates.length;
  const shown = chosen ? `${amendmentDate(value)} · Đầu kỳ thuê` : 'Chọn ngày trên lịch…';

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-secondary">Thời điểm áp dụng</Text>
      <Text className="text-xs leading-5 text-muted-foreground">
        Mọi điều chỉnh chỉ áp dụng từ đầu kỳ thuê tương lai, sau khi hai bên ký đủ.
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={`Ngày dự kiến áp dụng: ${shown}`}
        accessibilityState={{ disabled: off, expanded: open }}
        className={`justify-between gap-3 ${inputBoxClass(false, off)}`}>
        <Text className="flex-1 text-base text-foreground">{shown}</Text>
        <Icon name="calendar-outline" size={20} className="text-primary" />
      </Pressable>
      <Text className="text-xs leading-5 text-muted-foreground">
        {dates.length
          ? `Chỉ chọn ngày đầu chu kỳ còn hợp lệ: ${dates.map(amendmentDate).join(', ')}.`
          : 'Không còn đầu kỳ hợp lệ trong thời hạn hợp đồng. Không thể đổi giá/phí cho kỳ đã chốt hóa đơn.'}
      </Text>
      {open && dates.length ? (
        <ModalShell
          title="Chọn ngày đầu kỳ áp dụng"
          closeLabel="Đóng lịch"
          onClose={() => setOpen(false)}>
          <View className="gap-4">
            <Text className="text-sm leading-6 text-muted-foreground">
              Chỉ ngày được tô nổi bật mới có thể chọn. Ngày khác, kỳ đã chốt và ngày ngoài thời hạn
              thuê đều bị khóa.
            </Text>
            <AppCalendar
              selected={fromDateKey(chosen ? value : '')}
              // The button is off without dates. Opens on the chosen month, else the first one.
              range={{ start: fromDateKey(dates[0])!, end: fromDateKey(dates[dates.length - 1])! }}
              disabled={(day) => disabled || !allowed.has(toDateKey(day))}
              onSelect={(day) => {
                const key = toDateKey(day);
                if (!allowed.has(key)) return;
                onChange(key);
                setOpen(false);
              }}
            />
            <Text className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              Ngày này là đầu chu kỳ thuê, không phải ngày 01 hằng tháng. Hệ thống không cho chọn
              tùy ý giữa kỳ.
            </Text>
          </View>
        </ModalShell>
      ) : null}
    </View>
  );
}
