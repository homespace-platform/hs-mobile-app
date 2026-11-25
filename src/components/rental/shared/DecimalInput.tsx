// Meter readings and other decimals (web <input type="number" step="0.001">).
import { Text, TextInput, View } from 'react-native';

import FieldFrame, { inputBoxClass, inputTextClass } from './FieldFrame';
import { decimalDraft } from './logic';

export default function DecimalInput({
  label,
  ariaLabel,
  value,
  onValueChange,
  maxDecimals = 3,
  suffix,
  disabled,
  placeholder,
  hint,
  error,
  className,
}: {
  label?: string;
  ariaLabel?: string;
  /** Web form, "12.5". It is shown with the vi-VN comma. May end in "." while being typed. */
  value: string;
  onValueChange: (value: string) => void;
  maxDecimals?: number;
  /** Unit, e.g. "kWh". */
  suffix?: string;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  /** Range checks belong to the caller. */
  error?: string | null;
  className?: string;
}) {
  return (
    <FieldFrame label={label} hint={hint} error={error} className={className}>
      <View className={inputBoxClass(Boolean(error), disabled)}>
        <TextInput
          value={value.replace('.', ',')}
          onChangeText={(text) => {
            const next = decimalDraft(text, maxDecimals);
            if (next !== null) onValueChange(next);
          }}
          editable={!disabled}
          keyboardType="decimal-pad"
          autoComplete="off"
          placeholder={placeholder}
          accessibilityLabel={ariaLabel ?? label}
          className={inputTextClass(disabled)}
        />
        {suffix ? <Text className="ml-2 text-sm text-muted-foreground">{suffix}</Text> : null}
      </View>
    </FieldFrame>
  );
}
