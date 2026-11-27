// Small pieces shared by the editing screens. Every target is at least 48dp; no icon tiles.
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import Icon from '@/components/Icon';
import ActionButton, { type ActionButtonProps } from '@/components/rental/shared/ActionButton';

import { matchesText } from './logic';

/** The rental button at a full 48dp, quiet unless it is the one main action. */
export function Action({ className = '', variant = 'secondary', ...props }: ActionButtonProps) {
  return <ActionButton {...props} variant={variant} className={`min-h-[48px] ${className}`} />;
}

const NOTES = {
  error: { box: 'border-danger bg-danger-soft', text: 'text-danger', icon: 'alert-circle-outline' },
  warning: { box: 'border-warning bg-warning-soft', text: 'text-warning', icon: 'warning-outline' },
  success: {
    box: 'border-success bg-success-soft',
    text: 'text-success',
    icon: 'checkmark-circle-outline',
  },
} as const;

export function Note({
  tone,
  text,
  children,
}: {
  tone: keyof typeof NOTES;
  text: string | null | undefined;
  children?: ReactNode;
}) {
  if (!text) return null;
  const look = NOTES[tone];
  return (
    <View className={`gap-3 rounded-2xl border p-3 ${look.box}`}>
      <View
        accessible
        accessibilityRole={tone === 'error' ? 'alert' : undefined}
        accessibilityLiveRegion="polite"
        className="flex-row items-start gap-2">
        <Icon name={look.icon} size={18} className={look.text} />
        <Text className={`flex-1 text-sm leading-5 ${look.text}`}>{text}</Text>
      </View>
      {children}
    </View>
  );
}

/** A dashed box with plain words: the empty state. */
export function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-4">
      <Text className="text-sm leading-6 text-muted-foreground">{text}</Text>
      {children}
    </View>
  );
}

export function Heading({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="text-base font-bold text-foreground">
      {children}
    </Text>
  );
}

/** A full-width row to tap: one choice of a list, or the way into the next step. */
export function Row({
  title,
  detail,
  trailing = 'chevron',
  selected,
  expanded,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  detail?: string;
  /** A short verb, or the chevron. */
  trailing?: string;
  /** A radio choice when given. */
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const radio = selected !== undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={radio ? 'radio' : 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: Boolean(disabled),
        ...(radio && { checked: selected }),
        ...(expanded !== undefined && { expanded }),
      }}
      className={`min-h-[52px] flex-row items-center gap-3 rounded-xl border px-3 py-2.5 active:bg-muted ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'} ${disabled ? 'opacity-60' : ''}`}>
      {radio ? (
        <Icon
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          className={selected ? 'text-primary' : 'text-muted-foreground'}
        />
      ) : null}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        {detail ? (
          <Text className="mt-0.5 text-xs leading-5 text-muted-foreground">{detail}</Text>
        ) : null}
      </View>
      {radio || disabled ? null : trailing === 'chevron' ? (
        <Icon
          name={expanded ? 'chevron-up' : expanded === false ? 'chevron-down' : 'chevron-forward'}
          size={18}
          className="text-muted-foreground"
        />
      ) : (
        <Text className="text-sm font-bold text-primary">{trailing}</Text>
      )}
    </Pressable>
  );
}

export function Input({
  label,
  value,
  onChangeText,
  error,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'characters';
  onSubmitEditing?: () => void;
}) {
  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-secondary">{label}</Text>
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        accessibilityLabel={label}
        className={`min-h-[48px] rounded-xl border bg-surface px-3 py-2 text-base text-foreground selection:text-primary placeholder:text-subtle ${error ? 'border-danger' : 'border-border'}`}
      />
      {error ? (
        <Text accessibilityRole="alert" className="mt-1 text-xs leading-5 text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The rooms to choose from, as rows; a search box appears when the list is long. */
export function RoomChoices({
  choices,
  selected,
  disabled,
  onPick,
}: {
  choices: { value: string; label: string }[];
  /** Radio list when given; otherwise tapping a row acts at once. */
  selected?: string;
  disabled?: boolean;
  onPick: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const shown = choices.filter((choice) => matchesText(choice.label, query));
  return (
    <View className="gap-2">
      {choices.length > 8 ? (
        <Input label="Tìm phòng" value={query} onChangeText={setQuery} placeholder="Mã phòng…" />
      ) : null}
      {shown.map((choice) => (
        <Row
          key={choice.value}
          title={choice.label}
          trailing="Chọn"
          selected={selected === undefined ? undefined : selected === choice.value}
          disabled={disabled}
          onPress={() => onPick(choice.value)}
        />
      ))}
      {shown.length === 0 ? <Empty text="Không có phòng nào khớp." /> : null}
    </View>
  );
}

/** `page` is 0-based. */
export function Pager({
  page,
  pages,
  disabled,
  onPage,
}: {
  page: number;
  pages: number;
  disabled?: boolean;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      <Action label="‹ Trước" disabled={disabled || page <= 0} onClick={() => onPage(page - 1)} />
      <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">
        Trang {page + 1}/{pages}
      </Text>
      <Action
        label="Sau ›"
        disabled={disabled || page >= pages - 1}
        onClick={() => onPage(page + 1)}
      />
    </View>
  );
}
