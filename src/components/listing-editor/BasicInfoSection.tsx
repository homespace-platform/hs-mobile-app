import { Pressable, Text, View } from 'react-native';

import { Anchor } from '@/components/rental/contract/anchors';
import DateField from '@/components/rental/shared/DateField';
import {
  BRANCH_NONE_LABEL,
  branchLabel,
  canChangeCategory,
  getTodayDateString,
  isSupportedBranch,
  PROPERTY_CATEGORIES,
  type ListingEditorMode,
  type PropertyCategoryKey,
} from '@/lib/listing-form';
import type { Branch } from '@/services/branchApi';

import MediaField from './MediaField';
import { FieldLabel, Section, SelectField, TextField, type SectionProps } from './ui';

export default function BasicInfoSection({
  mode,
  branches,
  saving,
  onSelectBranch,
  onRequestCategory,
  ...props
}: SectionProps & {
  mode: ListingEditorMode;
  branches: Branch[];
  saving: boolean;
  onSelectBranch: (branchId: string) => void;
  onRequestCategory: (category: PropertyCategoryKey) => void;
}) {
  const { state, update, errors } = props;
  const { basicInfo } = state;
  const locked = !canChangeCategory(state, mode);
  const set = (patch: Partial<typeof basicInfo>) =>
    update((s) => ({ ...s, basicInfo: { ...s.basicInfo, ...patch } }));

  return (
    <Section
      title="Thông tin cơ bản"
      description="Thông tin chung, hình ảnh và loại hình cho thuê.">
      <SelectField
        label="Chi nhánh / Tòa nhà"
        hint="Chọn chi nhánh để tự động gán thông tin."
        value={basicInfo.branchId ?? ''}
        options={[
          { value: '', label: BRANCH_NONE_LABEL },
          ...branches
            .filter(isSupportedBranch)
            .map((branch) => ({ value: branch.id, label: branchLabel(branch) })),
        ]}
        // A branch that is no longer in the list stays selected until the user picks another.
        placeholder="Chi nhánh đã chọn"
        onChange={onSelectBranch}
      />
      <Anchor id="title">
        <TextField
          label="Tiêu đề tin đăng *"
          value={basicInfo.title}
          // Wraps like a paragraph, but stays one line of text as on web.
          onChangeText={(title) => set({ title: title.replace(/[\r\n]+/g, ' ') })}
          submitBehavior="blurAndSubmit"
          placeholder="Ví dụ: Căn hộ 2PN cao cấp view sông thoáng mát tại Vinhomes Central Park"
          maxLength={150}
          multiline
          error={errors.title}
          hint={`Rõ ràng, hấp dẫn (tối thiểu 15 ký tự). ${basicInfo.title.length}/150`}
        />
      </Anchor>
      <MediaField {...props} saving={saving} />
      <View className="gap-2">
        <FieldLabel text="Loại hình *" />
        {PROPERTY_CATEGORIES.map((category) => {
          const active = basicInfo.category === category.key;
          return (
            <Pressable
              key={category.key}
              disabled={locked}
              onPress={() => onRequestCategory(category.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled: locked }}
              className={`min-h-12 justify-center rounded-xl border px-4 py-2.5 ${active ? 'border-primary bg-primary-soft' : 'border-border bg-surface'} ${locked && !active ? 'opacity-50' : ''}`}>
              <Text className={`text-sm font-bold ${active ? 'text-primary' : 'text-foreground'}`}>
                {category.label}
                {active && basicInfo.branchId ? ' · Theo chi nhánh' : ''}
              </Text>
            </Pressable>
          );
        })}
        {locked ? (
          <Text className="text-xs leading-5 text-warning">
            {mode === 'edit'
              ? 'Loại hình được cố định sau khi tạo bài đăng.'
              : 'Loại hình bất động sản được chọn tự động và cố định từ chi nhánh đã chọn.'}
          </Text>
        ) : null}
      </View>
      <Anchor id="availableDate">
        <DateField
          label="Ngày có thể vào thuê / bàn giao *"
          value={basicInfo.availableDate}
          min={getTodayDateString()}
          onChange={(availableDate) => set({ availableDate })}
          error={errors.availableDate}
          hint={
            mode === 'edit' && basicInfo.availableDate < getTodayDateString()
              ? 'Ngày đã đăng được giữ nguyên nếu bạn không đổi.'
              : 'Từ hôm nay trở đi.'
          }
        />
      </Anchor>
    </Section>
  );
}
