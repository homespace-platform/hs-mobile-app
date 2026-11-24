import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@/components/Icon';
import { LISTING_CATEGORIES } from '@/lib/listing-format';
import type { SavedSort } from '@/lib/saved-listings';

function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`mr-2 min-h-10 flex-row items-center gap-1.5 rounded-full px-4 ${active ? 'bg-inverse' : 'border border-border bg-surface'}`}>
      <Text className={`text-sm font-semibold ${active ? 'text-on-inverse' : 'text-secondary'}`}>
        {label}
      </Text>
      {count === undefined ? null : (
        <Text
          className={`rounded-full px-1.5 text-xs font-semibold ${active ? 'bg-surface text-foreground' : 'bg-muted text-muted-foreground'}`}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

// `contentContainerStyle` (not contentContainerClassName) so the first chip is not clipped.
const CHIP_ROW = { paddingHorizontal: 20 };

export function CategoryTabs({
  counts,
  value,
  onChange,
}: {
  counts: Record<string, number>;
  value?: string;
  onChange: (value?: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={CHIP_ROW}
      className="mt-4">
      {LISTING_CATEGORIES.map((item) => (
        <Chip
          key={item.label}
          label={item.label}
          count={counts[item.value ?? 'all']}
          active={value === item.value}
          onPress={() => onChange(item.value)}
        />
      ))}
    </ScrollView>
  );
}

export function SearchSortBar({
  query,
  onQuery,
  placeholder,
  sortOptions,
  sort,
  onSort,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  sortOptions: { value: SavedSort; label: string }[];
  sort: SavedSort;
  onSort: (value: SavedSort) => void;
}) {
  return (
    <>
      <View className="mx-5 mt-3 min-h-12 flex-row items-center rounded-xl border border-border bg-surface px-3">
        <Ionicons name="search" size={18} className="text-muted-foreground" />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          returnKeyType="search"
          className="ml-2 flex-1 py-2 text-sm text-foreground placeholder:text-subtle"
        />
        {query ? (
          <Pressable
            onPress={() => onQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Xóa từ khóa"
            hitSlop={8}>
            <Ionicons name="close-circle" size={18} className="text-muted-foreground" />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={CHIP_ROW}
        className="mt-3">
        {sortOptions.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={sort === option.value}
            onPress={() => onSort(option.value)}
          />
        ))}
      </ScrollView>
    </>
  );
}

function Step({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: 'chevron-back' | 'chevron-forward';
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
      className={`min-h-11 flex-row items-center gap-1 rounded-xl border border-border bg-surface px-4 ${disabled ? 'opacity-40' : ''}`}>
      {icon === 'chevron-back' ? (
        <Ionicons name={icon} size={16} className="text-foreground" />
      ) : null}
      <Text className="text-sm font-semibold text-foreground">{label}</Text>
      {icon === 'chevron-forward' ? (
        <Ionicons name={icon} size={16} className="text-foreground" />
      ) : null}
    </Pressable>
  );
}

export function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <View className="mt-2 flex-row items-center justify-between border-t border-border pt-5">
      <Step
        label="Trước"
        icon="chevron-back"
        disabled={page <= 1}
        onPress={() => onChange(page - 1)}
      />
      <Text className="text-sm font-semibold text-muted-foreground">
        {page} / {totalPages}
      </Text>
      <Step
        label="Tiếp"
        icon="chevron-forward"
        disabled={page >= totalPages}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}
