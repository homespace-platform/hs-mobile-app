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
  className = '',
}: ActionButtonProps) {
  const look = VARIANTS[variant];
  const off = Boolean(disabled || busy);
  return (
    <Pressable
      onPress={onClick}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: Boolean(busy) }}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3 active:opacity-80 ${look.box} ${off ? 'opacity-50' : ''} ${className}`}>
      {busy ? (
        <ActivityIndicator size="small" className={look.text} />
      ) : icon ? (
        <Icon name={icon} size={18} className={look.text} />
      ) : null}
      <Text className={`shrink text-center text-sm font-bold ${look.text}`}>{label}</Text>
    </Pressable>
  );
}
