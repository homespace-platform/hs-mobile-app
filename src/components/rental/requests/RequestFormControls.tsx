// Small controls of the request form: section label, stepper button and a boxed number input.
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import Icon from '@/components/Icon';
import { inputBoxClass, inputTextClass } from '@/components/rental/shared/FieldFrame';

export function FormLabel({
  icon,
  title,
  required,
  aside,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  title: string;
  required?: boolean;
  aside?: string;
}) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <View className="shrink flex-row items-center gap-1.5">
        <Icon name={icon} size={16} className="text-primary" />
        <Text className="shrink text-sm font-semibold text-foreground">
          {title}
          {required ? <Text className="text-danger"> *</Text> : null}
        </Text>
      </View>
      {aside ? <Text className="text-xs text-muted-foreground">{aside}</Text> : null}
    </View>
  );
}

export function StepButton({
  text,
  label,
  disabled,
  onPress,
}: {
  text: string;
  /** Spoken name (the web button's title). */
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={`min-h-12 min-w-11 items-center justify-center rounded-xl border border-border bg-surface px-2.5 active:bg-muted ${disabled ? 'opacity-40' : ''}`}>
      <Text className="text-sm font-bold text-foreground">{text}</Text>
    </Pressable>
  );
}

export function SuffixInput({
  suffix,
  children,
  className = 'flex-1',
  ...props
}: TextInputProps & { suffix?: string; children?: ReactNode; className?: string }) {
  return (
    <View className={`${inputBoxClass(false)} gap-2 ${className}`}>
      {children}
      <TextInput {...props} className={inputTextClass()} />
      {suffix ? <Text className="text-xs text-muted-foreground">{suffix}</Text> : null}
    </View>
  );
}
