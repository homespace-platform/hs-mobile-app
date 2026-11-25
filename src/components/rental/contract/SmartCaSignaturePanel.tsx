// Web: components/contract/detail/SmartCaSignaturePanel.tsx. The branch order lives in ./signingLogic.
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { Checkbox, ChoiceButton, ToneBox } from '@/components/rental/onboarding/common';
import ActionButton from '@/components/rental/shared/ActionButton';
import { Card } from '@/components/rental/shared/Card';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { PERMISSIONS } from '@/lib/permissions';
import { useVisiblePoll } from '@/lib/rental-sync/hooks';
import { useFeatureGate } from '@/lib/use-feature-gate';
import { contractService } from '@/services/rental/contract.service';
import type {
  CertificateOptionResponse,
  ContractResponse,
  SignatureStateResponse,
} from '@/types/rental/contract.type';

import {
  createSingleFlight,
  currentSignatureRequest,
  selectedSerial,
  signatureInProgress,
  signedAwaitingContract,
  smartCaView,
  type LocalSignatureRequest,
} from './signingLogic';
import {
  ConsentSourceNote,
  SOURCE_CHANGED,
  SOURCE_CHECK_FAILED,
  useSigningConsent,
} from './useSigningConsent';

export type SmartCaSignaturePanelProps = {
  contract: ContractResponse;
  state: SignatureStateResponse;
  isLandlord: boolean;
  isTenant: boolean;
  hasReadyPdf: boolean;
  signingAllowed?: boolean;
  blockedReason?: string;
  onUpdated: () => Promise<void>;
};

export default function SmartCaSignaturePanel(props: SmartCaSignaturePanelProps) {
  // Consent, certificate and late answers never carry over to another contract; they do survive a
  // signed-state refresh of the same one (C-256).
  return <Panel key={props.contract.id} {...props} />;
}

