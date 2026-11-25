// Web: components/contract/detail/ContractHeader.tsx. The header card scrolls with the page; the
// web's floating draft bar is DraftActionBar, which the screen pins under the ScrollView.
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { Card } from '@/components/rental/shared/Card';
import { useToast } from '@/components/rental/onboarding/common';
import {
  appliedAmendment,
  documentTime,
  requiresVerifiedContent,
} from '@/lib/rental/contract-document-history';
import type { Tone } from '@/lib/rental/rental-labels';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { contractService } from '@/services/rental/contract.service';
import type {
  ContractCompletenessResponse,
  ContractDocumentResponse,
  ContractResponse,
  ContractRevisionResponse,
} from '@/types/rental/contract.type';

import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import {
  documentButtons,
  draftBarText,
  headerPill,
  paymentLine,
  readFreshDocument,
  renderButton,
  sendButton,
  showDraftBar,
} from './contractDetailLogic';
import ContractPdfViewerModal from './ContractPdfViewerModal';
import { openWithDeviceApps, shareSignedDocument } from './documentFiles';
import { fileSessionGuard } from '@/services/rental/cache';
import { FieldRow, linkText } from './fields';

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-11 justify-center">
      <Text className={linkText}>{label}</Text>
    </Pressable>
  );
}

export default function ContractHeader({
  contract,
  revision,
  latestDoc,
  isLandlord,
  isTenant,
  statusLabel,
  statusTone,
  kindLabel,
  summary,
  onBackToList,
  onOpenDocuments,
  cancellationRefundPending = false,
}: {
  contract: ContractResponse;
  revision?: ContractRevisionResponse | null;
  /** Null while the draft is dirty or in conflict, and on the deposit agreement. */
  latestDoc: ContractDocumentResponse | null;
  isLandlord: boolean;
  isTenant: boolean;
  statusLabel: string;
  statusTone: Tone;
  kindLabel?: string;
  summary?: ReactNode;
  /** Web `backPath`: the list, or the root contract of an addendum. */
  onBackToList: () => void;
  /** Opens the "Ký số & tài liệu" tab scrolled to this anchor. */
  onOpenDocuments: (anchorId: string) => void;
  cancellationRefundPending?: boolean;
}) {
  const toast = useToast();
  const workspace = useAmendmentWorkspace();
  const [viewDoc, setViewDoc] = useState<ContractDocumentResponse | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [opening, setOpening] = useState(false);
  const busy = useRef(false);
  const applied =
    workspace?.data?.proposals.filter((p) => appliedAmendment(p, workspace.data!.serverNow))
      .length ?? 0;
  const buttons = documentButtons(contract, latestDoc);
  const payment = paymentLine(contract);

  const openDocument = async (download = false, ownAppendix = false) => {
    const effective = buttons.effective && !ownAppendix;
    if ((!effective && !latestDoc) || busy.current) return;
    busy.current = true;
    setOpening(true);
    const checkSession = fileSessionGuard();
    try {
      // Resolve again on every tap: business time and the effective amendment may have changed
      // since this page was loaded. Never fall back to the root.
      const fresh = await readFreshDocument(
        { contractId: contract.id, effective, latest: latestDoc, download },
        contractService
      );
      checkSession();
      if (!download) {
        setViewDoc(fresh);
        setShowViewer(true);
      } else if (requiresVerifiedContent(fresh)) await shareSignedDocument(fresh);
      else await openWithDeviceApps(fresh.downloadUrl!, fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không mở được tài liệu.');
    } finally {
      busy.current = false;
      setOpening(false);
    }
  };

  return (
    <Card className="gap-3">
      <Pressable
        onPress={onBackToList}
        accessibilityRole="link"
        className="min-h-11 flex-row items-center gap-1.5 self-start">
        <Icon name="arrow-back" size={16} className="text-muted-foreground" />
        <Text className="text-sm font-semibold text-muted-foreground">
          {contract.agreementKind === 'AMENDMENT' ? 'Về hợp đồng gốc' : 'Danh sách hợp đồng'}
        </Text>
      </Pressable>

      <View className="gap-2">
        <View className="flex-row items-start gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft">
            <Icon name="document-text-outline" size={22} className="text-primary" />
          </View>
          <Text
            selectable
            accessibilityRole="header"
            className="flex-1 text-xl font-bold leading-7 text-foreground">
            {contract.contractNumber}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {kindLabel ? <Badge>{kindLabel}</Badge> : null}
          <Badge tone={statusTone}>
            {headerPill(contract, statusLabel, cancellationRefundPending)}
          </Badge>
        </View>
        <Text className="text-sm font-bold text-foreground">
          {isLandlord
            ? 'Bạn là chủ nhà (Bên A)'
            : isTenant
              ? 'Bạn là người thuê (Bên B)'
              : 'Quan sát viên'}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Icon name="card-outline" size={16} className="text-muted-foreground" />
          <Text
            className={`flex-1 text-sm ${payment.tone === 'success' ? 'font-semibold text-success' : payment.tone === 'warning' ? 'font-semibold text-warning' : 'text-muted-foreground'}`}>
            {payment.text}
          </Text>
        </View>
        {contract.landlordConfirmedAt ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="shield-checkmark-outline" size={16} className="text-primary" />
            <Text className="text-sm font-medium text-primary">Chủ nhà đã xác nhận</Text>
          </View>
        ) : null}
      </View>

      {summary}

      <View className="gap-2 border-t border-border pt-3">
        {buttons.view ? (
          <ActionButton
            label={buttons.view}
            variant="secondary"
            icon="eye-outline"
            disabled={opening}
            onClick={() => void openDocument()}
          />
        ) : null}
        {buttons.download ? (
          <ActionButton
            label={buttons.download}
            variant="secondary"
            icon="download-outline"
            disabled={opening}
            onClick={() => void openDocument(true)}
          />
        ) : null}
        {buttons.ownAppendix ? (
          <ActionButton
            label="Xem riêng phụ lục này"
            variant="secondary"
            disabled={opening}
            onClick={() => void openDocument(false, true)}
          />
        ) : null}
        {contract.signedAt && !contract.parentContractId ? (
          <Link
            label="Bằng chứng blockchain"
            onPress={() => onOpenDocuments('contract-blockchain-proof')}
          />
        ) : null}
        {revision ? (
          <Link
            label={
              applied
                ? `Đã áp dụng ${applied} lần điều chỉnh · Xem hợp đồng và lịch sử`
                : 'Xem văn bản và lịch sử tệp'
            }
            onPress={() => onOpenDocuments('contract-document-history')}
          />
        ) : null}
        {buttons.signedAppendix ? (
          <Text className="text-sm leading-6 text-muted-foreground">
            Phụ lục đã ký có thể còn chờ hiệu lực. Nút “đang áp dụng” luôn lấy bản có hiệu lực theo
            ngày hệ thống; xem riêng phụ lục để đối chiếu bản này.
          </Text>
        ) : null}
      </View>

      <Accordion title="Thông tin văn bản">
        <FieldRow label="Số hợp đồng" value={contract.contractNumber} />
        <FieldRow label="Địa điểm lập văn bản" value={contract.signingCity} />
        <FieldRow
          label="Thời điểm hai bên ký đủ"
          value={contract.signedAt ? documentTime(contract.signedAt) : 'Chưa ký đủ hai bên'}
        />
        <Text className="py-2 text-sm leading-6 text-muted-foreground">
          Ngày lập in trên Word/PDF được hệ thống ghi lúc kết xuất; không đồng nhất với ngày bắt đầu
          thuê hoặc thời điểm ký đủ. Xem bản đã ký để đối chiếu ngày in chính xác.
        </Text>
        <Accordion title="Thông tin kỹ thuật · Chỉ đọc">
          <FieldRow label="Phiên bản cấu trúc dữ liệu" value={revision?.schemaVersion} />
          <FieldRow label="Số bản soạn thảo" value={revision?.revisionNumber} />
        </Accordion>
      </Accordion>

      <ContractPdfViewerModal
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        document={viewDoc}
      />
    </Card>
  );
}

