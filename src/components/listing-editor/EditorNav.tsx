// Web ListingWizardStepper and EditSectionNav as horizontally scrolling chip rows.
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import { EDIT_SECTIONS, WIZARD_STEPS, type ListingSectionId } from '@/lib/listing-validation';

type Item = { id: string; label: string; done?: boolean; disabled?: boolean };

function ChipRow({
  items,
  active,
  onSelect,
}: {
  items: Item[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  const show = () =>
    scroll.current?.scrollTo({
      x: Math.max(0, (offsets.current.get(active) ?? 0) - 24),
      animated: true,
    });
  useEffect(show, [active]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2">
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Pressable
            key={item.id}
            disabled={item.disabled}
            onPress={() => onSelect(item.id)}
            onLayout={(event) => {
              offsets.current.set(item.id, event.nativeEvent.layout.x);
              if (selected) show();
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled: item.disabled }}
            className={`min-h-11 flex-row items-center gap-1.5 rounded-full border px-4 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'} ${item.disabled ? 'opacity-50' : ''}`}>
            {item.done ? <Icon name="checkmark" size={16} className="text-primary" /> : null}
            <Text
              className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-secondary'}`}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function WizardStepper({
  step,
  reachableUpTo,
  onSelect,
  onClose,
}: {
  step: number;
  /** Steps up to the first invalid one may be opened directly. */
  reachableUpTo: number;
  onSelect: (step: number) => void;
  onClose: () => void;
}) {
  const percent = Math.round(((step - 1) / (WIZARD_STEPS.length - 1)) * 100);
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">
          Bước {step}/{WIZARD_STEPS.length}: {WIZARD_STEPS[step - 1].label}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng biểu mẫu đăng tin"
          className="min-h-11 min-w-11 items-center justify-center">
          <Text className="text-sm font-semibold text-muted-foreground">Đóng</Text>
        </Pressable>
      </View>
      <ChipRow
        active={String(step)}
        items={WIZARD_STEPS.map((item) => ({
          id: String(item.id),
          label: `${item.id}. ${item.label}`,
          done: item.id < step,
          disabled: item.id > step && item.id > reachableUpTo,
        }))}
        onSelect={(id) => Number(id) !== step && onSelect(Number(id))}
      />
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        className="h-1.5 overflow-hidden rounded-full bg-muted">
        <View className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}

export function SectionNav({
  active,
  onSelect,
}: {
  active: ListingSectionId;
  onSelect: (id: ListingSectionId) => void;
}) {
  return (
    <View className="border-b border-border bg-surface px-4 py-2">
      <ChipRow
        items={EDIT_SECTIONS}
        active={active}
        onSelect={(id) => onSelect(id as ListingSectionId)}
      />
    </View>
  );
}
