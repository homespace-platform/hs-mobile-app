// Layer, month, search, legend and floor pickers above the floor map.
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import Icon from '@/components/Icon';
import { LAYER_LABEL, monthLabel, shiftMonth, type OverviewLayer } from '@/lib/branch-overview';
import { BRANCH_TONES, layerLook } from '@/lib/branch-status';
import { toneBackground } from '@/components/branch/view/tone';
import type { DraftFloor } from '@/types/branch-layout';

/** Xem (this screen) or Sửa sơ đồ (the editor): structural edits only exist in the editor. */
export function ModeSwitch({ onEdit }: { onEdit: () => void }) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Chế độ"
      className="flex-row gap-1 rounded-xl border border-border bg-muted p-1">
      <View
        accessibilityRole="radio"
        accessibilityLabel="Xem, đang chọn"
        accessibilityState={{ checked: true, selected: true }}
        className="min-h-[44px] flex-1 items-center justify-center rounded-lg bg-surface px-2">
        <Text className="text-sm font-bold text-primary">Xem</Text>
      </View>
      <Pressable
        onPress={onEdit}
        accessibilityRole="radio"
        accessibilityLabel="Sửa sơ đồ: đổi mã, chuyển, xóa ô, thêm dãy và tầng"
        accessibilityState={{ checked: false, selected: false }}
        className="min-h-[44px] flex-1 items-center justify-center rounded-lg px-2 active:bg-surface">
        <Text className="text-center text-sm font-bold text-muted-foreground">Sửa sơ đồ</Text>
      </Pressable>
    </View>
  );
}

/** One layer at a time, all four always visible. */
export function LayerPicker({
  layer,
  onChange,
}: {
  layer: OverviewLayer;
  onChange: (layer: OverviewLayer) => void;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Lớp xem trên sơ đồ"
      className="flex-row flex-wrap gap-2">
      {(Object.keys(LAYER_LABEL) as OverviewLayer[]).map((id) => {
        const selected = id === layer;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityLabel={`Lớp ${LAYER_LABEL[id]}`}
            accessibilityState={{ checked: selected, selected }}
            className={`min-h-[44px] grow basis-[47%] flex-row items-center justify-center gap-1.5 rounded-xl border-2 px-2 py-1.5 active:opacity-70 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
            {selected ? <Icon name="checkmark" size={18} className="text-primary" /> : null}
            <Text
              className={`shrink text-center text-sm font-bold ${selected ? 'text-primary' : 'text-foreground'}`}>
              {LAYER_LABEL[id]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MonthArrow({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`h-[44px] w-[44px] items-center justify-center rounded-xl border border-border bg-surface active:bg-muted ${disabled ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={22} className="text-foreground" />
    </Pressable>
  );
}

/** `month` is what was asked for ("" = the server's month); `shown` is "" until the server answers. */
export function MonthPicker({
  month,
  shown,
  onChange,
}: {
  month: string;
  shown: string;
  onChange: (month: string) => void;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <MonthArrow
        icon="chevron-back"
        label="Tháng trước"
        disabled={!shown || shown === '0001-01'}
        onPress={() => onChange(shiftMonth(shown, -1))}
      />
      {month ? (
        <Pressable
          onPress={() => onChange('')}
          accessibilityRole="button"
          accessibilityLabel={`${shown ? monthLabel(shown) : 'Tháng đã chọn'}. Bấm để về tháng hiện tại`}
          className="min-h-[44px] flex-1 items-center justify-center rounded-xl active:bg-muted">
          <Text accessibilityLiveRegion="polite" className="text-base font-bold text-foreground">
            {shown ? monthLabel(shown) : 'Tháng đã chọn'}
          </Text>
          <Text className="text-xs font-semibold text-primary">Về tháng hiện tại</Text>
        </Pressable>
      ) : (
        <Text
          accessibilityLiveRegion="polite"
          className="flex-1 text-center text-base font-bold text-foreground">
          {shown ? monthLabel(shown) : 'Tháng hiện tại'}
        </Text>
      )}
      <MonthArrow
        icon="chevron-forward"
        label="Tháng sau"
        disabled={!shown || shown === '9999-12'}
        onPress={() => onChange(shiftMonth(shown, 1))}
      />
    </View>
  );
}

export function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="flex-row items-center rounded-xl border border-border bg-surface pl-3">
      <Icon name="search" size={18} className="text-muted-foreground" />
      <TextInput
        value={value}
        onChangeText={onChange}
        accessibilityLabel="Tìm mã phòng hoặc tên người thuê"
        placeholder="Tìm mã phòng, người thuê"
        autoCorrect={false}
        returnKeyType="search"
        className="min-h-[44px] flex-1 px-2 py-1.5 text-base text-foreground selection:text-primary placeholder:text-subtle"
      />
      {value ? (
        <Pressable
          onPress={() => onChange('')}
          accessibilityRole="button"
          accessibilityLabel="Xóa nội dung tìm"
          className="h-[44px] w-[44px] items-center justify-center active:opacity-60">
          <Icon name="close-circle" size={20} className="text-muted-foreground" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The legend is also the count: how many rooms are in each state, on every floor. */
export function Legend({
  layer,
  leaseStatus,
  items,
  highlight,
  onToggle,
}: {
  layer: OverviewLayer;
  leaseStatus: string;
  items: { status: string; label: string; count: number }[];
  highlight: string | null;
  onToggle: (status: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Chú giải và số phòng. Bấm để làm nổi"
      className="-mx-4 grow-0"
      contentContainerClassName="items-stretch gap-2 px-4">
      {items.map(({ status, label, count }) => {
        const look = layerLook(layer, status === 'HAS_LEASE' ? leaseStatus : status);
        const tone = BRANCH_TONES[look.tone];
        const selected = status === highlight;
        return (
          <Pressable
            key={status}
            onPress={() => onToggle(status)}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${count} phòng. ${selected ? 'Đang làm nổi, bấm để bỏ' : 'Bấm để làm nổi'}`}
            accessibilityState={{ selected }}
            className={`min-h-[44px] flex-row items-center gap-1.5 rounded-xl px-2.5 py-1.5 active:opacity-70 ${selected ? `border-4 border-primary ${toneBackground(look.tone)}` : `border-2 ${tone.box}`}`}>
            <Icon name={look.icon} size={16} className={tone.text} />
            <Text className={`text-sm font-semibold ${tone.text}`}>{label}</Text>
            <Text className={`text-base font-extrabold ${tone.text}`}>{count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function FloorPicker({
  floors,
  current,
  matches,
  onChange,
}: {
  floors: DraftFloor[];
  current: DraftFloor;
  /** Matches per floor key while searching or highlighting; null otherwise. */
  matches: Map<string, number> | null;
  onChange: (floor: DraftFloor) => void;
}) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Chọn tầng"
      className="-mx-4 grow-0"
      contentContainerClassName="items-stretch gap-2 px-4">
      {floors.map((floor) => {
        const selected = floor.key === current.key;
        const label = matches
          ? `${floor.label} (${matches.get(floor.key) ?? 0} khớp)`
          : floor.label;
        return (
          <Pressable
            key={floor.key}
            onPress={() => onChange(floor)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            className={`min-h-[44px] min-w-[72px] items-center justify-center rounded-full border-2 px-4 py-1.5 active:opacity-70 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
            <Text className={`text-sm font-bold ${selected ? 'text-primary' : 'text-foreground'}`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
