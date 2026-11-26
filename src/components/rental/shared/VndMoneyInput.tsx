// Mobile counterpart of hs-web-app components/ui/vnd-money-input.tsx.
import { useContext, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { canonicalVnd, formatVndInput, vndSuggestions } from '@/lib/rental/vnd-input';

import FieldFrame, { FieldTextColor, inputBoxClass, inputTextClass } from './FieldFrame';
import { editVndText, vndRangeError, type TextSelection } from './logic';

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
  error: formError,
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
  /** The form's own validation message; the input's range check takes precedence. */
  error?: string | null;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [edited, setEdited] = useState(false);
  const [inputError, setInputError] = useState('');
  const textColor = useContext(FieldTextColor);
  const tracked = useRef<
    { display: string; selections: TextSelection[]; confirmed: boolean } | undefined
  >(undefined);
  const pending = useRef<{ text: string; selection: TextSelection } | undefined>(undefined);
  const [restored, setRestored] = useState<{ display: string; selection: TextSelection }>();
  const raw = canonicalVnd(value);
  const display = formatVndInput(value);
  const ownError = inputError || vndRangeError(value, min, max);
  const error = ownError || formError;
  const suggestions = focused && edited && !disabled && !ownError ? vndSuggestions(raw, max) : [];

  return (
    <FieldFrame label={label} hint={hint} error={error} className={className}>
      <View className={inputBoxClass(Boolean(error), disabled)}>
        <TextInput
          value={display}
          selection={restored?.display === display ? restored.selection : undefined}
          onSelectionChange={({ nativeEvent }) => {
            // Fabric iOS sends the text snapshot with selection, including before onChange.
            const { selection, text } = nativeEvent as typeof nativeEvent & { text?: string };
            if (text !== undefined && text !== display) {
              pending.current = { text, selection };
              return;
            }
            setRestored(undefined);
            const history = tracked.current?.display === display ? tracked.current.selections : [];
            const last = history[history.length - 1];
            if (last?.start === selection.start && last.end === selection.end) {
              if (text !== undefined && tracked.current) tracked.current.confirmed = true;
              return;
            }
            tracked.current = {
              display,
              selections: text === undefined ? [...history.slice(-1), selection] : [selection],
              confirmed: text !== undefined,
            };
          }}
          onChangeText={(text) => {
            const before = tracked.current?.display === display ? tracked.current : undefined;
            const selections = before?.selections ?? [];
            const after = pending.current?.text === text ? pending.current.selection : undefined;
            pending.current = undefined;
            const result = editVndText(display, text, selections, after, before?.confirmed);
            if ('error' in result) {
              const previous = selections[selections.length - 1];
              if (previous) {
                tracked.current = { display, selections: [previous], confirmed: false };
                setRestored({ display, selection: previous });
              }
              return setInputError(result.error);
            }
            const formatted = formatVndInput(result.value);
            const selection = { start: result.caret, end: result.caret };
            tracked.current = { display: formatted, selections: [selection], confirmed: false };
            setRestored({ display: formatted, selection });
            setInputError('');
            setEdited(true);
            onValueChange(result.value);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            pending.current = undefined;
            setFocused(false);
          }}
          editable={!disabled}
          keyboardType="number-pad"
          autoComplete="off"
          placeholder={placeholder}
          accessibilityLabel={ariaLabel ?? label}
          className={inputTextClass(disabled, textColor)}
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
                  tracked.current = undefined;
                  pending.current = undefined;
                  setRestored(undefined);
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
