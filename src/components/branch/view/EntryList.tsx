// Rows of the room sheet and of "Khoản thu chưa xếp phòng": the whole row is the one action.
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import type { OverviewTarget } from '@/lib/branch-overview';
import { BRANCH_TONES, layerLook } from '@/lib/branch-status';
import { openLabel, type ViewEntry } from '@/lib/branch-view';

export default function EntryList({
  entries,
  onOpen,
}: {
  entries: ViewEntry[];
  onOpen: (target: OverviewTarget) => void;
}) {
  return (
    <View className="gap-2">
      {entries.map((entry) => {
        const look = layerLook(entry.layer, entry.status);
        const tone = BRANCH_TONES[look.tone];
        const { target } = entry;
        const action = target ? openLabel(target) : 'Chưa có đường dẫn mở.';
        const content = (
          <>
            <Icon name={look.icon} size={20} className={tone.text} />
            <View className="flex-1 gap-0.5">
              <Text className={`text-base font-bold ${tone.text}`}>{entry.title}</Text>
              {entry.lines.map((line, index) => (
                <Text key={index} className="text-sm leading-5 text-foreground">
                  {line}
                </Text>
              ))}
              <Text
                className={`mt-1 text-sm ${target ? `font-bold underline ${tone.text}` : 'text-secondary'}`}>
                {action}
              </Text>
            </View>
            {target ? (
              <View className="self-center">
                <Icon name="chevron-forward" size={20} className={tone.text} />
              </View>
            ) : null}
          </>
        );
        const box = `min-h-[56px] flex-row items-start gap-3 rounded-2xl border-2 p-3 ${tone.box}`;
        const name = [entry.title, ...entry.lines, action].join(', ');
        return target ? (
          <Pressable
            key={entry.key}
            onPress={() => onOpen(target)}
            accessibilityRole="button"
            accessibilityLabel={name}
            className={`${box} active:opacity-70`}>
            {content}
          </Pressable>
        ) : (
          <View key={entry.key} accessible accessibilityLabel={name} className={box}>
            {content}
          </View>
        );
      })}
    </View>
  );
}
