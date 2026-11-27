// The four starting shapes (web TemplatePicker). Each is drawn in miniature so it reads at a glance.
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import Icon from '@/components/Icon';
import {
  MAX_FLOORS,
  MAX_ROOMS_PER_BATCH,
  buildTemplate,
  countRooms,
  type LayoutTemplate,
} from '@/lib/branch-layout';
import type { LayoutDraft } from '@/types/branch-layout';

import { Action, Heading, Note } from './ui';

type Kind = Exclude<LayoutTemplate['kind'], 'house'>;

const TEMPLATES: { kind: Kind; label: string; hint: string; shape: number[] }[] = [
  { kind: 'single', label: 'Một dãy', hint: 'Dãy trọ một hàng phòng.', shape: [3] },
  {
    kind: 'double',
    label: 'Hai dãy đối diện',
    hint: 'Hai cột phòng nhìn vào nhau.',
    shape: [3, 3],
  },
  { kind: 'multi', label: 'Nhà nhiều tầng', hint: 'Đánh số 101, 102, 201…', shape: [3] },
  { kind: 'custom', label: 'Tự thiết kế', hint: 'Bấm nút + để thêm từng phòng.', shape: [1] },
];

function Miniature({ kind, shape }: { kind: Kind; shape: number[] }) {
  const bar = (key: number) => <View key={key} className="h-2.5 w-4 rounded-sm bg-primary" />;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      className="w-12 items-center justify-center">
      {kind === 'multi' ? (
        <View className="gap-1">
          {[0, 1, 2].map((floor) => (
            <View key={floor} className="flex-row gap-0.5 border-b-2 border-border-strong pb-0.5">
              {[0, 1, 2].map((i) => (
                <View key={i} className="h-2 w-2.5 rounded-sm bg-primary" />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View className="flex-row items-start gap-2">
          {shape.map((cells, column) => (
            <View key={column} className="items-center gap-1">
              {Array.from({ length: cells }, (_, i) => bar(i))}
              {kind === 'custom' ? <Icon name="add" size={16} className="text-primary" /> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Number with − and + so the common case needs no keyboard. */
function Stepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
}) {
  const number = Number(value) || 0;
  const step = (delta: number) => onChange(String(Math.min(max, Math.max(1, number + delta))));
  const button = (icon: 'remove' | 'add', delta: number, name: string, off: boolean) => (
    <Pressable
      onPress={() => step(delta)}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label.toLowerCase()}`}
      accessibilityState={{ disabled: off }}
      className={`min-h-[48px] w-[48px] items-center justify-center rounded-xl border border-border bg-surface active:bg-muted ${off ? 'opacity-40' : ''}`}>
      <Icon name={icon} size={22} className="text-primary" />
    </Pressable>
  );
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-secondary">{label}</Text>
      <View className="flex-row items-stretch gap-2">
        {button('remove', -1, 'Giảm', number <= 1)}
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          selectTextOnFocus
          accessibilityLabel={label}
          className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-center text-lg font-bold text-foreground selection:text-primary"
        />
        {button('add', 1, 'Tăng', number >= max)}
      </View>
    </View>
  );
}

export default function TemplatePicker({
  disabled,
  onPick,
  onCancel,
}: {
  disabled: boolean;
  onPick: (draft: LayoutDraft) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<Kind>('single');
  const [floors, setFloors] = useState('3');
  const [rooms, setRooms] = useState('5');
  const inRange = (value: string, max: number) => Number(value) >= 1 && Number(value) <= max;
  const error =
    kind === 'multi' && !inRange(floors, MAX_FLOORS)
      ? `Số tầng từ 1 đến ${MAX_FLOORS}.`
      : kind !== 'custom' && !inRange(rooms, MAX_ROOMS_PER_BATCH)
        ? `Số phòng từ 1 đến ${MAX_ROOMS_PER_BATCH}.`
        : '';
  const shape = { kind, floors: Number(floors), rooms: Number(rooms) };

  return (
    <View className="gap-3">
      <Heading>Chọn mẫu (sửa lại được trước khi lưu)</Heading>
      <View accessibilityRole="radiogroup" className="gap-2">
        {TEMPLATES.map((template) => {
          const selected = kind === template.kind;
          return (
            <Pressable
              key={template.kind}
              onPress={() => setKind(template.kind)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${template.label}. ${template.hint}`}
              className={`min-h-[72px] flex-row items-center gap-3 rounded-2xl border-2 px-3 py-3 active:bg-muted ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
              <Miniature kind={template.kind} shape={template.shape} />
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">{template.label}</Text>
                <Text className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {template.hint}
                </Text>
              </View>
              <Icon
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                className={selected ? 'text-primary' : 'text-muted-foreground'}
              />
            </Pressable>
          );
        })}
      </View>
      {kind === 'multi' ? (
        <Stepper label="Số tầng" value={floors} max={MAX_FLOORS} onChange={setFloors} />
      ) : null}
      {kind !== 'custom' ? (
        <Stepper
          label={
            kind === 'single'
              ? 'Số phòng'
              : kind === 'double'
                ? 'Số phòng mỗi dãy'
                : 'Số phòng mỗi tầng'
          }
          value={rooms}
          max={MAX_ROOMS_PER_BATCH}
          onChange={setRooms}
        />
      ) : null}
      {error ? (
        <Note tone="error" text={error} />
      ) : kind !== 'custom' ? (
        <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">
          Sẽ tạo {countRooms(buildTemplate(shape))} phòng.
        </Text>
      ) : null}
      <Action
        label="Dùng mẫu này"
        variant="primary"
        disabled={disabled || Boolean(error)}
        onClick={() => onPick(buildTemplate(shape))}
      />
      {onCancel ? <Action label="Quay lại sơ đồ" onClick={onCancel} /> : null}
    </View>
  );
}
