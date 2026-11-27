import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { BRANCH_TONES, type BranchLook } from '@/lib/branch-status';

/** A status pill: icon + words + tone. Wraps at large font sizes. */
export default function StatusTag({ look, label }: { look: BranchLook; label: string }) {
  const tone = BRANCH_TONES[look.tone];
  return (
    <View
      className={`max-w-full flex-row items-center gap-1 self-start rounded-full border px-2.5 py-1 ${tone.box}`}>
      <Icon name={look.icon} size={14} className={tone.text} />
      <Text className={`shrink text-xs font-semibold ${tone.text}`}>{label}</Text>
    </View>
  );
}
