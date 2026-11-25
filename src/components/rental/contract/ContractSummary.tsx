// Web: components/contract/page/ContractSummary.tsx.
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';

import type { SummaryFact } from './contractDetailLogic';

/** Key facts under the contract title: who, where, how much, until when. Empty ones are skipped. */
export default function ContractSummary({ facts }: { facts: SummaryFact[] }) {
  // The web value is the main line and the sub line together: a "—" main line keeps its sub line.
  const shown = facts.filter((f) => f.sub || (f.value && f.value !== '—'));
  if (!shown.length) return null;
  return (
    <View className="gap-2 border-t border-border pt-3">
      {shown.map((fact) => (
        <View key={fact.label} className="flex-row gap-3 rounded-xl bg-muted px-3 py-2.5">
          <Icon name={fact.icon} size={18} className="mt-0.5 text-primary" />
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {fact.label}
            </Text>
            <Text selectable className="mt-0.5 text-sm font-semibold leading-5 text-foreground">
              {fact.value}
            </Text>
            {fact.sub ? (
              <Text className="text-sm leading-5 text-muted-foreground">{fact.sub}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
