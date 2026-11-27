// One floor of the editable map (web LayoutBoard): each row ("dãy") is a column of cells stacked top
// to bottom. Only this area scrolls sideways.
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import Icon from '@/components/Icon';
import type { DraftFloor, DraftRow } from '@/types/branch-layout';

export default function LayoutBoard({
  floor,
  editable,
  onOpenCell,
  onOpenRow,
  onAddRoom,
}: {
  floor: DraftFloor;
  editable: boolean;
  onOpenCell: (slotKey: string) => void;
  onOpenRow: (rowKey: string) => void;
  onAddRoom: (rowKey: string) => void;
}) {
  const large = useWindowDimensions().fontScale >= 1.3;
  const count = floor.rows.length;
  if (count === 0)
    return <Text className="text-sm text-muted-foreground">Tầng này chưa có dãy.</Text>;
  // One or two rows share the width; more (or two with large text) scroll sideways.
  const scrolls = count > 2 || (count === 2 && large);

  const column = (row: DraftRow) => (
    <View
      key={row.key}
      className={`gap-2 ${scrolls ? '' : 'min-w-0 flex-1'}`}
      style={scrolls ? { width: large ? 176 : 136 } : undefined}>
      {editable ? (
        <Pressable
          onPress={() => onOpenRow(row.key)}
          accessibilityRole="button"
          accessibilityLabel={`Tùy chọn ${row.label}, ${floor.label}`}
          className="min-h-[48px] flex-row items-center justify-center gap-1 rounded-xl px-1 py-1 active:bg-muted">
          <Text className="shrink text-center text-sm font-bold text-secondary">{row.label}</Text>
          <Icon name="ellipsis-horizontal" size={18} className="text-primary" />
        </Pressable>
      ) : (
        <Text className="py-2 text-center text-sm font-bold text-secondary">{row.label}</Text>
      )}
      {row.slots.map((slot) => {
        const empty = slot.roomCode === null;
        return (
          <Pressable
            key={slot.key}
            onPress={() => onOpenCell(slot.key)}
            disabled={!editable}
            accessibilityRole="button"
            accessibilityState={{ disabled: !editable }}
            accessibilityLabel={`${empty ? 'Ô trống' : `Phòng ${slot.roomCode}`}, ${row.label}, ${floor.label}${editable ? '. Mở tùy chọn' : ''}`}
            className={`min-h-[60px] items-center justify-center rounded-xl border-2 px-2 py-2 active:bg-muted ${empty ? 'border-dashed border-border-strong bg-muted' : 'border-primary-border bg-surface'}`}>
            <Text
              className={`text-center ${empty ? 'text-xs text-secondary' : 'text-base font-bold text-foreground'}`}>
              {empty ? 'Ô trống' : slot.roomCode}
            </Text>
          </Pressable>
        );
      })}
      {editable ? (
        <Pressable
          onPress={() => onAddRoom(row.key)}
          accessibilityRole="button"
          accessibilityLabel={`Thêm phòng vào ${row.label}, ${floor.label}`}
          className="h-[52px] w-[52px] items-center justify-center self-center rounded-full border-2 border-primary active:bg-primary-soft">
          <Icon name="add" size={26} className="text-primary" />
        </Pressable>
      ) : null}
    </View>
  );

  const columns = <View className="flex-row items-start gap-3">{floor.rows.map(column)}</View>;
  return scrolls ? (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="pb-3">
      {columns}
    </ScrollView>
  ) : (
    columns
  );
}
