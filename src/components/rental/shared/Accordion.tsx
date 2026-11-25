// Replacement for web <details>/<summary>.
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';

export default function Accordion({
  title,
  icon,
  badge,
  defaultOpen = false,
  open,
  onToggle,
  plusMinus,
  children,
  className = '',
}: {
  title: string;
  icon?: ComponentProps<typeof Icon>['name'];
  badge?: ReactNode;
  /** Initial state, like `<details open={condition}>`. */
  defaultOpen?: boolean;
  /** Pass with onToggle to control it. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** The web draws `+` / `−` instead of a chevron. */
  plusMinus?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const expanded = open ?? own;
  // Mounted on first open, then only hidden: like <details>, what was typed inside survives closing.
  const opened = useRef(expanded);
  if (expanded) opened.current = true;

  return (
    <View className={`overflow-hidden rounded-2xl border border-border bg-surface ${className}`}>
      <Pressable
        onPress={() => {
          setOwn(!expanded);
          onToggle?.(!expanded);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="min-h-12 flex-row items-center gap-2 px-4 py-3 active:bg-muted">
        {icon ? <Icon name={icon} size={18} className="text-muted-foreground" /> : null}
        <Text className="flex-1 text-sm font-semibold text-foreground">{title}</Text>
        {badge}
        {plusMinus ? (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            className="text-lg font-bold text-muted-foreground">
            {expanded ? '−' : '+'}
          </Text>
        ) : (
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            className="text-muted-foreground"
          />
        )}
      </Pressable>
      {opened.current ? (
        <View className={expanded ? 'border-t border-border px-4 py-3' : 'hidden'}>{children}</View>
      ) : null}
    </View>
  );
}
