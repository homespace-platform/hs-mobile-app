// Mobile counterpart of Card / SectionTitle in hs-web-app components/contract/page/ui.tsx.
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export function Card({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <View nativeID={id} className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>
      {children}
    </View>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-row flex-wrap items-start justify-between gap-3">
      <View className="min-w-48 flex-1">
        <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
          {title}
        </Text>
        {hint ? <Text className="mt-0.5 text-sm text-muted-foreground">{hint}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/** A card with its section title and a 12pt rhythm between children. */
export function SectionCard({
  title,
  hint,
  action,
  children,
  className = '',
  id,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Card id={id} className={`gap-3 ${className}`}>
      <SectionTitle title={title} hint={hint} action={action} />
      {children}
    </Card>
  );
}
