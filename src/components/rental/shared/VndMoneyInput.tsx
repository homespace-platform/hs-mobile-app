// Mobile counterpart of hs-web-app components/ui/vnd-money-input.tsx.
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { canonicalVnd, formatVndInput, vndSuggestions } from '@/lib/rental/vnd-input';

import FieldFrame, { inputBoxClass, inputTextClass } from './FieldFrame';
import { editVndText, vndRangeError } from './logic';

export default function VndMoneyInput({
  label,
  ariaLabel,
  value,
  onValueChange,
  disabled,
  min = 0,
  max = 1_000_000_000,
  placeholder = 'Nhập số tiền',
  hint,
  className,
}: {
  label?: string;
  ariaLabel?: string;
  value: unknown;
  /** Plain digits ("1500000"), or "". */
  onValueChange: (value: string) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [edited, setEdited] = useState(false);
  const [inputError, setInputError] = useState('');
  const raw = canonicalVnd(value);
  const display = formatVndInput(value);
  const error = inputError || vndRangeError(value, min, max);
  const suggestions = focused && edited && !disabled && !error ? vndSuggestions(raw, max) : [];

  return (
    <FieldFrame label={label} hint={hint} error={error} className={className}>
      <View className={inputBoxClass(Boolean(error), disabled)}>
        <TextInput
          value={display}
          onChangeText={(text) => {
            const result = editVndText(display, text);
            if ('error' in result) return setInputError(result.error);
            setInputError('');
            setEdited(true);
            onValueChange(result.value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!disabled}
          keyboardType="number-pad"
          autoComplete="off"
          placeholder={placeholder}
          accessibilityLabel={ariaLabel ?? label}
          className={inputTextClass(disabled)}
        />
        <Text className="ml-2 text-sm text-muted-foreground">đ</Text>
      </View>
      {suggestions.length > 0 ? (
        // The surrounding ScrollView needs keyboardShouldPersistTaps="handled" (ModalShell has it).
        <View className="mt-2 rounded-xl border border-border bg-muted p-2">
          <Text className="mb-1.5 text-xs text-muted-foreground">
            Chọn nhanh số tiền · Không tự cộng thêm số 0
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((amount) => (
              <Pressable
                key={amount}
                onPress={() => {
                  onValueChange(amount);
                  setInputError('');
                  setEdited(false);
                }}
                accessibilityRole="button"
                className="min-h-11 justify-center rounded-lg border border-border bg-surface px-3 active:bg-primary-soft">
                <Text className="text-sm font-semibold text-primary">
                  {formatVndInput(amount)} đ
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </FieldFrame>
  );
}
