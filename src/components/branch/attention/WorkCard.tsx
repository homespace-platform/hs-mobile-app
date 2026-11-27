// One server work item. The whole card is the one action: it opens where the work is handled.
import { Pressable, Text, View } from 'react-native';

import StatusTag from '@/components/branch/StatusTag';
import Icon from '@/components/Icon';
import {
  PRIORITY_LABEL,
  targetHref,
  workContext,
  workDeadline,
  workLabel,
  type AttentionWork,
  type BranchAttention,
} from '@/lib/branch-overview';
import { PRIORITY_LOOK } from '@/lib/branch-status';
import { targetNote } from '@/lib/branch-target';

export default function WorkCard({
  work,
  clocks,
  elapsedMs,
  onOpen,
}: {
  work: AttentionWork;
  clocks: Pick<BranchAttention, 'billingNow' | 'realNow'>;
  elapsedMs: number;
  onOpen: () => void;
}) {
  const [group, label] = workLabel(work.type);
  const context = workContext(work);
  const deadline = workDeadline(work, clocks, elapsedMs);
  const { opens, note } = targetNote(targetHref(work.target));
  const urgent = work.priority === 'URGENT';

  const content = (
    <>
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <StatusTag look={PRIORITY_LOOK[work.priority]} label={PRIORITY_LABEL[work.priority]} />
          <Text className="shrink text-xs font-semibold text-muted-foreground">{group}</Text>
        </View>
        <Text className="text-base font-bold text-foreground">{label}</Text>
        {context ? <Text className="text-sm leading-5 text-foreground">{context}</Text> : null}
        {deadline ? (
          <Text className={`text-sm leading-5 ${urgent ? 'text-danger' : 'text-secondary'}`}>
            {deadline}
          </Text>
        ) : null}
        {note ? <Text className="text-xs leading-5 text-muted-foreground">{note}</Text> : null}
      </View>
      {opens ? <Icon name="chevron-forward" size={20} className="text-subtle" /> : null}
    </>
  );
  const box = `min-h-[56px] flex-row items-center gap-3 rounded-2xl bg-surface p-3 ${urgent ? 'border-2 border-danger' : 'border border-border'}`;
  const name = [PRIORITY_LABEL[work.priority], group, label, context, deadline, note]
    .filter(Boolean)
    .join(', ');
  return opens ? (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={name}
      className={`${box} active:bg-muted`}>
      {content}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={name} className={box}>
      {content}
    </View>
  );
}
