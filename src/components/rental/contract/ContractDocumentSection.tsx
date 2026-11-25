// Web: components/contract/detail/ContractDocumentSection.tsx. The web reads the amendment workspace
// from context; here the owner of that state passes it as `amendments`.
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { Card, SectionTitle } from '@/components/rental/shared/Card';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { supportsContractProof } from '@/lib/rental/contract-blockchain-proof';
import {
  amendmentDocumentStatus,
  amendmentDocumentTitle,
  appliedAmendment,
  closedDocumentProposals,
  concreteProposals,
  documentDate,
  documentStage,
  documentTime,
  primaryDocument,
  signedAmendment,
  verifiedSignatureTimes,
  visibleDocument,
} from '@/lib/rental/contract-document-history';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { contractService } from '@/services/rental/contract.service';
import {
  depositAgreementService,
  type DepositAgreementView,
} from '@/services/rental/deposit-agreement.service';
import type {
  ContractDocumentResponse,
  ContractResponse,
  SignatureRequestResponse,
} from '@/types/rental/contract.type';
import type {
  AmendmentPayload,
  AmendmentProposal,
  ContractAmendments,
} from '@/types/rental/contract-amendment.type';

import AmendmentComparisonTable from './AmendmentComparisonTable';
import { Anchor } from './anchors';
import ContractBlockchainProof from './ContractBlockchainProof';
import ContractPdfViewerModal from './ContractPdfViewerModal';
import { openWithDeviceApps, shareSignedDocument } from './documentFiles';
import { fileSessionGuard } from '@/services/rental/cache';
import { createSingleFlight, documentOpenPlan, fileSize } from './signingLogic';

/** The fields of the web `useAmendmentWorkspace()` value that this section reads. */
export type DocumentAmendmentWorkspace = {
  perspective: DashboardRole;
  data?: Pick<ContractAmendments, 'proposals' | 'serverNow'> | null;
  error?: string | null;
  load: () => unknown;
  editing: boolean;
  busy: boolean;
  savedDraft?: AmendmentPayload | null;
  start: (previous: AmendmentProposal, draft: AmendmentPayload | null) => void;
};

export type ContractDocumentSectionProps = {
  documents: ContractDocumentResponse[];
  contract: ContractResponse;
  /** Null/omitted where the web renders the section outside an amendment workspace. */
  amendments?: DocumentAmendmentWorkspace | null;
  /** Mobile only: web link "Mở phụ lục để xem và ký". */
  onNavigate: RentalNavigate;
};

type Action = (doc: ContractDocumentResponse, download?: boolean) => Promise<void>;
type FileProps = { action: Action; busy: string | null };

const actionKey = (doc: ContractDocumentResponse, download: boolean) => `${doc.id}:${download}`;

function Note({ children, alert }: { children: ReactNode; alert?: boolean }) {
  return (
    <Text
      accessibilityRole={alert ? 'alert' : undefined}
      className={`text-xs leading-5 ${alert ? 'text-warning' : 'text-muted-foreground'}`}>
      {children}
    </Text>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">
      <ActivityIndicator size="small" className="text-primary" />
      <Text className="flex-1 text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-11 justify-center self-start">
      <Text className="text-sm font-semibold text-primary underline">{label}</Text>
    </Pressable>
  );
}

function FileActions({
  doc,
  action,
  busy,
  main = false,
}: FileProps & { doc: ContractDocumentResponse; main?: boolean }) {
  if (doc.status !== 'READY' && doc.status !== 'STALE')
    return (
      <Note>{doc.status === 'FAILED' ? 'Tạo tệp chưa thành công' : 'Đang tạo tài liệu…'}</Note>
    );
  if (!doc.storageObjectId && !doc.viewUrl && !doc.downloadUrl)
    return <Note>Chưa có tệp để mở</Note>;
  const signed = doc.purpose === 'SIGNED_FINAL';
  return (
    <View className="flex-row flex-wrap gap-2">
      <ActionButton
        label={main ? (signed ? 'Xem bản đã ký' : 'Xem bản đang soạn / ký') : 'Xem'}
        icon="eye-outline"
        variant="secondary"
        className="grow"
        busy={busy === actionKey(doc, false)}
        disabled={busy !== null}
        onClick={() => void action(doc)}
      />
      <ActionButton
        label={main && signed ? 'Tải PDF đã ký' : 'Tải về'}
        icon="download-outline"
        variant={main ? 'primary' : 'secondary'}
        className="grow"
        busy={busy === actionKey(doc, true)}
        disabled={busy !== null}
        onClick={() => void action(doc, true)}
      />
    </View>
  );
}

