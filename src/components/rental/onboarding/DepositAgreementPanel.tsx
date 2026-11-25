// Web: components/rental-request/DepositAgreementPanel.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import ContractBlockchainProof from '@/components/rental/contract/ContractBlockchainProof';
import ContractPdfViewerModal from '@/components/rental/contract/ContractPdfViewerModal';
import SmartCaSignaturePanel from '@/components/rental/contract/SmartCaSignaturePanel';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { Card } from '@/components/rental/shared/Card';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { primaryDocument, requiresVerifiedContent } from '@/lib/rental/contract-document-history';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import { loadDepositAgreement } from '@/lib/rental/deposit-agreement-loader';
import { obligationLabel } from '@/lib/rental/DepositAgreementPanel';
import { contractStatus } from '@/lib/rental/rental-labels';
import { useAgreementChangeSync, useVisiblePoll } from '@/lib/rental-sync/hooks';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { contractService } from '@/services/rental/contract.service';
import {
  depositAgreementService,
  type DepositAgreementView,
} from '@/services/rental/deposit-agreement.service';
import type {
  ContractDocumentResponse,
  SignatureStateResponse,
} from '@/types/rental/contract.type';

import { ToneBox, useToast } from './common';

export type DepositAgreementPanelProps = {
  rentalRequestId: string;
  isLandlord: boolean;
  onUpdated?: () => void | Promise<void>;
  /** Mobile only: web link to the lease contract. */
  onNavigate: RentalNavigate;
};

export default function DepositAgreementPanel(props: DepositAgreementPanelProps) {
  return <DepositAgreementBody key={props.rentalRequestId} {...props} />;
}

