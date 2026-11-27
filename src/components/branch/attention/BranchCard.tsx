// OWNER: agent A. One branch in the list. Design: docs/chi-nhanh/00-thiet-ke.md section 3.
// The work count row is a sibling of the card's Pressable, never inside it, so screen readers reach
// both. The summary has no priority, so the row is never red. The props are final.
import { Image, Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { BRANCH_CATEGORIES } from '@/lib/branch-form';
import type { Branch } from '@/services/branchApi';

export interface BranchCardProps {
  branch: Branch;
  /** undefined = unknown (still loading or the count request failed). */
  count?: number;
  disabled?: boolean;
  onPress: () => void;
  /** Opens this branch on "Cần chú ý". */
  onOpenAttention: () => void;
}

export default function BranchCard({
  branch,
  count,
  disabled,
  onPress,
  onOpenAttention,
}: BranchCardProps) {
  const category = BRANCH_CATEGORIES.find((item) => item.value === branch.category)?.label;
  return (
    <View className="mb-3 overflow-hidden rounded-2xl border border-border bg-surface">
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        className="active:bg-muted">
        {branch.coverImageUrl ? (
          <Image source={{ uri: branch.coverImageUrl }} className="h-28 w-full bg-muted" />
        ) : null}
        <View className="p-4">
          <View className="flex-row items-start gap-2">
            <View className="flex-1">
              <Text className="text-base font-bold text-foreground">{branch.name}</Text>
              <Text className="mt-1 text-xs text-muted-foreground">
                {category}
                {branch.code ? ` · ${branch.code}` : ''}
              </Text>
            </View>
            <Icon name="chevron-forward" size={19} className="text-subtle" />
          </View>
          <Text className="mt-2 text-sm text-secondary">{branch.display || 'Chưa có địa chỉ'}</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <Text className="rounded-full bg-muted px-3 py-1 text-xs text-secondary">
              {branch.totalUnits ?? 0} phòng/căn
            </Text>
            {branch.isComplete === false ? (
              <Text className="rounded-full bg-warning-soft px-3 py-1 text-xs text-warning">
                Thiếu biểu phí
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      {count === undefined ? null : count > 0 ? (
        <Pressable
          onPress={onOpenAttention}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${count} việc cần chú ý ở chi nhánh ${branch.name}`}
          accessibilityState={{ disabled: Boolean(disabled) }}
          className="min-h-[48px] flex-row items-center gap-2 border-t border-border bg-warning-soft px-4 py-3 active:opacity-70">
          <Icon name="alert-circle-outline" size={20} className="text-warning" />
          <Text className="flex-1 text-sm font-bold text-warning">{count} việc cần chú ý</Text>
          <Icon name="chevron-forward" size={19} className="text-warning" />
        </Pressable>
      ) : (
        <Text className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          Không có việc cần chú ý
        </Text>
      )}
    </View>
  );
}
