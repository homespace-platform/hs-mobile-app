import { useEffect } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Icon from '@/components/Icon';

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => handler.remove();
  }, [onBack]);
  return (
    <View className="flex-row items-center border-b border-border bg-surface px-4 py-3">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        className="mr-3 h-11 w-11 items-center justify-center">
        <Icon name="chevron-back" size={25} className="text-foreground" />
      </Pressable>
      <Text accessibilityRole="header" className="flex-1 text-lg font-bold text-foreground">
        {title}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  busy,
  disabled,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(busy || disabled), busy: Boolean(busy) }}
      className={`mt-3 min-h-12 flex-row items-center justify-center rounded-xl px-4 py-3 ${busy || disabled ? 'bg-disabled' : danger ? 'bg-danger-soft' : 'bg-brand'}`}>
      {busy ? <ActivityIndicator className="mr-2 text-on-disabled" /> : null}
      <Text
        className={`text-center text-sm font-bold ${busy || disabled ? 'text-on-disabled' : danger ? 'text-danger' : 'text-on-brand'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ErrorNotice({ message }: { message: string | null }) {
  return message ? (
    <Text
      accessibilityRole="alert"
      className="my-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">
      {message}
    </Text>
  ) : null;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm font-semibold text-secondary">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        {...props}
        className="rounded-xl border border-border bg-surface px-4 py-3 text-foreground selection:text-primary placeholder:text-subtle"
      />
    </View>
  );
}
