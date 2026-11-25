// Date picker field (web <input type="date"> and the Calendar popover): AppCalendar in a sheet.
import { useCallback, useContext, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppCalendar from '@/components/appointment/AppCalendar';
import Icon from '@/components/Icon';

import ActionButton from './ActionButton';
import FieldFrame, { FieldTextColor, inputBoxClass } from './FieldFrame';
import { dateKeyLabel, fromDateKey, isDateKeyInRange, toDateKey } from './logic';

export default function DateField({
  label,
  ariaLabel,
  value,
  onChange,
  min,
  max,
  isDateDisabled,
  onlyAvailable,
  placeholder = 'Chọn ngày',
  disabled,
  hint,
  error,
  className,
}: {
  label?: string;
  ariaLabel?: string;
  /** "yyyy-MM-dd" or "". */
  value: string;
  onChange: (value: string) => void;
  /** Inclusive "yyyy-MM-dd" bounds. */
  min?: string;
  max?: string;
  /** Extra rule, e.g. only the dates in a server list. */
  isDateDisabled?: (key: string) => boolean;
  /** Needs `min` and `max`: AppCalendar `range` (highlighted days, months limited to min..max). */
  onlyAvailable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
}) {
  const insets = useSafeAreaInsets();
  const textColor = useContext(FieldTextColor);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const shown = dateKeyLabel(value);
  const name = ariaLabel ?? label ?? placeholder;
  const start = fromDateKey(min);
  const end = fromDateKey(max);
  const unavailable = useCallback(
    (date: Date) => {
      const key = toDateKey(date);
      return !isDateKeyInRange(key, min, max) || Boolean(isDateDisabled?.(key));
    },
    [min, max, isDateDisabled]
  );

  return (
    <FieldFrame label={label} hint={hint} error={error} className={className}>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${name}: ${shown || placeholder}`}
        accessibilityState={{ disabled: Boolean(disabled), expanded: open }}
        className={`justify-between ${inputBoxClass(Boolean(error), disabled)}`}>
        <Text
          className={`text-base ${shown ? (textColor ?? (disabled ? 'text-subtle' : 'text-foreground')) : 'text-subtle'}`}>
          {shown || placeholder}
        </Text>
        <Icon name="calendar-outline" size={20} className="text-muted-foreground" />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={close}>
        <View className="flex-1 justify-end bg-overlay/65">
          <Pressable
            onPress={close}
            accessible={false}
            importantForAccessibility="no"
            className="flex-1"
          />
          <View
            accessibilityViewIsModal
            className="gap-3 rounded-t-3xl border border-border bg-surface px-4 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <Text accessibilityRole="header" className="text-base font-bold text-foreground">
              {name}
            </Text>
            <AppCalendar
              selected={fromDateKey(value)}
              minDate={start}
              range={onlyAvailable && start && end ? { start, end } : undefined}
              disabled={unavailable}
              onSelect={(date) => {
                onChange(toDateKey(date));
                close();
              }}
            />
            <ActionButton label="Đóng" variant="secondary" onClick={close} />
          </View>
        </View>
      </Modal>
    </FieldFrame>
  );
}