/** HD:234-281 — the landlord's save / render / send bar of a draft (child drafts included). */
export function DraftActionBar({
  contract,
  completeness,
  isLandlord,
  hasReadyDoc,
  smartCaMode,
  cancellationRefundPending,
  rendering,
  reconcilingPreview,
  sending,
  draftReview,
  listingSyncAction,
  onRender,
  onSend,
}: {
  contract: ContractResponse;
  completeness: ContractCompletenessResponse | null;
  isLandlord: boolean;
  hasReadyDoc: boolean;
  smartCaMode: boolean;
  cancellationRefundPending: boolean;
  rendering: boolean;
  reconcilingPreview: boolean;
  sending: boolean;
  draftReview?: { saving: boolean; retry: boolean; locked: boolean };
  listingSyncAction?: ReactNode;
  onRender: () => void;
  onSend: () => void;
}) {
  const manageGate = useFeatureGate(PERMISSIONS.CONTRACT_MANAGE);
  const editing = Boolean(useAmendmentWorkspace()?.editing);
  const visible = showDraftBar({
    isLandlord,
    status: contract.status,
    cancellationRefundPending,
    amendmentEditing: editing,
    hasReadyDoc,
    smartCaMode,
    hasListingSync: Boolean(listingSyncAction),
  });
  if (!visible) return null;
  const flags = { rendering, reconciling: reconcilingPreview, sending };
  const render = renderButton({ ...flags, review: draftReview, gateAllowed: manageGate.allowed });
  const send = sendButton({
    ...flags,
    complete: Boolean(completeness?.complete),
    hasReadyDoc,
    gateTitle: manageGate.title,
  });
  const reason = manageGate.title ?? (smartCaMode ? undefined : send.reason);
  return (
    <View
      accessibilityLabel={draftReview ? 'Thao tác bản nháp' : 'Thao tác kết xuất hợp đồng'}
      className="gap-2 border-t border-border bg-surface px-4 pb-3 pt-3">
      <Text className="text-xs leading-5 text-muted-foreground">
        {draftBarText(hasReadyDoc, draftReview)}
      </Text>
      {listingSyncAction}
      <View className="flex-row gap-2">
        {!hasReadyDoc ? (
          <ActionButton
            label={render.label}
            icon="refresh"
            busy={render.spinning}
            disabled={render.disabled}
            onClick={onRender}
            className="flex-1"
          />
        ) : null}
        {!smartCaMode ? (
          <ActionButton
            label={send.label}
            variant="success"
            icon="send-outline"
            busy={sending}
            disabled={send.disabled}
            onClick={onSend}
            className="flex-1"
          />
        ) : null}
      </View>
      {reason ? <Text className="text-xs text-warning">{reason}</Text> : null}
    </View>
  );
}