function DocumentFiles({
  rows,
  signed,
  revisionId,
  action,
  busy,
  children,
}: FileProps & {
  rows: ContractDocumentResponse[];
  signed: boolean;
  revisionId?: string | null;
  children?: ReactNode;
}) {
  const current = visibleDocument(rows, signed, revisionId);
  return (
    <View className="gap-3">
      {current ? (
        <View className="gap-2 rounded-xl border border-border bg-muted p-3">
          <Text className="text-sm font-semibold text-foreground">{documentStage(current)}</Text>
          <Text selectable className="text-xs leading-5 text-secondary">
            {current.fileName || `Tài liệu ${current.documentType}`}
          </Text>
          <Text className="text-xs leading-5 text-muted-foreground">
            {fileSize(current.fileSize)} · Tạo lúc {documentTime(current.generatedAt)}
          </Text>
          <FileActions doc={current} action={action} busy={busy} main />
        </View>
      ) : (
        <Note>
          {signed
            ? 'Chưa tải được bản PDF ký đủ hai bên. Các tệp soạn thảo không thay thế bản ký hoàn chỉnh.'
            : 'Chưa có tệp sẵn sàng cho phiên bản hợp đồng hiện tại.'}
        </Note>
      )}
      {children}
    </View>
  );
}

function SigningHistory({
  contractId,
  revisionId,
  proposal,
  rootSignedAt,
}: {
  contractId: string;
  revisionId?: string;
  proposal?: AmendmentProposal;
  rootSignedAt?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    rows: SignatureRequestResponse[];
    error?: string;
    loading: boolean;
  }>({ rows: [], loading: false });
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    contractService
      .getSignatureState(contractId)
      .then((result) => {
        if (!cancelled) setState({ rows: result.allRequests ?? [], loading: false });
      })
      .catch(() => {
        if (!cancelled)
          setState({
            rows: [],
            error: 'Không tải được các mốc ký. Không suy đoán chữ ký từ tên tệp.',
            loading: false,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [open, retry, contractId, revisionId]);
  const times = verifiedSignatureTimes(state.rows, revisionId);
  const event = (label: string, value?: string | null) => (
    <View className="border-l-2 border-primary-border pl-3">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <Text className="text-xs leading-5 text-muted-foreground">{documentTime(value)}</Text>
    </View>
  );
  return (
    <Accordion
      title="Quá trình ghi nhận và ký"
      open={open}
      onToggle={(next) => {
        setOpen(next);
        if (next) setState((s) => ({ ...s, loading: true }));
      }}>
      <View className="gap-3">
        {proposal ? event('Gửi đề xuất điều chỉnh', proposal.submittedAt) : null}
        {proposal?.decidedAt
          ? event(
              closedDocumentProposals.has(proposal.status)
                ? amendmentDocumentStatus(proposal, proposal.decidedAt)
                : 'Hai bên thống nhất nội dung',
              proposal.decidedAt
            )
          : null}
        {times.landlord ? event('Chủ nhà đã ký số', times.landlord) : null}
        {times.tenant ? event('Người thuê đã ký số', times.tenant) : null}
        {proposal?.signedAt || rootSignedAt
          ? event('Hoàn tất ký đủ hai bên', proposal?.signedAt ?? rootSignedAt)
          : null}
        {proposal?.appliedAt ? event('Ghi nhận áp dụng điều chỉnh', proposal.appliedAt) : null}
        {state.loading ? <Loading label="Đang tải mốc ký…" /> : null}
        {state.error ? (
          <View>
            <Note alert>{state.error}</Note>
            <LinkButton
              label="Thử lại mốc ký"
              onPress={() => {
                setState((s) => ({ ...s, loading: true }));
                setRetry((n) => n + 1);
              }}
            />
          </View>
        ) : null}
        {!state.loading && !state.error && !times.landlord && !times.tenant ? (
          <Note>Không có mốc chữ ký số đã xác minh cho phiên bản tài liệu này.</Note>
        ) : null}
      </View>
    </Accordion>
  );
}

function DocumentCard({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <View
      accessibilityLabel={title}
      className="gap-3 rounded-2xl border border-border bg-background p-3">
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          {title}
        </Text>
        <Badge>{status}</Badge>
      </View>
      {children}
    </View>
  );
}

type AmendmentCardProps = FileProps & {
  proposal: AmendmentProposal;
  number?: number;
  serverNow: string;
  amendments?: DocumentAmendmentWorkspace | null;
  onNavigate: RentalNavigate;
};

function AmendmentDocumentCard({
  proposal: p,
  number,
  serverNow,
  action,
  busy,
  amendments: w,
  onNavigate,
}: AmendmentCardProps) {
  const [fileState, setFileState] = useState<{
    agreementId: string;
    rows: ContractDocumentResponse[];
    revisionId: string | null;
  } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const agreementId = p.agreementContractId;
  useEffect(() => {
    if (!agreementId) return;
    let cancelled = false;
    Promise.all([
      contractService.getDocuments(agreementId),
      contractService.getContract(agreementId),
    ])
      .then(([rows, agreement]) => {
        if (agreement?.id !== agreementId) throw new Error('Unexpected amendment contract');
        if (!cancelled) {
          setFileState({
            agreementId,
            rows: rows.filter((d) => d.contractId === agreementId),
            revisionId: agreement.currentRevisionId ?? null,
          });
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [agreementId, p.agreementStatus, p.signedAt, retry]);
  const signed = signedAmendment(p);
  const applied = appliedAmendment(p, serverNow);
  const title = `${number ? `Điều chỉnh lần ${number}` : 'Đề xuất điều chỉnh'} — ${amendmentDocumentTitle(p)}`;
  const currentFiles = fileState && fileState.agreementId === agreementId ? fileState : null;
  const main = currentFiles
    ? visibleDocument(currentFiles.rows, signed, currentFiles.revisionId)
    : undefined;
  return (
    <DocumentCard title={title} status={amendmentDocumentStatus(p, serverNow)}>
      <Note>
        {signed ? `Ký đủ: ${documentTime(p.signedAt)} · ` : ''}
        {p.immediateEffect
          ? 'Áp dụng sau khi ký đủ và được hệ thống ghi nhận'
          : `${applied ? 'Áp dụng từ' : 'Dự kiến áp dụng'}: ${documentDate(p.effectiveOn)}`}
      </Note>
      {!applied ? (
        <Note>
          {closedDocumentProposals.has(p.status)
            ? 'Đề xuất này không thay đổi điều khoản của hợp đồng.'
            : 'Điều khoản đang áp dụng chưa thay đổi bởi đề xuất này.'}
        </Note>
      ) : null}
      <Accordion title={`Xem thay đổi (${p.comparison.length} nội dung)`}>
        <View className="gap-3">
          <Text selectable className="text-sm leading-6 text-muted-foreground">
            Lý do: {p.reason}
          </Text>
          <AmendmentComparisonTable
            rows={p.comparison}
            beforeLabel="Trước điều chỉnh"
            afterLabel={signed ? 'Sau điều chỉnh' : 'Nội dung đề xuất'}
          />
          {p.responseNote ? (
            <Text selectable className="text-sm leading-6 text-foreground">
              Phản hồi: {p.responseNote}
            </Text>
          ) : null}
          {agreementId ? (
            <SigningHistory
              key={`${p.id}:${p.agreementStatus}:${p.signedAt ?? ''}`}
              contractId={agreementId}
              revisionId={currentFiles?.revisionId ?? undefined}
              proposal={p}
            />
          ) : null}
        </View>
      </Accordion>
      {agreementId ? (
        <>
          {error ? (
            <View>
              <Note alert>Không tải được lịch sử tệp phụ lục.</Note>
              <LinkButton label="Tải lại tệp phụ lục" onPress={() => setRetry((n) => n + 1)} />
            </View>
          ) : currentFiles === null ? (
            <Loading label="Đang tải tệp phụ lục…" />
          ) : (
            <DocumentFiles
              rows={currentFiles.rows}
              signed={signed}
              revisionId={currentFiles.revisionId}
              busy={busy}
              action={action}
            />
          )}
          {signed && main ? <ContractBlockchainProof document={main} /> : null}
          {w && p.status === 'APPROVED' ? (
            <LinkButton
              label="Mở phụ lục để xem và ký"
              onPress={() => onNavigate(contractDetailPath(w.perspective, agreementId))}
            />
          ) : null}
        </>
      ) : (
        <Note>Chưa tạo văn bản ký. Đề xuất và phản hồi được giữ trong lịch sử điều chỉnh.</Note>
      )}
      {w?.perspective === 'landlord' && p.canReplace && !w.editing ? (
        <ActionButton
          label="Chỉnh lại phụ lục"
          variant="secondary"
          disabled={w.busy}
          onClick={() =>
            w.start(p, w.savedDraft?.previousProposalId === p.id ? w.savedDraft : null)
          }
        />
      ) : null}
    </DocumentCard>
  );
}

export default function ContractDocumentSection(props: ContractDocumentSectionProps) {
  // Nothing loaded for one contract (deposit, appendix, open preview) is shown for another.
  return <Section key={props.contract.id} {...props} />;
}

function Section({ documents, contract, amendments: w, onNavigate }: ContractDocumentSectionProps) {
  const showDialog = useDialog();
  const [previewDoc, setPreviewDoc] = useState<ContractDocumentResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flight] = useState(createSingleFlight);
  const [deposit, setDeposit] = useState<DepositAgreementView | null>(null);
  const [depositError, setDepositError] = useState(false);
  const [earlyExitFile, setEarlyExitFile] = useState<{
    end: string;
    document: ContractDocumentResponse | null;
    error: boolean;
  } | null>(null);
  const [earlyExitRetry, setEarlyExitRetry] = useState(0);
  const earlyEnd = !contract.parentContractId ? contract.agreedEarlyEndExclusive : null;

  useEffect(() => {
    if (!earlyEnd) return;
    let active = true;
    contractService
      .getEffectiveDocument(contract.id)
      .then((document) => {
        if (!document || document.contractId === contract.id)
          throw new Error('Missing signed early-exit appendix');
        if (active) setEarlyExitFile({ end: earlyEnd, document, error: false });
      })
      .catch(() => {
        if (active) setEarlyExitFile({ end: earlyEnd, document: null, error: true });
      });
    return () => {
      active = false;
    };
  }, [contract.id, earlyEnd, earlyExitRetry]);

  useEffect(() => {
    if (!contract.depositAgreementContractId || contract.parentContractId) return;
    let active = true;
    depositAgreementService
      .get(contract.rentalRequestId)
      .then((value) => {
        if (active) {
          setDeposit(value);
          setDepositError(value.agreement?.id !== contract.depositAgreementContractId);
        }
      })
      .catch(() => {
        if (active) setDepositError(true);
      });
    return () => {
      active = false;
    };
  }, [contract.depositAgreementContractId, contract.parentContractId, contract.rentalRequestId]);

  const proposals = concreteProposals(w?.data?.proposals ?? []);
  const serverNow = w?.data?.serverNow ?? contract.updatedAt;
  const signed = proposals.filter(signedAmendment);
  const applied = proposals.filter((p) => appliedAmendment(p, serverNow));
  const closed = proposals.filter((p) => closedDocumentProposals.has(p.status));
  const visible = proposals.filter((p) => !closedDocumentProposals.has(p.status));
  const rootRows = documents.filter((d) => d.contractId === contract.id);
  const rootSigned = Boolean(contract.signedAt);
  const depositContract =
    deposit && deposit.agreement?.id === contract.depositAgreementContractId
      ? deposit.agreement
      : null;
  const depositRows = depositContract
    ? deposit!.documents.filter((d) => d.contractId === depositContract.id)
    : [];
  const depositPdf = depositContract?.signedAt
    ? primaryDocument(depositRows, true, depositContract.currentRevisionId)
    : undefined;
  const proofDocument =
    rootSigned && supportsContractProof(contract)
      ? primaryDocument(rootRows, true, contract.currentRevisionId)
      : undefined;

  const action: Action = (doc, download = false) =>
    flight(async () => {
      setBusy(actionKey(doc, download));
      const checkSession = fileSessionGuard();
      try {
        // Refresh short-lived URLs through the authorized API, never reuse a stale signed URL.
        const fresh = await contractService.getDocument(doc.id);
        checkSession();
        const plan = documentOpenPlan(doc, fresh, download);
        if (plan.kind === 'verified-download') await shareSignedDocument(fresh);
        else if (plan.kind === 'external') await openWithDeviceApps(plan.url, fresh);
        else setPreviewDoc(fresh);
      } catch (e) {
        showDialog('Thông báo', e instanceof Error ? e.message : 'Không mở được tài liệu.');
      } finally {
        setBusy(null);
      }
    });

  const title =
    contract.agreementKind === 'DEPOSIT'
      ? 'Hợp đồng cọc'
      : contract.agreementKind === 'AMENDMENT'
        ? 'Phụ lục đang xem'
        : contract.agreementKind === 'RENEWAL' ||
            (contract.parentContractId && !contract.agreementKind)
          ? 'Văn bản gia hạn đang xem'
          : 'Hợp đồng gốc';

  const amendmentCard = (p: AmendmentProposal) => (
    <AmendmentDocumentCard
      key={p.id}
      proposal={p}
      number={signed.findIndex((s) => s.id === p.id) + 1 || undefined}
      serverNow={serverNow}
      action={action}
      busy={busy}
      amendments={w}
      onNavigate={onNavigate}
    />
  );

  return (
    <Anchor id="contract-document-history">
      <Card className="gap-3">
        <SectionTitle title="Hợp đồng & các lần điều chỉnh" />
        {!contract.parentContractId && w?.data ? (
          <PolicyNotice
            tone="neutral"
            title="Hợp đồng & các lần điều chỉnh"
            text={
              earlyEnd
                ? 'Thời hạn thuê hiện tại theo phụ lục chấm dứt sớm đã ký; hợp đồng gốc và các điều chỉnh trước đó được giữ nguyên.'
                : contract.status === 'ACTIVE'
                  ? applied.length
                    ? `Điều khoản hiện tại theo hợp đồng gốc và ${applied.length} lần điều chỉnh đã áp dụng. Các mục không thay đổi vẫn theo văn bản trước đó.`
                    : 'Chưa có phụ lục nào được áp dụng; điều khoản hiện tại theo hợp đồng gốc.'
                  : 'Hồ sơ lưu trữ: các mốc dưới đây ghi lại những điều chỉnh đã được áp dụng, không có nghĩa hợp đồng vẫn đang có hiệu lực.'
            }
          />
        ) : null}
        {contract.depositAgreementContractId && !contract.parentContractId ? (
          <>
            {depositError ? (
              <Note alert>
                Chưa tải được HĐ cọc liên kết. Hãy tải lại trang để xem đầy đủ nguồn gốc hồ sơ.
              </Note>
            ) : null}
            {!deposit && !depositError ? <Loading label="Đang tải HĐ cọc liên kết…" /> : null}
            {depositContract ? (
              <DocumentCard
                title="1. Hợp đồng cọc"
                status={
                  depositContract.status === 'CLOSED'
                    ? 'Đã hoàn tất HĐ cọc'
                    : depositContract.signedAt
                      ? 'Đã ký đủ hai bên'
                      : 'Chưa hoàn tất ký'
                }>
                <Note>
                  {depositContract.contractNumber} ·{' '}
                  {depositContract.signedAt
                    ? `Ký đủ: ${documentTime(depositContract.signedAt)}`
                    : 'Chưa có bản ký hoàn chỉnh'}
                </Note>
                <DocumentFiles
                  rows={depositRows}
                  signed={Boolean(depositContract.signedAt)}
                  revisionId={depositContract.currentRevisionId}
                  busy={busy}
                  action={action}
                />
                {depositPdf ? <ContractBlockchainProof document={depositPdf} /> : null}
              </DocumentCard>
            ) : null}
          </>
        ) : null}
        <DocumentCard
          title={
            !contract.parentContractId && contract.depositAgreementContractId
              ? '2. Hợp đồng thuê'
              : title
          }
          status={rootSigned ? 'Đã ký đủ hai bên' : 'Chưa hoàn tất ký'}>
          <Note>
            {rootSigned
              ? `Hoàn tất ký: ${documentTime(contract.signedAt)}`
              : 'Bản soạn thảo / đang ký chưa phải bản ký hoàn chỉnh.'}
          </Note>
          {applied.length > 0 ? (
            <Text className="text-xs leading-5 text-foreground">
              Hợp đồng gốc được giữ nguyên; đọc cùng các điều chỉnh đã áp dụng bên dưới.
            </Text>
          ) : null}
          <DocumentFiles
            rows={rootRows}
            signed={rootSigned}
            revisionId={contract.currentRevisionId}
            busy={busy}
            action={action}>
            <SigningHistory
              contractId={contract.id}
              revisionId={contract.currentRevisionId ?? undefined}
              rootSignedAt={contract.signedAt}
            />
          </DocumentFiles>
          {proofDocument ? (
            <Anchor id="contract-blockchain-proof">
              <ContractBlockchainProof document={proofDocument} />
            </Anchor>
          ) : null}
        </DocumentCard>
        {earlyEnd ? (
          <DocumentCard title="Phụ lục chấm dứt sớm" status="Đã ký đủ hai bên">
            <Note>
              Mốc kết thúc mới: {documentDate(earlyEnd)} lúc 00:00 (không bao gồm ngày này). Hợp
              đồng gốc vẫn là bản đã ký riêng ở trên.
            </Note>
            {earlyExitFile?.end !== earlyEnd ? (
              <Loading label="Đang tải PDF phụ lục…" />
            ) : earlyExitFile.error ? (
              <View>
                <Note alert>Chưa tải được PDF phụ lục đã ký.</Note>
                <LinkButton
                  label="Tải lại"
                  onPress={() => {
                    setEarlyExitFile(null);
                    setEarlyExitRetry((n) => n + 1);
                  }}
                />
              </View>
            ) : earlyExitFile.document ? (
              <>
                <DocumentFiles
                  rows={[earlyExitFile.document]}
                  signed
                  revisionId={earlyExitFile.document.revisionId}
                  busy={busy}
                  action={action}
                />
                <ContractBlockchainProof document={earlyExitFile.document} />
              </>
            ) : null}
          </DocumentCard>
        ) : null}
        {w?.error ? (
          <View>
            <Note alert>
              Chưa tải được lịch sử điều chỉnh; không thể xác định đầy đủ các phụ lục.
            </Note>
            <LinkButton label="Tải lại lịch sử điều chỉnh" onPress={() => void w.load()} />
          </View>
        ) : null}
        {!contract.parentContractId &&
        ['ACTIVE', 'EXPIRED', 'CLOSED', 'TERMINATED'].includes(contract.status) &&
        !w?.data &&
        !w?.error ? (
          <Loading label="Đang kiểm tra lịch sử điều chỉnh…" />
        ) : null}
        {visible.map(amendmentCard)}
        {closed.length > 0 ? (
          <Accordion title={`Đề xuất không được áp dụng (${closed.length})`}>
            <View className="gap-3">{closed.map(amendmentCard)}</View>
          </Accordion>
        ) : null}
        <View className="flex-row items-start gap-2">
          <Icon name="information-circle-outline" size={16} className="text-muted-foreground" />
          <Text className="flex-1 text-xs leading-5 text-muted-foreground">
            Bản ký và các tệp cũ không bị ghi đè. Nội dung trên giao diện là bản tra cứu; không thay
            thế PDF đã ký của từng văn bản.
          </Text>
        </View>
        <ContractPdfViewerModal
          isOpen={Boolean(previewDoc)}
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      </Card>
    </Anchor>
  );
}
