import { createContext, type ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Label above, error (announced) and helper text below: the frame of every rental form field. */
export default function FieldFrame({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={className}>
      {label ? <Text className="mb-1.5 text-sm font-semibold text-secondary">{label}</Text> : null}
      {children}
      {error ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-1 text-xs leading-5 text-danger">
          {error}
        </Text>
      ) : null}
      {hint ? <Text className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

export const inputBoxClass = (invalid: boolean, disabled?: boolean) =>
  `min-h-12 flex-row items-center rounded-xl border px-3 ${invalid ? 'border-danger' : 'border-border'} ${disabled ? 'bg-muted' : 'bg-surface'}`;

/** The text colour a wrapper gives the inputs inside it (web ContractEditField). */
export const FieldTextColor = createContext<string | undefined>(undefined);

export const inputTextClass = (disabled?: boolean, color?: string) =>
  `flex-1 py-2.5 text-base selection:text-primary placeholder:text-subtle ${color ?? (disabled ? 'text-muted-foreground' : 'text-foreground')}`;
