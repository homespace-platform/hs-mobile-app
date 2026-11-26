import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Anchor } from '@/components/rental/contract/anchors';
import ActionButton from '@/components/rental/shared/ActionButton';
import { DESCRIPTION_STEPS } from '@/lib/listing-description';
import { DESCRIPTION_MAX } from '@/lib/listing-validation';

import { Section, TextField, type SectionProps } from './ui';

/** Mounted only while generating, so the rotation restarts each time. */
function GeneratingStatus() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setStep((value) => Math.min(value + 1, DESCRIPTION_STEPS.length - 1)),
      1300
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <Text accessibilityLiveRegion="polite" className="text-sm font-semibold text-primary">
      {DESCRIPTION_STEPS[step]}
    </Text>
  );
}

export default function DescriptionSection({
  state,
  update,
  errors,
  generating,
  onGenerate,
}: SectionProps & { generating: boolean; onGenerate: () => void }) {
  const { description } = state.basicInfo;
  const outOfRange = description.length < 30 || description.trim().length > DESCRIPTION_MAX;
  return (
    <Section title="Mô tả chi tiết" description="Giúp người thuê hiểu rõ không gian.">
      <ActionButton
        label="Tạo mô tả AI"
        icon="sparkles-outline"
        busy={generating}
        onClick={onGenerate}
      />
      {generating ? <GeneratingStatus /> : null}
      <Anchor id="description" className="gap-1">
        <TextField
          label="Nội dung mô tả chi tiết bài đăng *"
          multiline
          // A phone keyboard needs the field to stay shorter than the visible area.
          style={{ maxHeight: 320, minHeight: 180 }}
          editable={!generating}
          value={description}
          onChangeText={(value) =>
            update((s) => ({ ...s, basicInfo: { ...s.basicInfo, description: value } }))
          }
          placeholder="Nhập mô tả chi tiết về không gian, đặc điểm nổi bật, môi trường sống, giao thông thuận tiện..."
          error={errors.description}
          hint="Mô tả rõ ràng giúp người thuê đặt lịch xem nhanh hơn. Độ dài khuyến nghị: 100 - 1000 từ."
        />
        <Text className={`text-right text-xs ${outOfRange ? 'text-warning' : 'text-success'}`}>
          {description.length}/{DESCRIPTION_MAX} ký tự
          {description.length < 30 ? ' (tối thiểu 30 ký tự)' : ''}
        </Text>
      </Anchor>
    </Section>
  );
}
