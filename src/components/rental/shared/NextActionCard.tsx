// Mobile counterpart of hs-web-app components/rental/NextActionCard.tsx.
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { format } from 'date-fns';

import Icon from '@/components/Icon';
import { remaining } from '@/lib/rental/NextActionCard';
import { describeNextAction, type NextActionView, type Role } from '@/lib/rental/rental-labels';
import type { NextAction } from '@/services/rental/rental-onboarding.service';

import ActionButton from './ActionButton';
import Badge from './Badge';
import { toneParts } from './logic';

export interface CardAction {
  label: string;
  /** Web `href` actions navigate from here too. */
  onClick?: () => void;
  /** The web action has an `href`: announced as a link. */
  link?: boolean;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * The first thing on a rental / contract page: ONE next step, who owes it, and until when.
 * `nextAction` comes from the server; without it the card falls back to `fallbackMessage`.
 */
export default function NextActionCard({
  role,
  nextAction,
  custom,
  fallbackMessage,
  primary,
  secondary = [],
  extra,
}: {
  role: Role;
  nextAction?: NextAction | null;
  /** A ready-made step; wins over `nextAction`. */
  custom?: Pick<NextActionView, 'title' | 'hint' | 'mine' | 'tone'>;
  fallbackMessage?: string | null;
  /** The button for the step shown. Omit it when the viewer is only waiting. */
  primary?: CardAction;
  secondary?: CardAction[];
  extra?: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const view: NextActionView | null = custom
    ? { ...custom, tab: 'overview' }
    : describeNextAction(nextAction, role);
  if (!view && !fallbackMessage) return null;

  const due = remaining(nextAction?.dueAt, now);
  const tone = !view ? 'neutral' : view.mine ? (due?.late ? 'danger' : 'info') : view.tone;
  const parts = toneParts(tone);
  const system = nextAction?.actor === 'SYSTEM';
  const eyebrow = view
    ? view.mine
      ? 'Việc cần làm của bạn'
      : system
        ? 'Hệ thống đang xử lý'
        : view.tone === 'warning'
          ? 'Đang chờ bên còn lại'
          : 'Tình trạng hiện tại'
    : 'Tiến trình hiện tại';

  return (
    <View
      accessibilityLabel="Việc cần làm"
      className={`gap-3 rounded-2xl border bg-surface p-4 ${view?.mine ? 'border-primary' : 'border-border'}`}>
      <View className="flex-row items-start gap-3">
        <View className={`h-12 w-12 items-center justify-center rounded-2xl border ${parts.box}`}>
          {system && !view?.mine ? (
            <ActivityIndicator className={parts.text} />
          ) : (
            <Icon
              name={!view || view.mine ? 'sparkles-outline' : 'hourglass-outline'}
              size={24}
              className={parts.text}
            />
          )}
        </View>
        <View className="flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </Text>
          <Text accessibilityRole="header" className="mt-0.5 text-lg font-bold text-foreground">
            {view?.title ?? fallbackMessage}
          </Text>
          {view?.hint ? (
            <Text className="mt-1 text-sm leading-6 text-muted-foreground">{view.hint}</Text>
          ) : null}
        </View>
      </View>
      {due ? (
        <Badge
          tone={due.late ? 'danger' : 'warning'}
          icon={due.late ? 'time-outline' : 'checkmark-circle-outline'}>
          {`${due.text} · hạn ${format(due.at, 'HH:mm dd/MM')}`}
        </Badge>
      ) : null}
      {extra}
      {primary || secondary.length ? (
        <View className="gap-2">
          {primary ? (
            <ActionButton {...primary} icon={primary.busy ? undefined : 'arrow-forward'} />
          ) : null}
          {secondary.map((action) => (
            <ActionButton key={action.label} {...action} variant="secondary" />
          ))}
        </View>
      ) : null}
    </View>
  );
}
