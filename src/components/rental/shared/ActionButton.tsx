import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import Icon from '@/components/Icon';

const VARIANTS = {
  primary: { box: 'border-brand bg-brand', text: 'text-on-brand' },
  secondary: { box: 'border-border bg-surface', text: 'text-foreground' },
  danger: { box: 'border-danger-solid bg-danger-solid', text: 'text-on-danger-solid' },
  warning: { box: 'border-warning bg-warning-soft', text: 'text-warning' },
  success: { box: 'border-success bg-success-soft', text: 'text-success' },
};

export type ActionButtonProps = {
  label: string;
  onClick?: () => void;
  variant?: keyof typeof VARIANTS;
  icon?: ComponentProps<typeof Icon>['name'];
  disabled?: boolean;
  busy?: boolean;
  /** The web renders this action as a link. */
  link?: boolean;
  /** Screen-reader description (web `title`). */
  hint?: string;
  /** Icon above a small label, for a one-row toolbar (list cards). */
  compact?: boolean;
  /** Layout only, e.g. "flex-1". */
  className?: string;
};

/** The rental flow's button. `Screen.Button` has a fixed top margin and no secondary style. */
export default function ActionButton({
  label,
  onClick,
  variant = 'primary',
  icon,
  disabled,
  busy,
  link,
  hint,
  compact,
  className = '',
}: ActionButtonProps) {
  const look = VARIANTS[variant];
  const off = Boolean(disabled || busy);
  return (
    <Pressable
      onPress={onClick}
      disabled={off}
      accessibilityRole={link && !off ? 'link' : 'button'}
      accessibilityHint={hint}
      accessibilityState={{ disabled: off, busy: Boolean(busy) }}
      className={`items-center justify-center border active:opacity-80 ${compact ? 'min-h-[44px] shrink grow gap-0.5 rounded-lg px-1 py-1' : 'min-h-12 flex-row gap-2 rounded-xl px-4 py-3'} ${look.box} ${off ? 'opacity-50' : ''} ${className}`}>
      {busy ? (
        <ActivityIndicator size="small" className={look.text} />
      ) : icon ? (
        <Icon name={icon} size={compact ? 16 : 18} className={look.text} />
      ) : null}
      <Text
        className={`text-center font-bold ${compact ? 'text-xs' : 'shrink text-sm'} ${look.text}`}>
        {label}
      </Text>
    </Pressable>
  );
}
