// Web components/contract/detail/MeterReading.tsx.
import { Text, View } from 'react-native';

import DecimalInput from '@/components/rental/shared/DecimalInput';
import { toneParts } from '@/components/rental/shared/logic';
import { consumption, format, type Reading } from '@/lib/rental/MeterReading';

import { ToneBox } from './common';

type Kind = { name: 'điện' | 'nước'; unit: 'kWh' | 'm³' };

export function MeterReadingInput({
  name,
  unit,
  start,
  end,
  onChange,
  variant = 'period',
  disabled,
}: Kind & {
  start: Reading;
  /** Web form ("12.5"); the keyboard's "," is shown and converted by DecimalInput. */
  end: string;
  onChange: (value: string) => void;
  variant?: 'period' | 'supplement';
  disabled?: boolean;
}) {
  // A lone "." is not a reading yet.
  const used = consumption(start, end === '.' ? '' : end);
  const supplement = variant === 'supplement';
  const tone = used != null && used <= 0 ? 'warning' : 'info';
  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-3">
      <Text className="text-sm font-bold text-foreground">Công tơ {name}</Text>
      <View className="gap-1 rounded-xl bg-muted p-3">
        <Text className="text-sm text-muted-foreground">
          Chỉ số {name} {supplement ? 'đã tính trên hóa đơn' : 'đầu kỳ'} ({unit})
        </Text>
        <Text className="text-lg font-bold text-foreground">{format(start)}</Text>
        <Text className="text-xs leading-5 text-muted-foreground">
          {supplement
            ? 'Số đã tính trên hóa đơn gần nhất, không thu lại phần này.'
            : 'Số đã ghi nhận từ đầu kỳ, không cần nhập lại.'}
        </Text>
      </View>
      <DecimalInput
        label={`Chỉ số ${name} ${supplement ? 'hiện tại' : 'cuối kỳ'} (${unit})`}
        value={end}
        onValueChange={onChange}
        suffix={unit}
        placeholder="Nhập số trên công tơ"
        disabled={disabled}
        hint={
          supplement
            ? 'Nhập số công tơ thực tế hiện tại, không nhập lượng cần thu bổ sung.'
            : 'Nhập số đang hiển thị trên công tơ cuối kỳ, không nhập lượng đã dùng.'
        }
      />
      <ToneBox tone={tone} alert>
        <Text className={`text-sm leading-6 ${toneParts(tone).text}`}>
          {used == null ? (
            supplement ? (
              'Lượng bổ sung = chỉ số hiện tại − chỉ số đã tính trên hóa đơn.'
            ) : (
              'Lượng sử dụng = chỉ số cuối kỳ − chỉ số đầu kỳ.'
            )
          ) : used < 0 ? (
            supplement ? (
              'Chỉ số mới không được thấp hơn chỉ số đã tính trên hóa đơn.'
            ) : (
              'Chỉ số cuối kỳ không được thấp hơn chỉ số đầu kỳ.'
            )
          ) : (
            <>
              {supplement ? 'Lượng bổ sung' : 'Lượng sử dụng'}: {format(end)} − {format(start)} ={' '}
              <Text className="font-bold">
                {format(used)} {unit}
              </Text>
              .
              {used === 0
                ? supplement
                  ? ' Không có lượng điện/nước bổ sung cần thu.'
                  : ' Hai chỉ số bằng nhau nên tiền tiêu thụ bằng 0. Hãy kiểm tra lại trước khi phát hành.'
                : null}
            </>
          )}
        </Text>
      </ToneBox>
    </View>
  );
}

export function MeterReadingSummary({
  start,
  end,
  quantity,
  unit,
}: {
  start: Reading;
  end: Reading;
  quantity: number;
  unit: Kind['unit'];
}) {
  return (
    <Text className="mt-1 text-sm leading-6 text-muted-foreground">
      Chỉ số đầu kỳ: {format(start)} {unit} · Chỉ số cuối kỳ: {format(end)} {unit} · Đã dùng:{' '}
      {format(quantity)} {unit}
    </Text>
  );
}