function Panel({
  contract,
  state,
  isLandlord,
  isTenant,
  hasReadyPdf,
  signingAllowed = true,
  blockedReason,
  onUpdated,
}: SmartCaSignaturePanelProps) {
  const showDialog = useDialog();
  const toast = (message: string, tone?: 'success') =>
    showDialog('Thông báo', message, undefined, tone);
  const signGate = useFeatureGate(PERMISSIONS.CONTRACT_SIGN);
  const [localCurrent, setCurrent] = useState<LocalSignatureRequest | null>(null);
  const [certificates, setCertificates] = useState<CertificateOptionResponse[]>([]);
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  // Separate locks: a status check never blocks the sign actions and vice versa.
  const [refreshFlight] = useState(createSingleFlight);
  const [actionFlight] = useState(createSingleFlight);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const current = currentSignatureRequest(localCurrent, contract.id, state);
  const view = smartCaView({
    contract,
    smartCaEnabled: state.smartCaEnabled,
    request: current,
    isLandlord,
    isTenant,
    signingAllowed,
    blockedReason,
  });
  // Web polls whenever the held request is pending, whatever is drawn.
  const pending = signatureInProgress(current?.status);
  const syncing = view.kind === 'sign' && signedAwaitingContract(current, contract, isLandlord);
  const consent = useSigningConsent({
    contract,
    signerId: isLandlord ? contract.landlordId : contract.tenantId,
    mode: 'SMARTCA',
    enabled: view.kind === 'sign' && !view.pending && !syncing,
    hasFile: hasReadyPdf,
    version: state,
  });
  // The transaction on screen: an answer about another one is late and ignored.
  const heldRequestId = useRef(current?.id);
  useEffect(() => {
    heldRequestId.current = current?.id;
  });

  async function refresh(showError: boolean) {
    if (!current || !signatureInProgress(current.status)) return;
    await refreshFlight(async () => {
      try {
        // The rental client has no timeout, so a socket lost while the user is in another app would
        // hold the lock for good. Axios ends the request itself: the lock never opens before it.
        const next = await contractService.refreshSmartCaSignature(contract.id, current.id, {
          timeout: 60_000,
        });
        if (!alive.current || next.id !== current.id || heldRequestId.current !== current.id)
          return;
        setCurrent({ contractId: contract.id, source: state.activeRequest, request: next });
        setRefreshError('');
        if (next.status === 'SIGNED')
          toast('Chữ ký số đã được xác minh và lưu vào PDF hợp đồng.', 'success');
        if (!signatureInProgress(next.status)) await onUpdated();
      } catch (error) {
        if (!alive.current) return;
        setRefreshError(
          'Chưa đồng bộ được trạng thái ký số. Hãy kiểm tra lại; lỗi kết nối không có nghĩa yêu cầu đã bị từ chối.'
        );
        if (showError) toast(getApiErrorMessage(error, 'Không thể kiểm tra trạng thái ký số.'));
      }
    });
  }

  useVisiblePoll(() => refresh(false), 5000, pending);
  // The signer confirms in the VNPT SmartCA app: check at once when they come back.
  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
  });
  useEffect(() => {
    if (!pending) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void latestRefresh.current(false);
    });
    return () => subscription.remove();
  }, [pending]);

  const loadCertificates = () =>
    actionFlight(async () => {
      setBusy(true);
      try {
        const options = await contractService.getSigningCertificates(contract.id);
        if (!alive.current) return;
        setCertificates(options);
        setSerial((previous) => selectedSerial(options, previous));
        if (options.length === 0)
          toast('Không tìm thấy chứng thư SmartCA hợp lệ cho CCCD của bạn.');
      } catch (error) {
        if (alive.current) toast(getApiErrorMessage(error, 'Không thể tải chứng thư SmartCA.'));
      } finally {
        setBusy(false);
      }
    });

  const start = () =>
    actionFlight(async () => {
      if (!consent.checked || !serial) return;
      setBusy(true);
      try {
        try {
          const same = await consent.stillCurrent();
          if (!alive.current) return;
          if (!same) {
            toast(SOURCE_CHANGED);
            await onUpdated().catch(() => setRefreshError('Chưa tải lại được hợp đồng.'));
            return;
          }
        } catch {
          if (alive.current) toast(SOURCE_CHECK_FAILED);
          return;
        }
        let failure: { error: unknown } | null = null;
        try {
          const next = await contractService.initiateSmartCaSignature(contract.id, serial);
          // The signer left this record: no notice and no callback; the server keeps the request.
          if (!alive.current) return;
          setCurrent({ contractId: contract.id, source: state.activeRequest, request: next });
          setRefreshError('');
          toast('Đã gửi yêu cầu. Mở ứng dụng VNPT SmartCA trên điện thoại để xác nhận.');
        } catch (error) {
          if (!alive.current) return;
          failure = { error };
          toast(getApiErrorMessage(error, 'Không thể gửi yêu cầu ký số.'));
        }
        try {
          await onUpdated();
        } catch {
          // Show the original VNPT result; unlike web, a failed re-read never reports an accepted
          // request as "not sent".
          if (!failure) setRefreshError('Chưa tải lại được hợp đồng.');
        }
      } finally {
        setBusy(false);
      }
    });

  if (view.kind === 'finished')
    return (
      <ToneBox tone="warning">
        <Text className="text-sm leading-6 text-warning">{view.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void onUpdated().catch(() => toast('Chưa tải lại được hợp đồng.'))}
          className="min-h-11 justify-center self-start">
          <Text className="text-sm font-semibold text-warning underline">
            Tải lại trạng thái hợp đồng
          </Text>
        </Pressable>
      </ToneBox>
    );
  if (view.kind !== 'sign') return <ToneBox tone={VIEW_TONES[view.kind]}>{view.message}</ToneBox>;
  if (syncing)
    return (
      <ToneBox tone="info">
        <Text accessibilityLiveRegion="polite" className="text-sm leading-6 text-foreground">
          Chữ ký số của bạn đã được xác minh. Đang đồng bộ hồ sơ, không cần ký lại.
        </Text>
        {refreshError ? (
          <Text accessibilityRole="alert" className="text-xs leading-5 text-warning">
            {refreshError}
          </Text>
        ) : null}
        <ActionButton
          label="Tải lại trạng thái hợp đồng"
          icon="refresh"
          variant="secondary"
          onClick={() => void onUpdated().catch(() => toast('Chưa tải lại được hợp đồng.'))}
        />
      </ToneBox>
    );

  const signDisabled = busy || !hasReadyPdf || !signGate.allowed;
  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-3">
        <Icon name="shield-checkmark-outline" size={24} className="text-primary" />
        <View className="flex-1 gap-1">
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            Ký số{' '}
            {contract.agreementKind === 'DEPOSIT'
              ? 'hợp đồng cọc'
              : contract.agreementKind === 'AMENDMENT'
                ? 'phụ lục'
                : 'hợp đồng'}{' '}
            bằng VNPT SmartCA
          </Text>
          <Text className="text-xs leading-5 text-muted-foreground">
            Rà soát PDF trước khi gửi yêu cầu. Ứng dụng SmartCA xác nhận giao dịch; HomeSpace sẽ
            đóng gói và kiểm tra chữ ký trên PDF.
          </Text>
        </View>
      </View>
      {view.pending ? (
        <View className="gap-2 rounded-2xl border border-primary-border bg-primary-soft p-3">
          <Text accessibilityLiveRegion="polite" className="text-sm font-semibold text-foreground">
            {current?.status === 'PENDING_USER_CONFIRMATION' || current?.status === 'CREATED'
              ? 'Đang chờ bạn xác nhận trên ứng dụng VNPT SmartCA'
              : 'Đã nhận kết quả ký; đang xác minh và lưu PDF'}
          </Text>
          {current?.docId ? (
            <Text selectable className="text-sm leading-6 text-foreground">
              Mã tài liệu để đối chiếu trên app: <Text className="font-bold">{current.docId}</Text>
            </Text>
          ) : null}
          <Text className="text-xs leading-5 text-muted-foreground">
            Trạng thái được đồng bộ bởi máy chủ ngay cả khi bạn đóng trang này.
          </Text>
          {refreshError ? (
            <Text accessibilityRole="alert" className="text-xs leading-5 text-warning">
              {refreshError}
            </Text>
          ) : null}
          <ActionButton
            label="Kiểm tra ngay"
            icon="refresh"
            variant="secondary"
            onClick={() => void refresh(true)}
          />
        </View>
      ) : (
        <>
          {current && ['REJECTED', 'EXPIRED', 'FAILED', 'CANCELLED'].includes(current.status) ? (
            <ToneBox tone="warning">
              {current.failureReason ||
                'Yêu cầu ký chưa hoàn tất. Vui lòng kiểm tra trước khi thử lại.'}
            </ToneBox>
          ) : null}
          {refreshError ? (
            <Text accessibilityRole="alert" className="text-xs leading-5 text-warning">
              {refreshError}
            </Text>
          ) : null}
          {!hasReadyPdf ? (
            <Text className="text-sm leading-6 text-warning">
              Cần kết xuất PDF của bản sửa đổi hiện tại trước khi ký.
            </Text>
          ) : null}
          <ActionButton
            label={busy ? 'Đang tải...' : 'Chọn chứng thư SmartCA'}
            icon="ribbon-outline"
            variant="secondary"
            disabled={signDisabled}
            onClick={() => void loadCertificates()}
          />
          {certificates.length > 0 ? (
            <View accessibilityLabel="Chọn chứng thư số" className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Chọn chứng thư</Text>
              {certificates.map((item) => (
                <ChoiceButton
                  key={item.serialNumber}
                  label={`${item.subject} — ${item.serialNumber}`}
                  selected={serial === item.serialNumber}
                  disabled={busy}
                  onPress={() => setSerial(item.serialNumber)}
                />
              ))}
            </View>
          ) : null}
          <ConsentSourceNote note={consent.note} />
          <Checkbox
            checked={consent.checked}
            onChange={consent.setChecked}
            disabled={!consent.source}
            label="Tôi đã đọc bản PDF và đồng ý ký số hợp đồng này."
          />
          <ActionButton
            label="Gửi yêu cầu ký tới SmartCA"
            icon="create-outline"
            busy={busy}
            disabled={signDisabled || !serial || !consent.checked}
            onClick={() => void start()}
          />
          {signGate.title ? (
            <Text className="text-xs leading-5 text-muted-foreground">{signGate.title}</Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

const VIEW_TONES = {
  ended: 'neutral',
  disabled: 'warning',
  active: 'success',
  failed: 'danger',
  blocked: 'info',
  waiting: 'info',
} as const;
