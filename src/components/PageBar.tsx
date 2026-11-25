import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { getVisiblePages, pageRange } from '@/lib/pagination';

// Mobile version of the web pagination bar (rent list): summary line, then "‹ Trước  1 … 4 5 6 … 30  Tiếp ›".
// Wraps onto a second line on narrow screens instead of overflowing.
export default function PageBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  shown,
  disabled,
  onChange,
  noun = 'tin đăng cho thuê',
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  shown: number;
  disabled?: boolean;
  onChange: (page: number) => void;
  noun?: string;
}) {
  if (totalPages <= 1) return null;
  const { from, to } = pageRange(page, pageSize, shown, totalItems);
  const go = (next: number) => {
    if (!disabled && next >= 1 && next <= totalPages && next !== page) onChange(next);
  };
  const edge = 'min-h-10 flex-row items-center rounded-2xl border border-border bg-surface px-3';

  return (
    <View className="mt-6 border-t border-border pt-4">
      <Text className="mb-3 text-center text-xs font-medium text-muted-foreground">
        Hiển thị <Text className="font-bold text-foreground">{`${from} - ${to}`}</Text> trong tổng
        số <Text className="font-bold text-foreground">{totalItems}</Text> {noun}
      </Text>
      <View className="flex-row flex-wrap items-center justify-center gap-1.5">
        <Pressable
          onPress={() => go(page - 1)}
          disabled={disabled || page === 1}
          accessibilityRole="button"
          accessibilityLabel="Trang trước"
          className={`${edge} ${page === 1 ? 'opacity-40' : ''}`}>
          <Icon name="chevron-back" size={14} className="text-foreground" />
          <Text className="ml-0.5 text-xs font-semibold text-foreground">Trước</Text>
        </Pressable>
        {getVisiblePages(page, totalPages).map((item, index) =>
          item === 'ellipsis' ? (
            <View key={`ellipsis-${index}`} className="h-10 w-7 items-center justify-center">
              <Text className="text-xs font-bold text-muted-foreground">…</Text>
            </View>
          ) : (
            <Pressable
              key={item}
              onPress={() => go(item)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Trang ${item}`}
              accessibilityState={{ selected: item === page }}
              className={`h-10 w-10 items-center justify-center rounded-2xl ${item === page ? 'bg-brand' : 'border border-border bg-surface'}`}>
              <Text
                className={`text-xs font-bold ${item === page ? 'text-on-brand' : 'text-foreground'}`}>
                {item}
              </Text>
            </Pressable>
          )
        )}
        <Pressable
          onPress={() => go(page + 1)}
          disabled={disabled || page === totalPages}
          accessibilityRole="button"
          accessibilityLabel="Trang sau"
          className={`${edge} ${page === totalPages ? 'opacity-40' : ''}`}>
          <Text className="mr-0.5 text-xs font-semibold text-foreground">Tiếp</Text>
          <Icon name="chevron-forward" size={14} className="text-foreground" />
        </Pressable>
      </View>
    </View>
  );
}
