// The menus of a cell, a row, a floor and the bulk re-code (web LayoutDialogs). One action closes
// the sheet; moving is by menu, there is no drag and drop.
import { useState } from 'react';
import { Text, View } from 'react-native';

import ModalShell from '@/components/rental/shared/ModalShell';
import {
  MAX_ROOMS_PER_BATCH,
  addEmptyCell,
  addRooms,
  findSlot,
  moveSlot,
  moveSlotToRow,
  recodeRooms,
  removeFloor,
  removeRow,
  removeSlot,
  renameFloor,
  renameRow,
  roomCodeError,
  setRoomCode,
  toggleEmptyCell,
} from '@/lib/branch-layout';
import type { LayoutDraft } from '@/types/branch-layout';

import { Action, Heading, Input, Row } from './ui';

export type SheetTarget = { type: 'cell' | 'row' | 'floor' | 'recode'; key: string };

type Apply = (next: LayoutDraft, notice: string) => void;

/** One field with its submit button (rename, add many). */
function InlineForm({
  label,
  initial,
  button,
  numeric,
  validate,
  onSubmit,
}: {
  label: string;
  initial: string;
  button: string;
  numeric?: boolean;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const submit = () => {
    const problem = validate ? validate(value) : value.trim() ? null : 'Vui lòng nhập nội dung.';
    if (problem) setError(problem);
    else onSubmit(value);
  };
  return (
    <View className="gap-2">
      <Input
        label={label}
        value={value}
        maxLength={numeric ? 3 : 50}
        keyboardType={numeric ? 'number-pad' : 'default'}
        error={error}
        onSubmitEditing={submit}
        onChangeText={(text) => {
          setValue(numeric ? text.replace(/\D/g, '') : text);
          setError('');
        }}
      />
      <Action label={button} onClick={submit} />
    </View>
  );
}

function CellBody({
  draft,
  slotKey,
  apply,
}: {
  draft: LayoutDraft;
  slotKey: string;
  apply: Apply;
}) {
  const [moving, setMoving] = useState(false);
  const found = findSlot(draft, slotKey);
  if (!found) return null;
  const { slot, row, index } = found;
  const others = draft.flatMap((f) =>
    f.rows
      .filter((r) => r.key !== row.key)
      .map((r) => ({ key: r.key, label: `${f.label} · ${r.label}` }))
  );
  return (
    <>
      {slot.roomCode !== null ? (
        <InlineForm
          label="Mã phòng"
          initial={slot.roomCode}
          button="Đổi mã"
          validate={(value) => roomCodeError(draft, slotKey, value)}
          onSubmit={(value) =>
            apply(setRoomCode(draft, slotKey, value), `Đã đổi mã thành ${value.trim()}.`)
          }
        />
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <Action
          label="Chuyển lên"
          icon="arrow-up"
          className="grow"
          disabled={index === 0}
          onClick={() => apply(moveSlot(draft, slotKey, -1), 'Đã chuyển lên.')}
        />
        <Action
          label="Chuyển xuống"
          icon="arrow-down"
          className="grow"
          disabled={index === row.slots.length - 1}
          onClick={() => apply(moveSlot(draft, slotKey, 1), 'Đã chuyển xuống.')}
        />
      </View>
      {others.length > 0 ? (
        <View className="gap-2">
          <Row
            title="Chuyển sang dãy khác"
            expanded={moving}
            onPress={() => setMoving((value) => !value)}
          />
          {moving ? (
            <View className="gap-2 pl-3">
              {others.map((other) => (
                <Row
                  key={other.key}
                  title={other.label}
                  trailing="Chuyển"
                  onPress={() =>
                    apply(
                      moveSlotToRow(draft, slotKey, other.key),
                      `Đã chuyển sang ${other.label}.`
                    )
                  }
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <Action
        label={slot.roomCode === null ? 'Đổi thành phòng' : 'Đổi thành ô trống (cầu thang, lối đi)'}
        onClick={() => apply(toggleEmptyCell(draft, slotKey), 'Đã đổi loại ô.')}
      />
      <Action
        label="Xoá ô này"
        variant="danger"
        icon="trash-outline"
        onClick={() => apply(removeSlot(draft, slotKey), 'Đã xoá ô. Bấm Hoàn tác nếu xoá nhầm.')}
      />
    </>
  );
}

function RecodeBody({
  draft,
  initialFloor,
  apply,
}: {
  draft: LayoutDraft;
  /** "" = every floor. */
  initialFloor: string;
  apply: Apply;
}) {
  const [floorKey, setFloorKey] = useState(initialFloor);
  const [prefix, setPrefix] = useState('');
  const [start, setStart] = useState('');
  const next = recodeRooms(draft, {
    floorKey: floorKey || undefined,
    prefix,
    start: start.trim() ? Number(start) : undefined,
  });
  const sample = next
    .filter((f) => !floorKey || f.key === floorKey)
    .flatMap((f) =>
      f.rows.flatMap((r) => r.slots.flatMap((s) => (s.roomCode === null ? [] : [s.roomCode])))
    );
  const preview = sample.length
    ? `Mã mới: ${sample.slice(0, 4).join(', ')}${sample.length > 4 ? ` … ${sample[sample.length - 1]}` : ''}`
    : 'Không có phòng nào để đặt mã.';
  return (
    <>
      <View accessibilityRole="radiogroup" className="gap-2">
        <Heading>Áp dụng cho</Heading>
        <Row title="Tất cả các tầng" selected={!floorKey} onPress={() => setFloorKey('')} />
        {draft.map((f) => (
          <Row
            key={f.key}
            title={f.label}
            selected={floorKey === f.key}
            onPress={() => setFloorKey(f.key)}
          />
        ))}
      </View>
      <Input
        label="Chữ đứng trước mã (không bắt buộc)"
        value={prefix}
        maxLength={10}
        autoCapitalize="characters"
        placeholder="Ví dụ: P"
        onChangeText={setPrefix}
      />
      {floorKey ? (
        <Input
          label="Số bắt đầu (bỏ trống để đánh theo tầng)"
          value={start}
          maxLength={6}
          keyboardType="number-pad"
          placeholder="Ví dụ: 101"
          onChangeText={(text) => setStart(text.replace(/\D/g, ''))}
        />
      ) : null}
      <Text accessibilityLiveRegion="polite" className="text-sm leading-5 text-muted-foreground">
        {preview}
      </Text>
      <Action
        label="Đặt lại mã"
        variant="primary"
        disabled={sample.length === 0}
        onClick={() => apply(next, 'Đã đặt lại mã phòng.')}
      />
    </>
  );
}

export default function LayoutSheets({
  draft,
  target,
  onTarget,
  apply,
}: {
  draft: LayoutDraft;
  target: SheetTarget | null;
  onTarget: (target: SheetTarget | null) => void;
  apply: Apply;
}) {
  if (!target) return null;
  const floor =
    target.type === 'row'
      ? draft.find((f) => f.rows.some((r) => r.key === target.key))
      : draft.find((f) => f.key === target.key);
  const row = floor?.rows.find((r) => r.key === target.key);
  const cell = target.type === 'cell' ? findSlot(draft, target.key) : null;
  const title =
    target.type === 'recode'
      ? 'Đặt lại mã phòng'
      : cell
        ? `${cell.slot.roomCode === null ? 'Ô trống' : `Phòng ${cell.slot.roomCode}`} · ${cell.floor.label}, ${cell.row.label}`
        : target.type === 'row' && row
          ? `${row.label} · ${floor!.label}`
          : target.type === 'floor' && floor
            ? floor.label
            : null;
  if (title === null) return null;

  return (
    <ModalShell key={`${target.type}-${target.key}`} title={title} onClose={() => onTarget(null)}>
      <View className="gap-4">
        {target.type === 'cell' ? (
          <CellBody draft={draft} slotKey={target.key} apply={apply} />
        ) : target.type === 'recode' ? (
          <RecodeBody draft={draft} initialFloor={target.key} apply={apply} />
        ) : target.type === 'row' ? (
          <>
            <InlineForm
              label="Tên dãy"
              initial={row!.label}
              button="Đổi tên"
              onSubmit={(value) => apply(renameRow(draft, row!.key, value), 'Đã đổi tên dãy.')}
            />
            <InlineForm
              label="Thêm nhiều phòng (số lượng)"
              initial="5"
              button="Thêm phòng"
              numeric
              validate={(value) =>
                Number(value) >= 1 && Number(value) <= MAX_ROOMS_PER_BATCH
                  ? null
                  : `Nhập số từ 1 đến ${MAX_ROOMS_PER_BATCH}.`
              }
              onSubmit={(value) =>
                apply(addRooms(draft, row!.key, Number(value)), `Đã thêm ${Number(value)} phòng.`)
              }
            />
            <Action
              label="Thêm ô trống (cầu thang, lối đi)"
              onClick={() => apply(addEmptyCell(draft, row!.key), 'Đã thêm ô trống.')}
            />
            <Action
              label="Xoá dãy này"
              variant="danger"
              icon="trash-outline"
              onClick={() =>
                apply(removeRow(draft, row!.key), 'Đã xoá dãy. Bấm Hoàn tác nếu xoá nhầm.')
              }
            />
          </>
        ) : (
          <>
            <InlineForm
              label="Tên tầng hoặc khu"
              initial={floor!.label}
              button="Đổi tên"
              onSubmit={(value) => apply(renameFloor(draft, floor!.key, value), 'Đã đổi tên tầng.')}
            />
            <Action
              label="Đặt lại mã phòng của tầng"
              onClick={() => onTarget({ type: 'recode', key: floor!.key })}
            />
            <Action
              label="Xoá tầng này"
              variant="danger"
              icon="trash-outline"
              onClick={() =>
                apply(removeFloor(draft, floor!.key), 'Đã xoá tầng. Bấm Hoàn tác nếu xoá nhầm.')
              }
            />
          </>
        )}
      </View>
    </ModalShell>
  );
}
