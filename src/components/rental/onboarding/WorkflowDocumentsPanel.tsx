// Web: components/rental-request/WorkflowDocumentsPanel.tsx. Signing and the PDF viewer belong to
// owner C (SmartCaSignaturePanel, ContractPdfViewerModal).
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import ContractPdfViewerModal from '@/components/rental/contract/ContractPdfViewerModal';
import SmartCaSignaturePanel from '@/components/rental/contract/SmartCaSignaturePanel';
import { workflowPdf, workflowRow } from '@/components/rental/contract/signingLogic';
import ActionButton from '@/components/rental/shared/ActionButton';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { useAgreementChangeSync } from '@/lib/rental-sync/hooks';
import { contractService } from '@/services/rental/contract.service';
import { rentalWorkflowService as service } from '@/services/rental/rental-workflow.service';
import type {
  ContractDocumentResponse,
  ContractResponse,
  SignatureStateResponse,
} from '@/types/rental/contract.type';
import type {
  RentalWorkflow,
  WorkflowDocument,
  WorkflowKind,
} from '@/types/rental/rental-workflow.type';

import { ChoiceButton, openUrl, useToast } from './common';
import { createCoalesced } from './logic';

/** `agreementId` (from a signing notice) selects that exact document, only from the viewer's own list. */
export default function WorkflowDocumentsPanel({
  rentalRequestId,
  kind,
  data,
  agreementId,
  onUpdated,
  onFocusRequest,
}: {
  rentalRequestId: string;
  kind: WorkflowKind;
  data: RentalWorkflow;
  agreementId?: string;
  onUpdated: () => Promise<unknown> | void;
  /** The requested document is loaded: the host scrolls to this offset (web scrollIntoView). */
  onFocusRequest?: (y: number) => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<WorkflowDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Held with the notice it was made under, so a new notice never draws the previous choice.
  const [choice, setChoice] = useState({ notice: agreementId, id: agreementId ?? '' });
  const selected = choice.notice === agreementId ? choice.id : (agreementId ?? '');
  const [detail, setDetail] = useState<{
    id: string;
    contract: ContractResponse;
    state: SignatureStateResponse;
    documents: ContractDocumentResponse[];
  } | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ContractDocumentResponse | null>(null);
  const mounted = useRef(true);
  const focusedFor = useRef<string | null>(null);
  const offset = useRef(0);

  // An unknown/stale requested document never silently becomes a different one.
  const current = workflowRow(rows, selected, agreementId);
  const unmatched = !!agreementId && selected === agreementId && !current;
  const requestedMissing = unmatched && loaded;
  const currentId = current?.signingContractId;

  // The owner keys this component by request and kind, so both are fixed for its lifetime.
  const [load] = useState(() =>
    createCoalesced(
      async (superseded) => {
        try {
          const list = await service.documents(rentalRequestId, kind);
          if (!mounted.current) return;
          setRows(list);
          setError('');
          if (!superseded()) setLoaded(true);
        } catch (e) {
          if (mounted.current) setError(getApiErrorMessage(e, 'Chưa tải được văn bản nguồn.'));
        }
      },
      () => mounted.current
    )
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    void load();
  }, [load, data.revision]);
  // A new notice for another document of the same page: reset to it and re-read the list once.
  const seen = useRef(agreementId);
  useEffect(() => {
    if (seen.current === agreementId) return;
    seen.current = agreementId;
    setChoice({ notice: agreementId, id: agreementId ?? '' });
    setPreview(null);
    if (agreementId) {
      setLoaded(false);
      void load();
    }
  }, [agreementId, load]);
  useAgreementChangeSync(
    (id) => !id || id === agreementId || rows.some((r) => r.signingContractId === id),
    async () => {
      await load();
      if (mounted.current) await onUpdated();
    }
  );
  useEffect(() => {
    if (!currentId) return;
    let active = true;
    const id = currentId;
    void Promise.all([
      contractService.getContract(id),
      contractService.getSignatureState(id),
      contractService.getDocuments(id),
    ])
      .then(([contract, state, documents]) => {
        if (active) setDetail({ id, contract, state, documents });
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e, 'Chưa đọc được PDF/trạng thái ký.'));
      });
    return () => {
      active = false;
    };
  }, [currentId, rows]);

  const ready = detail && detail.id === current?.signingContractId ? detail : null;
  // Landing focus: once per requested document, after its details loaded, never while typing.
  useEffect(() => {
    if (!agreementId || ready?.id !== agreementId || focusedFor.current === agreementId) return;
    focusedFor.current = agreementId;
    if (!TextInput.State.currentlyFocusedInput()) onFocusRequest?.(offset.current);
  }, [agreementId, ready?.id, onFocusRequest]);

  const documents = ready?.documents ?? [];
  const pdf = ready ? workflowPdf(documents, ready.contract, !!current?.signedAt) : undefined;
  const word = documents.find(
    (d) => d.status === 'READY' && d.purpose === 'OFFICIAL' && d.documentType === 'DOCX'
  );
  const signingAllowed = data.status === 'APPROVED' && !!current?.current && !current.signedAt;

  async function downloadWord(document: ContractDocumentResponse) {
    try {
      const fresh = await contractService.getDocument(document.id);
      if (
        fresh.id !== document.id ||
        fresh.contractId !== document.contractId ||
        fresh.documentType !== 'DOCX' ||
        fresh.purpose !== 'OFFICIAL' ||
        fresh.status !== 'READY' ||
        !fresh.downloadUrl
      )
        throw new Error('Chưa tải được đúng Word phụ lục.');
      await openUrl(fresh.downloadUrl);
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không tải được Word phụ lục.'));
    }
  }

  return (
    <View
      onLayout={(event) => {
        offset.current = event.nativeEvent.layout.y;
      }}
      accessibilityLabel="Văn bản thỏa thuận và chữ ký"
      className="gap-3 rounded-2xl border border-border p-3">
      <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
        Phụ lục điều chỉnh thời hạn & chữ ký SmartCA
      </Text>
      <PolicyNotice
        tone="neutral"
        title="Phụ lục điều chỉnh thời hạn"
        summary="Chỉ đủ hai chữ ký được kiểm chứng mới cập nhật hạn thuê.">
        <Text className="text-sm leading-6 text-secondary">
          Phụ lục được điền từ mẫu Word và điều khoản hợp đồng đang áp dụng, ghi rõ thời hạn cũ và
          thời hạn mới. Chủ nhà ký trước, người thuê ký sau trên cùng PDF. Chỉ đủ hai chữ ký được
          kiểm chứng mới cập nhật hạn thuê; HĐ gốc giữ nguyên. Chữ ký không xác nhận đã bàn giao
          hoặc nhận tiền.
        </Text>
      </PolicyNotice>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger">
          {error}
        </Text>
      ) : null}
      <ActionButton
        label="Tải lại văn bản"
        icon="refresh"
        variant="secondary"
        onClick={() => void load()}
      />
      {requestedMissing ? (
        <Text accessibilityLiveRegion="polite" className="text-sm leading-6 text-foreground">
          Không tìm thấy văn bản được chọn hoặc bạn không có quyền xem. Chưa có văn bản nào được tự
          chọn thay thế.
        </Text>
      ) : null}
      {rows.length > 1 || (unmatched && rows.length > 0) ? (
        <View accessibilityLabel="Chọn phiên bản văn bản" className="gap-2">
          {rows.map((row, index) => (
            <ChoiceButton
              key={row.signingContractId}
              label={`Bản ${rows.length - index} · ${row.current ? 'hiện tại' : 'lưu trữ'} · ${row.signedAt ? 'đã ký đủ' : 'chưa ký đủ'}`}
              selected={current?.signingContractId === row.signingContractId}
              onPress={() => setChoice({ notice: agreementId, id: row.signingContractId })}
            />
          ))}
        </View>
      ) : null}
      {current && !current.current ? (
        <Text className="text-sm leading-6 text-foreground">
          Bản cũ chỉ để tra cứu; không ký hoặc áp dụng thay cho nội dung mới.
        </Text>
      ) : null}
      {word ? (
        <ActionButton
          label="Tải Word phụ lục"
          icon="download-outline"
          variant="secondary"
          onClick={() => void downloadWord(word)}
        />
      ) : null}
      {pdf ? (
        <ActionButton
          label={`Xem / tải PDF ${pdf.purpose === 'SIGNED_FINAL' ? 'đã ký đủ' : 'nguồn'}`}
          icon="document-text-outline"
          variant="secondary"
          onClick={() => setPreview(pdf)}
        />
      ) : null}
      {ready ? (
        <SmartCaSignaturePanel
          contract={ready.contract}
          state={ready.state}
          isLandlord={data.role === 'LANDLORD'}
          isTenant={data.role === 'TENANT'}
          hasReadyPdf={!!pdf}
          signingAllowed={signingAllowed}
          blockedReason={
            !current?.current
              ? 'Văn bản cũ không còn khớp nguồn.'
              : data.status !== 'APPROVED'
                ? 'Phụ lục chỉ được ký khi chủ nhà đã đồng ý và hồ sơ đang chờ ký.'
                : current.signedAt
                  ? 'Phụ lục này đã ký đủ; chỉ để đối chiếu.'
                  : undefined
          }
          onUpdated={async () => {
            await load();
            await onUpdated();
          }}
        />
      ) : null}
      <ContractPdfViewerModal
        isOpen={!!preview}
        document={preview}
        onClose={() => setPreview(null)}
      />
    </View>
  );
}
