import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** A string value longer than this does not fit beside its label on a phone. */
const INLINE_VALUE_MAX = 22;

/**
 * One label–value pair (web <dl> and wide table rows). Long text goes under the label; text values
 * are selectable so account numbers and transfer notes can be copied.
 */
export default function InfoRow({
  label,
  value,
  stacked,
  strong = false,
  className = '',
}: {
  label: string;
  /** Text, a number, or ready-made elements such as a Badge. */
  value: ReactNode;
  /** Defaults to true for long text. */
  stacked?: boolean;
  /** Totals: large primary value. */
  strong?: boolean;
  className?: string;
}) {
  const isText = typeof value === 'string' || typeof value === 'number';
  const below = stacked ?? (isText && String(value).length > INLINE_VALUE_MAX);
  return (
    <View
      className={`py-1.5 ${below ? 'gap-1' : 'flex-row items-start justify-between gap-3'} ${className}`}>
      <Text
        className={`text-sm leading-5 ${below ? '' : 'flex-1'} ${strong ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
        {label}
      </Text>
      {isText ? (
        <Text
          selectable
          className={`leading-5 ${below ? '' : 'max-w-[60%] text-right'} ${strong ? 'text-lg font-bold text-primary' : 'text-sm font-semibold text-foreground'}`}>
          {value}
        </Text>
      ) : (
        <View className={below ? '' : 'max-w-[60%] items-end'}>{value}</View>
      )}
    </View>
  );
}
