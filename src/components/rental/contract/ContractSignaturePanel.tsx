// Web: components/contract/detail/ContractSignaturePanel.tsx (INTERNAL signature mode).
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { Checkbox, ToneBox } from '@/components/rental/onboarding/common';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { Card } from '@/components/rental/shared/Card';
import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { str } from '@/lib/rental/utils';
import { PERMISSIONS } from '@/lib/permissions';
import { useFeatureGate } from '@/lib/use-feature-gate';
import type { ContractResponse } from '@/types/rental/contract.type';

import { internalSignView, submitIfCurrent, type createSingleFlight } from './signingLogic';
import {
  ConsentSourceNote,
  SOURCE_CHANGED,
  SOURCE_CHECK_FAILED,
  useSigningConsent,
} from './useSigningConsent';

export type ContractSignaturePanelProps = {
  contract: ContractResponse;
  isLandlord: boolean;
  isTenant: boolean;
  canSend: boolean;
  signingAllowed?: boolean;
  blockedReason?: string;
  sending: boolean;
  signing: boolean;
  onSend: () => Promise<void>;
  onSign: () => Promise<void>;
  /** The screen's lock: its footer send button goes through the same one. */
  flight: ReturnType<typeof createSingleFlight>;
};

export default function ContractSignaturePanel(props: ContractSignaturePanelProps) {
  // Consent never carries over to another contract.
  return <Panel key={props.contract.id} {...props} />;
}

