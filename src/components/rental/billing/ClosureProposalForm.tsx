// Web ContractLifecyclePanel.tsx:250-277 and propose (:96-125): the landlord's settlement proposal.
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import ActionButton from '@/components/rental/shared/ActionButton';
import EvidencePicker from '@/components/rental/shared/EvidencePicker';
import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import VndMoneyInput from '@/components/rental/shared/VndMoneyInput';
import { money } from '@/lib/rental/ContractLifecyclePanel';
import { withFileLease } from '@/services/rental/cache';
import { contractLifecycleService } from '@/services/rental/contract-lifecycle.service';
import storageService from '@/services/rental/storage.service';
import type { LocalFile } from '@/services/storageApi';
import type { ClosureDeduction, ContractLifecycle } from '@/types/rental/contract-lifecycle.type';

import { Checkbox, LineInput, LinkButton, StorageLinks, TextArea, useToast } from './common';
import { CLOSURE_FILE_RULE, deductionTotal, proposalError, uploadAll } from './logic';

type DeductionDraft = ClosureDeduction & { key: string; files: LocalFile[] };

export default function ClosureProposalForm({
  contractId,
  data,
  noDeposit,
  handover,
  onHandover,
  busy,
  perform,
}: {
  contractId: string;
  data: ContractLifecycle;
  noDeposit: boolean;
  /** Owned by the panel: a new proposal version clears it. */
  handover: boolean;
  onHandover: (value: boolean) => void;
  busy: boolean;
  perform: (action: () => Promise<unknown>) => void;
}) {
  const [rows, setRows] = useState<DeductionDraft[]>([]);
  const [note, setNote] = useState('');
  // Pickers still open or being read: nothing is sent meanwhile (RB-01).
  const [picking, setPicking] = useState(0);
  const uploaded = useRef(new Map<string, string>());
  const toast = useToast();
  const closure = data.closure!;
  useDiscardDroppedFiles(rows.flatMap((row) => row.files));
  const deduction = deductionTotal(rows);
  const trackPicking = (on: boolean) => setPicking((count) => count + (on ? 1 : -1));
  const edit = (key: string, patch: Partial<DeductionDraft>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function propose() {
    if (picking > 0) return;
    const invalid = proposalError(handover, note, rows);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    perform(async () => {
      const picked = rows.flatMap((row) => row.files.map((file) => file.uri));
      const deductions = await withFileLease(picked, () =>
        Promise.all(
          rows.map(async (row) => ({
            description: row.description.trim(),
            amount: row.amount,
            evidenceIds: [
              ...row.evidenceIds,
              ...(await uploadAll(row.files, uploaded.current, (file) =>
                storageService.uploadClosureEvidence(file, contractId)
              )),
            ],
          }))
        )
      );
      await contractLifecycleService.propose(contractId, {
        otherDeduction: deduction,
        deductions,
        expectedProposalVersion: closure.proposalVersion ?? 0,
        note: note.trim(),
        vacantPossessionConfirmed: true,
      });
      setRows([]);
      setNote('');
      onHandover(false);
    });
  }

  const tenantPaysMore = noDeposit || (data.heldDeposit != null && deduction > data.heldDeposit);

  return (
    <View className="gap-3 rounded-2xl border border-border bg-muted p-3">
      <Text accessibilityRole="header" className="text-sm font-bold leading-6 text-foreground">
        Bước 2 ·{' '}
        {noDeposit
          ? 'Xác nhận trả nhà và quyết toán sau khi thanh toán đủ hóa đơn'
          : 'Lập đề xuất quyết toán cọc sau khi thanh toán đủ hóa đơn'}
      </Text>
      {closure.proposalVersion > 0 ? (
        <LinkButton
          label="Lấy nội dung đề xuất hiện tại để chỉnh sửa"
          disabled={busy}
          onPress={() => {
            setRows(
              (closure.deductions ?? []).map((row) => ({ ...row, key: randomUUID(), files: [] }))
            );
            setNote(closure.note ?? '');
            onHandover(false);
          }}
        />
      ) : null}
      <PolicyNotice
        tone="neutral"
        title="Nguyên tắc nhập khoản khấu trừ"
        actionLabel="Xem nguyên tắc"
        text={
          noDeposit
            ? 'Điện/nước và chi phí kỳ cuối đã thanh toán riêng qua hóa đơn. Chỉ nhập khoản phải trả khác có căn cứ theo thỏa thuận (ví dụ hư hại tài sản), không thu hai lần; người thuê cần đồng ý đúng phiên bản.'
            : 'Điện/nước và chi phí kỳ cuối đã thanh toán riêng qua hóa đơn, không trừ cọc lần nữa. Chỉ nhập khấu trừ cọc khác theo thỏa thuận (ví dụ hư hại tài sản), có nội dung rõ ràng và người thuê đồng ý.'
        }
      />
      {rows.length === 0 ? (
        <Text className="text-sm leading-6 text-success">
          {noDeposit
            ? 'Không có khoản phải trả thêm: xác nhận trả nhà và hoàn tất, bỏ qua chuyển khoản hoàn cọc.'
            : 'Không có khoản khấu trừ: đề xuất hoàn nguyên cọc.'}
        </Text>
      ) : null}
      {rows.map((row, index) => (
        <View key={row.key} className="gap-3 rounded-2xl border border-border bg-surface p-3">
          <Text className="text-sm font-bold text-foreground">
            {noDeposit ? 'Khoản quyết toán' : 'Khoản khấu trừ'} {index + 1}
          </Text>
          <View className="gap-1">
            <Text className="text-sm font-semibold text-foreground">Nội dung / căn cứ</Text>
            <LineInput
              value={row.description}
              onChangeText={(description) => edit(row.key, { description })}
              maxLength={300}
              disabled={busy}
              accessibilityLabel={`Nội dung khấu trừ ${index + 1}`}
              placeholder="Ví dụ: thay kính cửa bị vỡ"
            />
          </View>
          <VndMoneyInput
            label="Số tiền (đ)"
            ariaLabel={`Số tiền khấu trừ ${index + 1}`}
            min={1}
            value={row.amount || ''}
            onValueChange={(amount) => edit(row.key, { amount: Number(amount) })}
            disabled={busy}
          />
          <StorageLinks
            ids={row.evidenceIds}
            label="Xem minh chứng"
            suffix=" ↗"
            fallback="Không mở được minh chứng."
          />
          <EvidencePicker
            label="Minh chứng (không bắt buộc, tối đa 5 ảnh/PDF, 15 MB/tệp)"
            ariaLabel={`Minh chứng khấu trừ ${index + 1}`}
            value={row.files}
            onChange={(files) => edit(row.key, { files })}
            messages={CLOSURE_FILE_RULE}
            maxCount={5}
            existingCount={row.evidenceIds.length}
            replace
            onPickingChange={trackPicking}
            disabled={busy}
          />
          <LinkButton
            label="Xóa khoản này"
            danger
            disabled={busy}
            onPress={() => setRows((list) => list.filter((item) => item.key !== row.key))}
          />
        </View>
      ))}
      <ActionButton
        label={noDeposit ? '+ Thêm khoản phải trả' : '+ Thêm khoản khấu trừ'}
        variant="secondary"
        disabled={busy || rows.length >= 20}
        onClick={() =>
          setRows((list) => [
            ...list,
            { key: randomUUID(), description: '', amount: 0, evidenceIds: [], files: [] },
          ])
        }
      />
      <View className="rounded-2xl border border-border bg-surface px-3">
        <InfoRow label="Cọc đang giữ" value={money(data.heldDeposit)} />
        <InfoRow
          label={noDeposit ? 'Tổng khoản phải trả' : 'Tổng khấu trừ'}
          value={money(deduction)}
        />
        <InfoRow
          label={tenantPaysMore ? 'Người thuê trả thêm dự kiến' : 'Hoàn cho người thuê dự kiến'}
          value={money(data.heldDeposit == null ? null : Math.abs(data.heldDeposit - deduction))}
          strong
        />
      </View>
      <TextArea
        value={note}
        onChangeText={setNote}
        maxLength={2000}
        disabled={busy}
        accessibilityLabel="Nội dung quyết toán"
        placeholder={
          noDeposit
            ? 'Mô tả trả nhà và các khoản đã đối chiếu; ghi rõ nếu không còn nghĩa vụ tiền (ít nhất 10 ký tự)…'
            : 'Mô tả bàn giao và căn cứ khấu trừ; nếu không khấu trừ, ghi rõ hoàn nguyên cọc (ít nhất 10 ký tự)…'
        }
      />
      <Checkbox
        checked={handover}
        onChange={onHandover}
        disabled={busy}
        label="Tôi đã nhận lại phòng trống, chìa khóa, tài sản thuê; đã đối chiếu đủ hóa đơn và không thu trùng các khoản đã thanh toán."
      />
      <ActionButton
        label="Gửi đề xuất quyết toán"
        disabled={busy || !handover || picking > 0}
        onClick={propose}
      />
    </View>
  );
}
