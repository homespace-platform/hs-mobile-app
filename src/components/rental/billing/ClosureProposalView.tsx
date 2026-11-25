// Web ContractLifecyclePanel.tsx:278-312 and dispute (:134-140): read the proposal, answer it, its history.
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { useDiscardDroppedFiles } from '@/components/rental/shared/useDiscardDroppedFiles';
import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import EvidencePicker from '@/components/rental/shared/EvidencePicker';
import { closureLabels, dt, eventLabels, money } from '@/lib/rental/ContractLifecyclePanel';
import { withFileLease } from '@/services/rental/cache';
import { contractLifecycleService } from '@/services/rental/contract-lifecycle.service';
import storageService from '@/services/rental/storage.service';
import type { LocalFile } from '@/services/storageApi';
import type { ContractLifecycle } from '@/types/rental/contract-lifecycle.type';

import { Checkbox, StorageLinks, TextArea, useToast } from './common';
import { acceptBlocked, CLOSURE_FILE_RULE, proposalKey, uploadAll } from './logic';

const EvidenceLinks = ({ ids }: { ids?: string[] }) => (
  <StorageLinks ids={ids} label="Xem minh chứng" suffix=" ↗" fallback="Không mở được minh chứng." />
);

const Body = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-sm leading-6 text-foreground">{children}</Text>
);

