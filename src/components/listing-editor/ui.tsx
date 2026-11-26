// Field primitives of the listing editor, on top of the shared FieldFrame / ModalShell.
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import Icon from '@/components/Icon';
import FieldFrame, { inputBoxClass, inputTextClass } from '@/components/rental/shared/FieldFrame';
import ModalShell from '@/components/rental/shared/ModalShell';
import type { ListingFormState } from '@/lib/listing-form';
import type { ListingOption } from '@/lib/listing-fields';

export type SectionProps = {
  state: ListingFormState;
  /** Ignored while a save is running. */
  update: (change: (state: ListingFormState) => ListingFormState) => void;
  errors: Record<string, string>;
};

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-4 rounded-2xl border border-border bg-surface p-4">
      <View>
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
          {title}
        </Text>
        {description ? (
          <Text className="mt-1 text-sm leading-5 text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function FieldLabel({ text }: { text: string }) {
  return <Text className="text-sm font-semibold text-secondary">{text}</Text>;
}

export function ErrorText({ message }: { message?: string }) {
  return message ? (
    <Text accessibilityRole="alert" className="text-xs leading-5 text-danger">
      {message}
    </Text>
  ) : null;
}

export function TextField({
  label,
  ariaLabel,
  error,
  hint,
  suffix,
  multiline,
  ...props
}: TextInputProps & {
  label?: string;
  ariaLabel?: string;
  error?: string;
  hint?: string;
  suffix?: string;
}) {
  const disabled = props.editable === false;
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <View className={inputBoxClass(Boolean(error), disabled)}>
        <TextInput
          accessibilityLabel={ariaLabel ?? label}
          {...props}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          className={`${inputTextClass(disabled)} ${multiline ? 'min-h-24' : ''}`}
        />
        {suffix ? <Text className="ml-2 text-sm text-muted-foreground">{suffix}</Text> : null}
      </View>
    </FieldFrame>
  );
}

/** Whole non-negative numbers (counts, floors, months). */
export function IntegerField({
  value,
  onValueChange,
  ...props
}: Omit<Parameters<typeof TextField>[0], 'value' | 'onChangeText'> & {
  value: unknown;
  onValueChange: (value: string) => void;
}) {
  return (
    <TextField
      {...props}
      value={String(value ?? '')}
      onChangeText={(text) => onValueChange(text.replace(/\D/g, ''))}
      keyboardType="number-pad"
    />
  );
}

/** The web <select>: shows the current option, opens a sheet with all of them. */
export function SelectField({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  error,
  hint,
  placeholder = 'Chọn…',
}: {
  label?: string;
  ariaLabel?: string;
  value: string;
  options: readonly ListingOption[];
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const name = ariaLabel ?? label ?? placeholder;
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${name}: ${selected?.label ?? placeholder}`}
        accessibilityState={{ expanded: open }}
        className={`${inputBoxClass(Boolean(error))} gap-2 py-2`}>
        <Text className={`flex-1 text-base ${selected ? 'text-foreground' : 'text-subtle'}`}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size={18} className="text-muted-foreground" />
      </Pressable>
      {open ? (
        <ModalShell title={name} onClose={() => setOpen(false)}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setOpen(false);
                  if (!active) onChange(option.value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                className={`mb-2 min-h-12 flex-row items-center gap-3 rounded-xl border px-4 py-3 ${active ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                <Text
                  className={`flex-1 text-sm ${active ? 'font-bold text-primary' : 'text-foreground'}`}>
                  {option.label}
                </Text>
                {active ? <Icon name="checkmark" size={18} className="text-primary" /> : null}
              </Pressable>
            );
          })}
        </ModalShell>
      ) : null}
    </FieldFrame>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Replaces the checkmark of a selected chip, e.g. "close" for a removable one. */
  icon?: 'close';
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      className={`min-h-11 max-w-full flex-row items-center gap-1.5 rounded-full border px-4 py-2 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
      {selected && !icon ? <Icon name="checkmark" size={16} className="text-primary" /> : null}
      <Text
        className={`shrink text-sm font-semibold ${selected ? 'text-primary' : 'text-secondary'}`}>
        {label}
      </Text>
      {icon ? <Icon name={icon} size={16} className="text-primary" /> : null}
    </Pressable>
  );
}

export function CheckRow({
  label,
  description,
  checked,
  onPress,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className={`min-h-12 flex-row items-center gap-3 rounded-xl border px-3 py-2.5 ${checked ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
      <Icon
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        className={checked ? 'text-primary' : 'text-muted-foreground'}
      />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-xs text-muted-foreground">{description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';
const NOTICE = {
  info: { box: 'border-primary-border bg-primary-soft', text: 'text-primary' },
  success: { box: 'border-success bg-success-soft', text: 'text-success' },
  warning: { box: 'border-warning bg-warning-soft', text: 'text-warning' },
  error: { box: 'border-danger bg-danger-soft', text: 'text-danger' },
};

export function Notice({
  tone = 'info',
  title,
  text,
  children,
  onClose,
}: {
  tone?: NoticeTone;
  title?: string;
  text?: string;
  children?: ReactNode;
  onClose?: () => void;
}) {
  const look = NOTICE[tone];
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`flex-row items-start rounded-xl border p-3 ${look.box}`}>
      <View className="flex-1 gap-1">
        {title ? <Text className={`text-sm font-bold ${look.text}`}>{title}</Text> : null}
        {text ? <Text className={`text-sm leading-5 ${look.text}`}>{text}</Text> : null}
        {children}
      </View>
      {onClose ? (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng thông báo"
          className="-my-2 -mr-2 h-11 w-11 items-center justify-center">
          <Icon name="close" size={18} className={look.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface">
      <Icon name="trash-outline" size={18} className="text-danger" />
    </Pressable>
  );
}
