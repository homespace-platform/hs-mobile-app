// Small device pieces shared by the onboarding components.
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { toneParts } from '@/components/rental/shared/logic';
import type { Tone } from '@/lib/rental/rental-labels';
import { getUserProfileApi } from '@/services/userApi';

import type { Notify } from './logic';

/** The web's `toast`: the app dialog, which also shows above an open ModalShell. */
export function useToast(): Notify {
  const show = useDialog();
  return useMemo(
    () => ({
      success: (message: string) => show('Thông báo', message, undefined, 'success'),
      info: (message: string) => show('Thông báo', message),
      error: (message: string) => show('Thông báo', message),
    }),
    [show]
  );
}

/** Web `useAuth().userId` (the profile id of the signed-in user). */
export const myUserId = async () => (await getUserProfileApi()).id;

/** Web `window.open(url)` for short-lived storage links. */
export async function openUrl(url: string) {
  await WebBrowser.openBrowserAsync(url);
}

/** A toned box with a plain message (web `rounded border p-3` with toneClasses). */
export function ToneBox({
  tone,
  children,
  alert = false,
}: {
  tone: Tone;
  /** A string, or elements. */
  children: React.ReactNode;
  alert?: boolean;
}) {
  const parts = toneParts(tone);
  return (
    <View
      accessibilityRole={alert ? 'alert' : undefined}
      accessibilityLiveRegion={alert ? 'polite' : undefined}
      className={`gap-2 rounded-2xl border p-3 ${parts.box}`}>
      {typeof children === 'string' ? (
        <Text className={`text-sm leading-6 ${parts.text}`}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      className={`min-h-11 flex-row items-start gap-3 py-1 ${disabled ? 'opacity-50' : ''}`}>
      <Icon
        name={checked ? 'checkbox' : 'square-outline'}
        size={24}
        className={checked ? 'text-primary' : 'text-muted-foreground'}
      />
      <Text className="flex-1 text-sm leading-6 text-foreground">{label}</Text>
    </Pressable>
  );
}

/** One of several choices (web `aria-pressed` buttons): the chosen one is announced as selected. */
export function ChoiceButton({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      className={`min-h-12 flex-row items-center gap-2 rounded-xl border px-4 py-3 active:opacity-80 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'} ${disabled ? 'opacity-50' : ''}`}>
      <Icon
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={18}
        className={selected ? 'text-primary' : 'text-muted-foreground'}
      />
      <Text className={`flex-1 text-sm font-bold ${selected ? 'text-primary' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
