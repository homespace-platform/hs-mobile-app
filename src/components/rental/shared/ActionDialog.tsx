// Mobile counterpart of hs-web-app components/common/ActionDialog.tsx (same hook and strings).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDialogHost } from '@/components/AppDialog';
import Icon from '@/components/Icon';

import ActionButton from './ActionButton';
import { reasonState } from './logic';

export type DialogTone = 'default' | 'warning' | 'danger';

export interface ConfirmOptions {
  title: string;
  /** A string, or ready-made native elements (not bare text inside a View). */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}
export interface ReasonOptions extends ConfirmOptions {
  label?: string;
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
}

const TONES = {
  default: {
    tile: 'bg-primary-soft',
    icon: 'text-primary',
    name: 'information-circle-outline',
    button: 'primary',
  },
  warning: {
    tile: 'bg-warning-soft',
    icon: 'text-warning',
    name: 'warning-outline',
    button: 'warning',
  },
  danger: {
    tile: 'bg-danger-soft',
    icon: 'text-danger',
    name: 'warning-outline',
    button: 'danger',
  },
} as const;

function ActionDialogView({
  reason,
  options,
  onSubmit,
  onCancel,
}: {
  reason: boolean;
  options: ReasonOptions;
  /** The trimmed reason ("" for a confirm). */
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const min = reason ? (options.minLength ?? 10) : 0;
  const max = options.maxLength ?? 500;
  const state = reasonState(text, min, max);
  const tone = TONES[options.tone ?? 'default'];
  const invalid = reason && touched && !state.valid;
  const hintClass = `text-xs ${invalid ? 'font-semibold text-danger' : 'text-muted-foreground'}`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 justify-end bg-overlay/65"
      style={{ paddingTop: insets.top + 12 }}>
      <Pressable
        onPress={onCancel}
        accessible={false}
        importantForAccessibility="no"
        className="absolute inset-0"
      />
      <View
        accessibilityViewIsModal
        className="max-h-full overflow-hidden rounded-t-3xl border border-border bg-surface">
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          className="shrink"
          contentContainerClassName="px-5 pb-4 pt-5">
          <View className="flex-row items-start gap-3">
            <View className={`h-11 w-11 items-center justify-center rounded-xl ${tone.tile}`}>
              <Icon name={tone.name} size={22} className={tone.icon} />
            </View>
            <View className="flex-1">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                {options.title}
              </Text>
              {typeof options.description === 'string' ? (
                <Text className="mt-1 text-sm leading-6 text-muted-foreground">
                  {options.description}
                </Text>
              ) : options.description ? (
                <View className="mt-1">{options.description}</View>
              ) : null}
            </View>
          </View>
          {reason ? (
            <View className="mt-4">
              <Text className="mb-2 text-sm font-semibold text-foreground">
                {options.label ?? 'Lý do'}
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                onBlur={() => setTouched(true)}
                autoFocus
                multiline
                maxLength={max}
                textAlignVertical="top"
                placeholder={options.placeholder ?? `Nhập ít nhất ${min} ký tự`}
                accessibilityLabel={options.label ?? 'Lý do'}
                accessibilityHint={state.hint}
                className={`max-h-40 min-h-28 rounded-xl border bg-background p-3 text-base text-foreground selection:text-primary placeholder:text-subtle ${invalid ? 'border-danger' : 'border-border'}`}
              />
              <View
                accessibilityLiveRegion="polite"
                className="mt-1 flex-row justify-between gap-2">
                <Text className={`shrink ${hintClass}`}>{state.hint}</Text>
                <Text className={hintClass}>{state.counter}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
        <View
          className="gap-2 border-t border-border px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {/* Not disabled while the reason is short (as on web): pressing explains what is missing. */}
          <ActionButton
            label={options.confirmLabel ?? 'Xác nhận'}
            variant={tone.button}
            className={state.valid ? '' : 'opacity-60'}
            onClick={() => (state.valid ? onSubmit(state.trimmed) : setTouched(true))}
          />
          <ActionButton
            label={options.cancelLabel ?? 'Quay lại'}
            variant="secondary"
            onClick={onCancel}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

let nextId = 0;

/**
 *   const { confirm, askReason, dialog } = useActionDialog();
 *   const reason = await askReason({ title: 'Đề nghị hủy', minLength: 10 }); // string | null
 *   if (await confirm({ title: 'Xác nhận?', tone: 'danger' })) …            // boolean
 * The dialog is drawn by the topmost dialog host, so it also shows over an open ModalShell.
 * `dialog` is always null; it exists so web JSX ports unchanged.
 */
export function useActionDialog() {
  const host = useDialogHost();
  const dismissOpen = useRef<(() => void) | null>(null);
  useEffect(() => () => dismissOpen.current?.(), []);

  const open = useCallback(
    <T,>(reason: boolean, options: ReasonOptions, accepted: (text: string) => T, dismissed: T) =>
      new Promise<T>((resolve) => {
        // A second request dismisses the first so its caller never waits forever.
        dismissOpen.current?.();
        let remove = () => {};
        let settled = false;
        const done = (value: T) => {
          if (settled) return;
          settled = true;
          remove();
          resolve(value);
        };
        const dismiss = () => done(dismissed);
        dismissOpen.current = dismiss;
        remove = host.present({
          node: (
            <ActionDialogView
              key={++nextId}
              reason={reason}
              options={options}
              onSubmit={(text) => done(accepted(text))}
              onCancel={dismiss}
            />
          ),
          onDismiss: dismiss,
        });
      }),
    [host]
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => open<boolean>(false, options, () => true, false),
    [open]
  );
  const askReason = useCallback(
    (options: ReasonOptions) => open<string | null>(true, options, (text) => text, null),
    [open]
  );
  return { confirm, askReason, dialog: null as ReactNode };
}
