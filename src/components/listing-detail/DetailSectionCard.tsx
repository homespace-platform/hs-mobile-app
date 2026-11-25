import type { ComponentProps, ReactNode } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import Icon from '@/components/Icon';

export type IconName = ComponentProps<typeof Icon>['name'];

export function SectionCard({
  title,
  icon,
  children,
  onLayout,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <View onLayout={onLayout} className="rounded-2xl border border-border bg-surface p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Icon name={icon} size={20} className="text-primary" />
        <Text accessibilityRole="header" className="flex-1 text-lg font-bold text-foreground">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-4 border-b border-border/60 py-3">
      <Text className="flex-shrink text-sm text-muted-foreground">{label}</Text>
      <Text className="max-w-[60%] text-right text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

export function Chip({
  label,
  icon,
  tone = 'neutral',
}: {
  label: string;
  icon?: IconName;
  tone?: 'neutral' | 'primary';
}) {
  const primary = tone === 'primary';
  return (
    <View
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${primary ? 'border-primary-border bg-primary-soft' : 'border-border bg-muted'}`}>
      {icon ? <Icon name={icon} size={15} className="text-primary" /> : null}
      <Text className={`text-sm ${primary ? 'font-medium text-primary' : 'text-foreground'}`}>
        {label}
      </Text>
    </View>
  );
}

export function Notice({
  title,
  text,
  tone = 'neutral',
}: {
  title?: string;
  text: string;
  tone?: 'neutral' | 'warning';
}) {
  const warning = tone === 'warning';
  return (
    <View
      className={`flex-row items-start gap-2 rounded-xl border p-3 ${warning ? 'border-warning bg-warning-soft' : 'border-border bg-muted'}`}>
      <Icon
        name={warning ? 'warning-outline' : 'information-circle-outline'}
        size={18}
        className={warning ? 'text-warning' : 'text-muted-foreground'}
      />
      <View className="flex-1">
        {title ? <Text className="text-sm font-bold text-foreground">{title}</Text> : null}
        <Text className="text-sm leading-5 text-muted-foreground">{text}</Text>
      </View>
    </View>
  );
}
