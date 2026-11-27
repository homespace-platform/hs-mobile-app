// Loading / empty / error blocks (web skeletons, spinners, dashed empty boxes and retry alerts).
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Text, View } from 'react-native';

import Icon from '@/components/Icon';

import ActionButton from './ActionButton';

/** One grey placeholder bar; size and radius come from `className`. Still with reduced motion on. */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const fade = (toValue: number) =>
      Animated.timing(opacity, { toValue, duration: 700, useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([fade(0.45), fade(1)]));
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (active && !reduce) loop.start();
    });
    return () => {
      active = false;
      loop.stop();
    };
  }, [opacity]);
  return (
    <Animated.View style={{ opacity }}>
      <View className={`rounded-lg bg-muted ${className}`} />
    </Animated.View>
  );
}

/** Placeholder of a detail page: header card, next step, tabs and a body card. */
export function PageSkeleton({ label = 'Đang tải thông tin hợp đồng...' }: { label?: string }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} className="gap-4">
      <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </View>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </View>
  );
}

export function LoadingBlock({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <View accessibilityLiveRegion="polite" className="items-center gap-3 px-4 py-8">
      <ActivityIndicator size="large" className="text-primary" />
      <Text className="text-center text-sm text-muted-foreground">{label}</Text>
    </View>
  );
}

export function EmptyBlock({
  title,
  message,
  icon = 'file-tray-outline',
  action,
}: {
  title: string;
  message?: string;
  icon?: ComponentProps<typeof Icon>['name'];
  action?: ReactNode;
}) {
  return (
    <View className="items-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface px-5 py-8">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon name={icon} size={28} className="text-muted-foreground" />
      </View>
      <Text className="text-center text-base font-bold text-foreground">{title}</Text>
      {message ? (
        <Text className="text-center text-sm leading-6 text-muted-foreground">{message}</Text>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorBlock({
  title,
  message,
  onRetry,
  retryLabel = 'Thử lại',
  busy,
}: {
  /** A heading inside the same box, above the message. */
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  busy?: boolean;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-danger bg-danger-soft p-4">
      <View accessibilityRole="alert" accessible className="flex-row items-start gap-2">
        <Icon name="alert-circle-outline" size={20} className="text-danger" />
        <View className="flex-1 gap-1">
          {title ? <Text className="text-base font-bold text-danger">{title}</Text> : null}
          <Text className="text-sm leading-5 text-danger">{message}</Text>
        </View>
      </View>
      {onRetry ? (
        <ActionButton
          label={retryLabel}
          variant="secondary"
          icon="refresh"
          busy={busy}
          onClick={onRetry}
          // The base min-h-12 is only 42dp with this rem.
          className="min-h-[44px]"
        />
      ) : null}
    </View>
  );
}