function DepositAgreementBody({
  rentalRequestId,
  isLandlord,
  onUpdated,
  onNavigate,
}: DepositAgreementPanelProps) {
  const toast = useToast();
  const [view, setView] = useState<DepositAgreementView | null>(null);
  const [signature, setSignature] = useState<{
    contractId: string;
    data: SignatureStateResponse;
  } | null>(null);
  const [error, setError] = useState('');
  const [signatureError, setSignatureError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ContractDocumentResponse | null>(null);
  const requestSequence = useRef(0);
  const prepareLock = useRef(false);

  // `silent` (polling, notices) keeps the button and status text still; only the first load and manual refresh show progress.
  const load = useCallback(
    async (silent = false) => {
      const sequence = ++requestSequence.current;
      const current = () => sequence === requestSequence.current;
      let contractId: string | null = null;
      if (!silent) setLoading(true);
      try {
        await loadDepositAgreement(
          rentalRequestId,
          {
            getAgreement: depositAgreementService.get,
            getSignatureState: contractService.getSignatureState,
          },
          {
            agreement: (data) => {
              contractId = data.agreement?.id ?? null;
              if (!current()) return;
              setView(data);
              setError('');
              setSignatureError('');
              setSignature((previous) => (previous?.contractId === contractId ? previous : null));
            },
            signature: (data) => {
              if (current()) setSignature(data && contractId ? { contractId, data } : null);
            },
            signatureError: (failure) => {
              if (current())
                setSignatureError(getApiErrorMessage(failure, 'Chưa tải được trạng thái ký số.'));
            },
          }
        );
      } catch (failure) {
        if (current()) setError(getApiErrorMessage(failure, 'Chưa tải được hồ sơ cọc.'));
      } finally {
        if (current()) setLoading(false);
      }
    },
    [rentalRequestId]
  );

  useEffect(() => {
    const counter = requestSequence;
    void load();
    return () => {
      ++counter.current;
    };
  }, [load]);
  useVisiblePoll(() => load(true), 15000);
  // Counterparty signature notices refresh without waiting for the 15 s poll; the signer panel stays mounted.
  useAgreementChangeSync(
    (id) => !id || id === view?.agreement?.id,
    () => load(true)
  );

  async function prepare(reopen = false) {
    if (prepareLock.current) return;
    prepareLock.current = true;
    setBusy(true);
    try {
      if (reopen) await depositAgreementService.reopen(rentalRequestId);
      else await depositAgreementService.prepare(rentalRequestId);
      await load();
      await onUpdated?.();
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'Chưa chuẩn bị được hợp đồng cọc.'));
    } finally {
      prepareLock.current = false;
      setBusy(false);
    }
  }

  async function open(id: string) {
    const sequence = requestSequence.current;
    try {
      const doc = await contractService.getDocument(id);
      if (!requiresVerifiedContent(doc) && !doc.viewUrl && !doc.downloadUrl)
        throw new Error('Chưa có đường dẫn tài liệu.');
      if (sequence === requestSequence.current) setPreview(doc);
    } catch (failure) {
      if (sequence === requestSequence.current)
        toast.error(getApiErrorMessage(failure, 'Không mở được tài liệu cọc.'));
    }
  }

  if (view && !view.required)
    return (
      <Text className="text-sm leading-6 text-muted-foreground">
        Không yêu cầu đặt cọc · Bỏ qua hợp đồng cọc, tiếp tục thanh toán tiền thuê và ký hợp đồng
        thuê.
      </Text>
    );

  const contract = view?.agreement;
  const pdf = primaryDocument(
    view?.documents ?? [],
    !!contract?.signedAt || contract?.status === 'ACTIVE',
    contract?.currentRevisionId
  );
  const signatureState = signature && signature.contractId === contract?.id ? signature.data : null;
  const status = contract ? contractStatus(contract.status, 'DEPOSIT') : null;

  return (
    <Card className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          Hợp đồng đặt cọc
        </Text>
        <ActionButton
          label={loading ? 'Đang tải…' : 'Làm mới'}
          variant="secondary"
          icon="refresh"
          disabled={loading || busy}
          onClick={() => void load()}
        />
      </View>
      <PolicyNotice
        tone="neutral"
        title="Hợp đồng cọc"
        summary="Hợp đồng cọc được lập sau khi chủ nhà xác nhận nhận cọc, có thể xem và ký trước ngày vào ở.">
        <Text className="text-sm leading-6 text-secondary">
          Hợp đồng cọc được lập sau khi chủ nhà xác nhận nhận cọc, có thể xem và ký trước ngày vào
          ở. Hai bên ký cọc trước, ký hợp đồng thuê sau.
        </Text>
      </PolicyNotice>
      {error ? (
        <ToneBox tone="warning" alert>
          <Text className="text-sm leading-6 text-warning">{error}</Text>
          <Text className="text-sm leading-6 text-warning">
            {view
              ? 'Dữ liệu đang hiển thị là lần tải gần nhất; trạng thái ký cần được kiểm tra lại.'
              : 'Chưa xác định được trạng thái tài liệu. Lỗi tải không có nghĩa hợp đồng chưa được tạo.'}{' '}
            Không cần chuyển tiền lại.
          </Text>
          <ActionButton
            label="Thử tải lại hồ sơ cọc"
            variant="secondary"
            disabled={loading || busy}
            onClick={() => void load()}
          />
        </ToneBox>
      ) : null}
      {!view && loading && !error ? (
        <LoadingBlock label="Đang tải hợp đồng cọc và tài liệu…" />
      ) : null}
      {contract && status ? (
        <View className="gap-2">
          <Text selectable className="text-sm font-bold text-foreground">
            {contract.contractNumber}
          </Text>
          <Badge tone={status.tone}>{status.label}</Badge>
        </View>
      ) : null}
      {contract && ['CLOSED', 'TERMINATED'].includes(contract.status) && view?.blockedReason ? (
        <ToneBox tone="warning">{view.blockedReason}</ToneBox>
      ) : null}
      {view && !contract && !error ? (
        <PolicyNotice tone="neutral" title="Hợp đồng cọc" summary="Chưa có hồ sơ hợp đồng cọc.">
          <Text className="text-sm leading-6 text-secondary">
            Chưa có hồ sơ hợp đồng cọc. Sau khi chủ nhà xác nhận nhận tiền, hệ thống sẽ tự chuẩn bị
            tài liệu; bạn có thể kiểm tra mẫu hoặc dữ liệu còn thiếu bên dưới.
          </Text>
        </PolicyNotice>
      ) : null}
      {pdf ? (
        <ActionButton
          label={
            pdf.purpose === 'SIGNED_FINAL' ? 'Xem / tải hợp đồng cọc đã ký' : 'Xem PDF hợp đồng cọc'
          }
          icon="document-text-outline"
          variant="secondary"
          onClick={() => void open(pdf.id)}
        />
      ) : null}
      {pdf?.purpose === 'SIGNED_FINAL' && pdf.contractId === contract?.id ? (
        <ContractBlockchainProof document={pdf} />
      ) : null}
      {contract && !pdf && !error ? (
        <Text className="text-sm leading-6 text-muted-foreground">
          Hồ sơ cọc đã được lập, nhưng PDF chưa sẵn sàng. Hệ thống có thể đang kết xuất hoặc cần thử
          lại; không thu cọc lần nữa.
        </Text>
      ) : null}
      {view && !error && (!contract || contract.status === 'DRAFT') && !pdf ? (
        <ActionButton
          label={busy ? 'Đang xử lý…' : 'Kiểm tra / tạo lại tài liệu cọc'}
          variant="secondary"
          disabled={busy || loading}
          onClick={() => void prepare()}
        />
      ) : null}
      {view?.obligation ? (
        <Text className="text-xs leading-5 text-foreground">
          Nghĩa vụ cọc: {obligationLabel(view.obligation)}.
        </Text>
      ) : null}
      {view?.leaseContractId ? (
        <Pressable
          onPress={() =>
            onNavigate(
              contractDetailPath(isLandlord ? 'landlord' : 'tenant', view.leaseContractId!)
            )
          }
          accessibilityRole="link"
          className="min-h-11 justify-center self-start">
          <Text className="text-sm font-semibold text-primary underline">
            Mở HĐ thuê liên kết →
          </Text>
        </Pressable>
      ) : null}
      {signatureError ? (
        <ToneBox tone="warning" alert>
          {`${signatureError} Chưa kiểm tra được trạng thái ký; PDF đã có vẫn xem được. Bấm Làm mới để thử lại.`}
        </ToneBox>
      ) : null}
      {contract && signatureState ? (
        <SmartCaSignaturePanel
          key={contract.id}
          contract={contract}
          state={signatureState}
          isLandlord={isLandlord}
          isTenant={!isLandlord}
          hasReadyPdf={!!pdf}
          signingAllowed={!!view?.signingAllowed && !error && !signatureError}
          blockedReason={error || signatureError || view?.blockedReason || undefined}
          onUpdated={async () => {
            await load();
            await onUpdated?.();
          }}
        />
      ) : null}
      {isLandlord &&
      !error &&
      view?.signingAllowed === false &&
      contract?.status === 'TENANT_SIGNATURE_PENDING' &&
      view.blockedReason?.startsWith('Hết hạn') ? (
        <ActionButton
          label="Mở lại hạn ký cọc cho khách"
          variant="secondary"
          disabled={busy || loading}
          onClick={() => void prepare(true)}
        />
      ) : null}
      <ContractPdfViewerModal
        isOpen={!!preview}
        document={preview}
        onClose={() => setPreview(null)}
      />
    </Card>
  );
}
