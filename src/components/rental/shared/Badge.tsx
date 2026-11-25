// Status pill (web components/contract/page/ui.tsx `Pill`). Labels and tones: @/lib/rental/rental-labels.
import type { ComponentProps, ReactNode } from 'react';
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import type { Tone } from '@/lib/rental/rental-labels';

import { toneParts } from './logic';

export default function Badge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: Tone;
  icon?: ComponentProps<typeof Icon>['name'];
  /** Text only. */
  children: ReactNode;
}) {
  const parts = toneParts(tone);
  return (
    <View
      className={`max-w-full flex-row items-center gap-1 self-start rounded-full border px-2.5 py-1 ${parts.box}`}>
      {icon ? <Icon name={icon} size={13} className={parts.text} /> : null}
      <Text className={`shrink text-xs font-semibold ${parts.text}`}>{children}</Text>
    </View>
  );
}