function Panel({
  contract,
  isLandlord,
  isTenant,
  canSend,
  signingAllowed = true,
  blockedReason,
  sending,
  signing,
  onSend,
  onSign,
  flight,
}: ContractSignaturePanelProps) {
  const manageGate = useFeatureGate(PERMISSIONS.CONTRACT_MANAGE);
  const signGate = useFeatureGate(PERMISSIONS.CONTRACT_SIGN);
  const showDialog = useDialog();
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const view = internalSignView({
    status: contract.status,
    isLandlord,
    isTenant,
    signingAllowed,
  });
  const consent = useSigningConsent({
    contract,
    signerId: isLandlord ? contract.landlordId : contract.tenantId,
    mode: 'INTERNAL',
    enabled: view === 'landlord-draft' || view === 'tenant-pending',
    hasFile: view !== 'landlord-draft' || canSend,
    version: contract,
  });
  // `sending`/`signing` arrive one render late: the lock stops a double tap.
  const submit = (action: () => Promise<void>) =>
    void flight(async () => {
      setChecking(true);
      try {
        await submitIfCurrent({
          stillCurrent: consent.stillCurrent,
          isAlive: () => alive.current,
          refuse: (reason) =>
            showDialog('Thông báo', reason === 'changed' ? SOURCE_CHANGED : SOURCE_CHECK_FAILED),
          action,
        });
      } finally {
        setChecking(false);
      }
    });

  if (view === 'active')
    return (
      <View className="gap-3 rounded-2xl border border-success bg-success-soft p-4">
        <Heading
          icon="checkmark-circle"
          tint="text-success"
          title="Hợp đồng giao kết thành công và đang có hiệu lực">
          <Text className="text-sm leading-6 text-secondary">
            Hai bên đã hoàn tất xác nhận thỏa thuận trên nền tảng HomeSpace
          </Text>
        </Heading>
        <View className="border-t border-success pt-1">
          <InfoRow
            label="Xác nhận Bên A (Chủ nhà):"
            value={
              contract.landlordConfirmedAt
                ? str(contract.landlordConfirmedAt)
                : 'Đã xác nhận nội dung'
            }
          />
          <InfoRow
            label="Xác nhận Bên B (Người thuê):"
            value={contract.signedAt ? str(contract.signedAt) : 'Đã xác nhận ký'}
          />
        </View>
      </View>
    );

  if (view === 'blocked')
    return (
      <ToneBox tone="info">
        {blockedReason || 'Chưa đủ điều kiện ký. Xem tiến trình nhận nhà phía trên.'}
      </ToneBox>
    );

  if (view === 'landlord-draft') {
    const disabled = !consent.checked || !canSend || sending || checking || !manageGate.allowed;
    const hint =
      manageGate.title ??
      (!canSend
        ? 'Bổ sung đủ dữ liệu và kết xuất file xem trước trước khi gửi'
        : !consent.checked
          ? 'Vui lòng tích chọn đồng ý trước khi gửi'
          : undefined);
    return (
      <Card className="gap-3">
        <Heading
          icon="document-attach-outline"
          tint="text-primary"
          title="Xác nhận gửi bản hợp đồng cho người thuê"
        />
        <PolicyNotice
          tone="neutral"
          title="Trước khi gửi hợp đồng"
          summary="Vui lòng rà soát kỹ các điều khoản và bản xem trước trước khi gửi.">
          <Text className="text-sm leading-6 text-secondary">
            Vui lòng rà soát kỹ các điều khoản và bản xem trước trước khi gửi. Sau khi gửi, bản hợp
            đồng sẽ được chuyển sang trạng thái chờ người thuê xác nhận ký.
          </Text>
        </PolicyNotice>
        <ConsentSourceNote note={consent.note} />
        <Checkbox
          checked={consent.checked}
          onChange={consent.setChecked}
          disabled={!consent.source}
          label="Tôi xác nhận nội dung hợp đồng và đồng ý gửi bản này cho người thuê."
        />
        <Text className="text-xs text-muted-foreground">
          Chế độ xác nhận hợp đồng nội bộ HomeSpace
        </Text>
        <ActionButton
          label={sending ? 'Đang gửi...' : 'Xác nhận và gửi người thuê'}
          icon="send"
          busy={sending || checking}
          disabled={disabled}
          onClick={() => submit(onSend)}
        />
        {hint ? <Text className="text-xs leading-5 text-muted-foreground">{hint}</Text> : null}
      </Card>
    );
  }

  if (view === 'tenant-pending') {
    const disabled = !consent.checked || signing || checking || !signGate.allowed;
    const hint =
      signGate.title ??
      (!consent.checked ? 'Vui lòng đọc và tích chọn đồng ý trước khi ký' : undefined);
    return (
      <Card className="gap-3">
        <Heading icon="create-outline" tint="text-success" title="Xác nhận ký hợp đồng thuê">
          <Badge>Chế độ xác nhận hợp đồng nội bộ - chưa tích hợp chữ ký số.</Badge>
        </Heading>
        <PolicyNotice
          tone="neutral"
          title="Trước khi chấp thuận"
          summary="Bạn đã hoàn tất thanh toán ban đầu.">
          <Text className="text-sm leading-6 text-secondary">
            Bạn đã hoàn tất thanh toán ban đầu. Vui lòng tải/xem lại văn bản hợp đồng trước khi xác
            nhận chấp thuận.
          </Text>
        </PolicyNotice>
        <ConsentSourceNote note={consent.note} />
        <Checkbox
          checked={consent.checked}
          onChange={consent.setChecked}
          disabled={!consent.source}
          label="Tôi đã đọc và đồng ý với toàn bộ nội dung hợp đồng và các phụ lục."
        />
        <Text className="text-xs leading-5 text-muted-foreground">
          Việc bấm xác nhận có giá trị xác lập quan hệ thuê nhà chính thức giữa hai bên.
        </Text>
        <ActionButton
          label={signing ? 'Đang ký hợp đồng...' : 'Xác nhận ký hợp đồng'}
          icon="create-outline"
          busy={signing || checking}
          disabled={disabled}
          onClick={() => submit(onSign)}
        />
        {hint ? <Text className="text-xs leading-5 text-muted-foreground">{hint}</Text> : null}
      </Card>
    );
  }

  if (view === 'landlord-pending')
    return (
      <ToneBox tone="info">
        <Heading icon="send" tint="text-primary" title="Đã gửi hợp đồng cho người thuê">
          <Text className="text-sm leading-6 text-secondary">
            {contract.landlordConfirmedAt
              ? `Bạn đã xác nhận lúc ${str(contract.landlordConfirmedAt)}. `
              : ''}
            Đang chờ người thuê rà soát văn bản và hoàn tất xác nhận ký hợp đồng.
          </Text>
        </Heading>
      </ToneBox>
    );

  return null;
}

function Heading({
  icon,
  tint,
  title,
  children,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  tint: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <Icon name={icon} size={22} className={tint} />
      <View className="flex-1 gap-1">
        <Text accessibilityRole="header" className="text-base font-bold text-foreground">
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}
