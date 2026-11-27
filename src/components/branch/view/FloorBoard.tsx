// One floor of the saved map: each row is a column, each room cell shows the current layer and opens
// the room sheet. Only this area scrolls sideways.
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import Icon from '@/components/Icon';
import { toneBackground } from '@/components/branch/view/tone';
import { BRANCH_TONES, type BranchLook } from '@/lib/branch-status';
import { columnWidth } from '@/lib/branch-view';
import type { DraftFloor, DraftSlot } from '@/types/branch-layout';

export interface CellContent {
  look: BranchLook;
  label: string;
  lines: string[];
}

type Props = {
  floor: DraftFloor;
  content: (slot: DraftSlot) => CellContent;
  filtering: boolean;
  /** Slot keys. */
  matched: Set<string>;
  /** Room ids whose linked listing declares another code than the cell. */
  flagged?: ReadonlySet<string>;
  onOpen: (slot: DraftSlot) => void;
};

/** Page and board padding and border, rounded up (rem is 14dp here). */
const OUTSIDE_COLUMNS = 58;

export default function FloorBoard({
  floor,
  content,
  filtering,
  matched,
  flagged,
  onOpen,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const fixed = columnWidth(floor.rows.length, fontScale, width - OUTSIDE_COLUMNS);

  const cell = (slot: DraftSlot, place: string) => {
    if (slot.roomCode === null)
      return (
        <View
          key={slot.key}
          className="min-h-[56px] items-center justify-center rounded-xl border border-dashed border-border-strong bg-muted px-1.5 py-2">
          <Text className="text-center text-xs text-secondary">Ô trống</Text>
        </View>
      );
    const { look, label, lines } = content(slot);
    const tone = BRANCH_TONES[look.tone];
    const match = filtering && matched.has(slot.key);
    const dim = filtering && !match;
    const box = match
      ? `border-4 border-primary ${toneBackground(look.tone)}`
      : dim
        ? 'border border-dashed border-border-strong bg-surface'
        : `border-2 ${tone.box}`;
    const mismatch = Boolean(slot.id && flagged?.has(slot.id));
    const name = [`Phòng ${slot.roomCode}`, place, label, ...lines];
    if (mismatch) name.push('mã trên tin khác mã ô');
    if (match) name.push('đang được làm nổi');
    return (
      <Pressable
        key={slot.key}
        onPress={() => onOpen(slot)}
        accessibilityRole="button"
        accessibilityLabel={name.join(', ')}
        accessibilityHint="Mở chi tiết phòng"
        className={`min-h-[96px] items-center justify-center gap-0.5 rounded-xl px-1.5 py-2 active:opacity-70 ${box}`}>
        <Text
          className={`text-center text-xl font-extrabold ${dim ? 'text-muted-foreground' : 'text-foreground'}`}>
          {slot.roomCode}
        </Text>
        <View className="max-w-full flex-row items-center justify-center gap-1">
          <Icon name={look.icon} size={15} className={dim ? 'text-muted-foreground' : tone.text} />
          <Text
            className={`shrink text-center text-xs font-bold ${dim ? 'text-muted-foreground' : tone.text}`}>
            {label}
          </Text>
        </View>
        {mismatch ? (
          <View className="max-w-full flex-row items-center justify-center gap-1">
            <Icon name="alert-circle" size={14} className={dim ? 'text-muted-foreground' : 'text-warning'} />
            <Text
              className={`shrink text-center text-xs font-bold ${dim ? 'text-muted-foreground' : 'text-warning'}`}>
              Lệch mã tin
            </Text>
          </View>
        ) : null}
        {lines.map((line, index) => (
          <Text
            key={index}
            className={`text-center text-xs leading-4 ${dim ? 'text-muted-foreground' : 'text-secondary'}`}>
            {line}
          </Text>
        ))}
      </Pressable>
    );
  };

  const columns = floor.rows.map((row) => (
    <View
      key={row.key}
      className={`gap-2 ${fixed === null ? 'flex-1' : ''}`}
      style={fixed === null ? undefined : { width: fixed }}>
      <Text className="text-center text-xs font-semibold text-muted-foreground">{row.label}</Text>
      {row.slots.map((slot) => cell(slot, `${row.label}, ${floor.label}`))}
    </View>
  ));

  return (
    <View className="gap-2 rounded-2xl border border-border bg-surface py-3">
      <Text accessibilityRole="header" className="px-3 text-base font-bold text-foreground">
        {floor.label}
      </Text>
      {floor.rows.length === 0 ? (
        <Text className="px-3 text-sm text-muted-foreground">Tầng này chưa có dãy.</Text>
      ) : fixed === null ? (
        <View className="flex-row items-start gap-2 px-3">{columns}</View>
      ) : (
        <>
          <Text className="px-3 text-xs text-muted-foreground">
            Vuốt ngang trong khung để xem đủ {floor.rows.length} dãy.
          </Text>
          <ScrollView
            horizontal
            persistentScrollbar
            keyboardShouldPersistTaps="handled"
            accessibilityLabel={`Sơ đồ ${floor.label}`}
            contentContainerClassName="items-start gap-2 px-3 pb-2">
            {columns}
          </ScrollView>
        </>
      )}
    </View>
  );
}