export default function ClosureProposalView({
  contractId,
  data,
  isLandlord,
  noDeposit,
  consent,
  onConsent,
  busy,
  perform,
}: {
  contractId: string;
  data: ContractLifecycle;
  isLandlord: boolean;
  noDeposit: boolean;
  /** The proposal key the tenant ticked, owned by the panel. */
  consent: string | null;
  onConsent: (key: string | null) => void;
  busy: boolean;
  perform: (action: () => Promise<unknown>) => void;
}) {
  const closure = data.closure!;
  const key = proposalKey(contractId, closure.proposalVersion);
  // Stricter than web: the objection (and its files) belongs to the proposal version it was written
  // against, so a newer version never receives it.
  const [draft, setDraft] = useState<{ key: string; reason: string; files: LocalFile[] }>({
    key,
    reason: '',
    files: [],
  });
  const { reason, files } = draft.key === key ? draft : { reason: '', files: [] as LocalFile[] };
  const editDraft = (patch: { reason?: string; files?: LocalFile[] }) =>
    setDraft((previous) => ({
      ...(previous.key === key ? previous : { reason: '', files: [] }),
      ...patch,
      key,
    }));
  const [picking, setPicking] = useState(false);
  const uploaded = useRef(new Map<string, string>());
  useDiscardDroppedFiles(draft.files);
  const toast = useToast();
  const shown = closure.proposalVersion > 0 && closure.status !== 'WAITING_HANDOVER';
  if (!shown) return null;
  const open = ['PROPOSED', 'DISPUTED'].includes(closure.status);

  function dispute() {
    if (picking) return;
    if (reason.trim().length < 10) {
      toast.error('Nhập lý do cần đối soát ít nhất 10 ký tự.');
      return;
    }
    const version = closure.proposalVersion;
    perform(async () => {
      await contractLifecycleService.dispute(
        contractId,
        version,
        reason.trim(),
        await withFileLease(
          files.map((file) => file.uri),
          () =>
            uploadAll(files, uploaded.current, (file) =>
              storageService.uploadClosureEvidence(file, contractId)
            )
        )
      );
      setDraft({ key, reason: '', files: [] });
    });
  }

  return (
    <Accordion
      key={`${closureLabels[closure.status]}:${open}`}
      title={`${noDeposit ? 'Đề xuất trả nhà và quyết toán' : 'Đề xuất hoàn cọc'} · Phiên bản ${closure.proposalVersion}`}
      defaultOpen={open}>
      <View className="gap-3">
        {closure.deductions?.map((row, index) => (
          <View key={index} className="gap-1 border-b border-border pb-2">
            <Body>
              {row.description} · <Text className="font-bold">{money(row.amount)}</Text>
            </Body>
            <EvidenceLinks ids={row.evidenceIds} />
          </View>
        ))}
        <Body>
          Điện cuối: {closure.electricityFinal ?? 'Không thu theo công tơ'} · Nước cuối:{' '}
          {closure.waterFinal ?? 'Không thu theo công tơ'}
        </Body>
        {(closure.utilityAdjustment ?? 0) > 0 ? (
          <Text className="text-sm leading-6 text-warning">
            Đề xuất theo luồng cũ có {money(closure.utilityAdjustment)} điện/nước trừ vào cọc. Cần
            đối soát và lập lại đề xuất theo luồng thanh toán hóa đơn trước; không tự sửa khoản đã
            chốt.
          </Text>
        ) : (
          <Body>
            Điện/nước đã chốt trên hóa đơn, không trừ vào cọc ·{' '}
            {noDeposit ? 'Khoản quyết toán khác' : 'Khấu trừ khác'}: {money(closure.otherDeduction)}
          </Body>
        )}
        <Text className="text-sm font-bold leading-6 text-foreground">
          {!noDeposit ? `Hoàn cho người thuê: ${money(closure.refundAmount)} · ` : ''}Người thuê trả
          thêm: {money(closure.balanceAmount)}
        </Text>
        {closure.note ? <Body>{closure.note}</Body> : null}
        {closure.refundDueAt && closure.status !== 'CLOSED' ? (
          <Body>Hạn quyết toán/hoàn cọc: {dt(closure.refundDueAt)}</Body>
        ) : null}
        {!isLandlord && closure.status === 'PROPOSED' ? (
          <View className="gap-3">
            <Checkbox
              checked={consent === key}
              onChange={(checked) => onConsent(checked ? key : null)}
              disabled={busy}
              label={
                noDeposit
                  ? 'Tôi xác nhận đã trả nhà, đã đọc và đồng ý các khoản quyết toán/trả thêm nếu có. Hồ sơ không phát sinh chuyển khoản hoàn cọc.'
                  : 'Tôi xác nhận đã bàn giao, đã đọc và đồng ý các khoản khấu trừ cùng số tiền hoàn/trả thêm. Đây chưa phải xác nhận đã nhận tiền hoàn.'
              }
            />
            <ActionButton
              label="Đồng ý quyết toán"
              variant="success"
              disabled={busy || acceptBlocked(data, consent, key)}
              onClick={() => {
                const version = closure.proposalVersion;
                perform(() => contractLifecycleService.accept(contractId, version));
              }}
            />
            <Accordion title="Chưa đồng ý · Gửi yêu cầu đối soát">
              <View className="gap-3">
                <TextArea
                  value={reason}
                  onChangeText={(text) => editDraft({ reason: text })}
                  maxLength={2000}
                  disabled={busy}
                  accessibilityLabel="Lý do khiếu nại quyết toán"
                  placeholder="Nêu khoản chưa đồng ý và lý do (ít nhất 10 ký tự)"
                />
                <EvidencePicker
                  // A new version starts with an empty picker, so a late pick cannot move over.
                  key={key}
                  label="Minh chứng (không bắt buộc, tối đa 5 ảnh/PDF, 15 MB/tệp)"
                  ariaLabel="Minh chứng khiếu nại"
                  value={files}
                  onChange={(next) => editDraft({ files: next })}
                  messages={CLOSURE_FILE_RULE}
                  maxCount={5}
                  replace
                  onPickingChange={setPicking}
                  disabled={busy}
                />
                <ActionButton
                  label="Gửi yêu cầu đối soát"
                  variant="danger"
                  disabled={busy || picking || reason.trim().length < 10}
                  onClick={dispute}
                />
                <Body>
                  {noDeposit
                    ? 'Chưa chốt khoản phải trả. Chủ nhà cần phản hồi bằng đề xuất mới; không coi im lặng là đồng ý.'
                    : 'Chưa tạo QR hoàn cọc. Chủ nhà cần phản hồi bằng đề xuất mới; không coi im lặng là đồng ý.'}
                </Body>
              </View>
            </Accordion>
          </View>
        ) : null}
      </View>
    </Accordion>
  );
}

export function ClosureHistory({ data }: { data: ContractLifecycle }) {
  const history = data.closure?.history;
  if (!history?.length) return null;
  return (
    <Accordion title={`Lịch sử quyết toán & khiếu nại (${history.length})`}>
      <View className="gap-3">
        {[...history].reverse().map((event, index) => (
          <View key={index} className="gap-1 border-b border-border pb-3">
            <Text className="text-sm font-bold text-foreground">
              {eventLabels[event.type] ?? event.type} · Phiên bản {event.proposalVersion}
            </Text>
            <Text className="text-sm text-muted-foreground">{dt(event.at)}</Text>
            {event.note ? <Body>{event.note}</Body> : null}
            {event.deductions?.map((row, i) => (
              <View key={i}>
                <Body>
                  {row.description} · {money(row.amount)}
                </Body>
                <EvidenceLinks ids={row.evidenceIds} />
              </View>
            ))}
            <Body>
              Hoàn: {money(event.refundAmount)} · Trả thêm: {money(event.balanceAmount)}
            </Body>
            <EvidenceLinks ids={event.evidenceIds} />
          </View>
        ))}
      </View>
    </Accordion>
  );
}
