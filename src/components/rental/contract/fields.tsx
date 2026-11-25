// Web: detail/utils.tsx (FieldRow, ContractSnapshotReadOnly), detail/ContractFieldState.tsx, and the
// shared look of the content sections. Web tables become one card per row.
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { FieldTextColor } from '@/components/rental/shared/FieldFrame';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import {
  amendmentFieldChanged,
  fieldStateClass,
  fieldStateText,
} from '@/lib/rental/contract-field-state';
import { useContractDraftEditor } from '@/lib/rental/ContractDraftEditor';
import { str } from '@/lib/rental/utils';
import type { AmendmentTerms } from '@/types/rental/contract-amendment.type';

import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';

/** True for a draft: every FieldRow is drawn read-only. */
export const ContractSnapshotReadOnly = createContext(false);

type IconName = ComponentProps<typeof Icon>['name'];

/** A label longer than this, or a value longer than this, puts the value under the label. */
const INLINE_VALUE_MAX = 22;

export function FieldRow({
  label,
  value,
  highlight,
  editable = false,
}: {
  label: string;
  value: unknown;
  highlight?: boolean;
  editable?: boolean;
}) {
  const snapshotReadOnly = useContext(ContractSnapshotReadOnly);
  const state = editable && !snapshotReadOnly ? 'editable' : 'readonly';
  const shown = str(value);
  const below = shown.length > INLINE_VALUE_MAX;
  return (
    <View
      className={`border-b border-border py-2 ${below ? 'gap-1' : 'flex-row items-start justify-between gap-3'}`}>
      <Text className={`text-sm leading-5 text-muted-foreground ${below ? '' : 'flex-1'}`}>
        {label}
      </Text>
      <Text
        selectable
        accessibilityHint={fieldStateText[state]}
        className={`leading-5 ${below ? '' : 'max-w-[60%] text-right'} ${highlight ? 'text-base font-bold' : 'text-sm font-semibold'} ${fieldStateClass[state]}`}>
        {shown}
      </Text>
    </View>
  );
}

/** Wraps one input of the draft or of an addendum and marks it once it differs from the source. */
export function ContractEditField({
  group,
  field,
  index,
  readonly = false,
  changed: explicitChanged,
  children,
}: {
  group: keyof AmendmentTerms;
  field?: string;
  index?: number;
  readonly?: boolean;
  changed?: boolean;
  children: ReactNode;
}) {
  const w = useAmendmentWorkspace();
  const draft = useContractDraftEditor();
  const changed =
    explicitChanged ??
    (draft
      ? amendmentFieldChanged(draft.base, draft.values, group, field, index)
      : Boolean(
          w?.editing &&
          w.editBaseline &&
          amendmentFieldChanged(w.editBaseline, w.values, group, field, index)
        ));
  const isChanged = !readonly && changed;
  const state = readonly ? 'readonly' : changed ? 'changed' : 'editable';
  return (
    <View className={isChanged ? 'border-l-2 border-success pl-2' : ''}>
      <FieldTextColor.Provider value={fieldStateClass[state]}>{children}</FieldTextColor.Provider>
      {isChanged ? (
        <Text className={`mt-1 text-xs font-semibold ${fieldStateClass.changed}`}>Đã sửa</Text>
      ) : null}
    </View>
  );
}

export function ContractFieldLegend({ draft = false }: { draft?: boolean }) {
  return (
    <View
      accessibilityLabel="Chú thích màu trường hợp đồng"
      className="gap-2 rounded-2xl border border-border bg-surface p-3">
      <Text className={`text-xs ${fieldStateClass.editable}`}>
        {draft ? '● Có thể sửa trên bản nháp' : '● Có thể điều chỉnh qua phụ lục'}
      </Text>
      <Text className={`text-xs ${fieldStateClass.readonly}`}>● Chỉ đọc / Hệ thống tự tính</Text>
      <Text className={`text-xs ${fieldStateClass.changed}`}>● Đã sửa trong bản đang soạn</Text>
      <PolicyNotice
        tone="neutral"
        title="Chú thích màu sắc"
        summary="Xanh lá là nội dung đã sửa, chưa có nghĩa là đã áp dụng.">
        <NoticeText>
          Xanh lá là nội dung đã sửa, chưa có nghĩa là đã áp dụng. Sửa lại đúng giá trị ban đầu sẽ
          trở về xanh dương; xóa dòng không làm đổi màu các dòng còn lại.
        </NoticeText>
      </PolicyNotice>
    </View>
  );
}

/** Card of one content section. */
export function Section({
  icon,
  title,
  subtitle,
  badge,
  label,
  children,
}: {
  icon?: IconName;
  title?: string;
  subtitle?: string;
  /** Small neutral chip: a count, or where the values come from. */
  badge?: string;
  /** Screen-reader name when there is no title. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <View
      accessibilityLabel={label}
      className="gap-3 rounded-2xl border border-border bg-surface p-4">
      {title ? (
        <View className="gap-2 border-b border-border pb-3">
          <View className="flex-row items-center gap-2">
            {icon ? (
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
                <Icon name={icon} size={18} className="text-primary" />
              </View>
            ) : null}
            <View className="flex-1">
              <Text accessibilityRole="header" className="text-base font-bold text-foreground">
                {title}
              </Text>
              {subtitle ? (
                <Text className="mt-0.5 text-xs leading-5 text-muted-foreground">{subtitle}</Text>
              ) : null}
            </View>
          </View>
          {badge ? <Chip>{badge}</Chip> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <View className="self-start rounded-md bg-muted px-2 py-1">
      <Text className="text-xs font-semibold text-muted-foreground">{children}</Text>
    </View>
  );
}

/** One row of a web table: a heading line plus label–value pairs. */
export function RowCard({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <View className="rounded-xl border border-border bg-background px-3 py-2">
      {title ? <View className="py-1">{title}</View> : null}
      {children}
    </View>
  );
}

/** Body text of a PolicyNotice dialog. */
export function NoticeText({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text
      className={`mb-3 text-sm leading-6 ${muted ? 'text-muted-foreground' : 'text-secondary'}`}>
      {children}
    </Text>
  );
}

/** A text link with a 44pt touch target is drawn by the callers with this class. */
export const linkText = 'text-sm font-bold text-primary underline';
