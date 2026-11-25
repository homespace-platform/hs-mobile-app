// hs-web-app components/rental-request/RentalRequestCard.tsx.
import type { ComponentProps, ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

import Icon from '@/components/Icon';
import AgreementDocumentActions from '@/components/rental/onboarding/AgreementDocumentActions';
import { RentalReceiptNotice } from '@/components/rental/onboarding/RentalDepositQuickViewModal';
import { StartChangeNotice } from '@/components/rental/onboarding/RentalStartChangeQuickModal';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { vnDateTime } from '@/lib/rental/format';
import { formatVND } from '@/lib/rental/rental-request.helper';
import type { RentalNavigate } from '@/lib/rental-nav/routes';
import { useNowMs } from '@/lib/rental-sync/hooks';
import type { ContractResponse } from '@/types/rental/contract.type';
import type {
  RentalRequestConflict,
  RentalRequestResponse,
} from '@/types/rental/rental-request.type';

import { acceptButtonLabel, cardState, depositPolicyText, sideOf, type Mode } from './logic';
import RentalContractFallbackButton from './RentalContractFallbackButton';
import RequestThumbnail from './RequestThumbnail';

export interface RequestCardActions {
  accept: (r: RentalRequestResponse) => void;
  reject: (r: RentalRequestResponse) => void;
  cancel: (r: RentalRequestResponse) => void;
  pay: (r: RentalRequestResponse) => void;
  review: (r: RentalRequestResponse) => void;
  createContract: (r: RentalRequestResponse) => void;
  openDetail: (r: RentalRequestResponse) => void;
  openContract: (contractId: string) => void;
  openStartChange: (r: RentalRequestResponse) => void;
  askAi: (conflict: RentalRequestConflict) => void;
  openListing: (listingId: string) => void;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 py-1.5 pr-2">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

function ContactLine({
  icon,
  children,
  onPress,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      className={`flex-row items-center gap-1.5 ${onPress ? 'min-h-11' : 'py-1'}`}>
      <Icon name={icon} size={15} className={onPress ? 'text-primary' : 'text-muted-foreground'} />
      <Text
        numberOfLines={1}
        className={`shrink text-sm ${onPress ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
        {children}
      </Text>
    </Pressable>
  );
}

function LinkButton({
  label,
  icon,
  onPress,
  disabled,
  tone = 'text-muted-foreground',
  hint,
}: {
  label: string;
  icon?: ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  disabled?: boolean;
  tone?: string;
  /** The web tooltip. */
  hint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityHint={hint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={`min-h-11 flex-row items-center gap-1.5 rounded-lg px-2 active:bg-muted ${disabled ? 'opacity-50' : ''}`}>
      {icon ? <Icon name={icon} size={16} className={tone} /> : null}
      <Text className={`shrink text-sm font-semibold ${tone}`}>{label}</Text>
    </Pressable>
  );
}

/** One request: status, key facts, ONE primary action and a secondary "Xem chi tiết". */
export default function RentalRequestCard({
  req,
  mode,
  contract,
  agreement,
  holdLabel,
  conflict,
  busy,
  creatingContract,
  canManage,
  manageTitle,
  canManageContract,
  contractTitle,
  actions,
  onNavigate,
}: {
  req: RentalRequestResponse;
  mode: Mode;
  contract?: ContractResponse | null;
  agreement?: ContractResponse | null;
  holdLabel: string | null;
  conflict?: RentalRequestConflict;
  busy: boolean;
  creatingContract: boolean;
  canManage: boolean;
  manageTitle?: string;
  canManageContract: boolean;
  contractTitle?: string;
  actions: RequestCardActions;
  onNavigate: RentalNavigate;
}) {
  const nowMs = useNowMs();
  const state = cardState({ mode, request: req, contract, conflict, nowMs });
  const { presentation: p, kind } = state;
  const openListing = () => actions.openListing(req.listingId);

  return (
    <View
      accessibilityLabel={`Yêu cầu thuê ${req.listingTitle}`}
      className="gap-3 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row gap-3">
        <Pressable onPress={openListing} accessibilityRole="link" accessibilityLabel="Xem bài đăng">
          <RequestThumbnail url={req.listingThumbnail} className="h-16 w-16" />
        </Pressable>
        <View className="flex-1">
          <Text
            onPress={openListing}
            accessibilityRole="link"
            numberOfLines={2}
            className="text-base font-bold leading-snug text-foreground">
            {req.listingTitle}
          </Text>
          {req.listingAddress ? (
            <Text numberOfLines={1} className="mt-0.5 text-sm text-muted-foreground">
              {req.listingAddress}
            </Text>
          ) : null}
          {req.listingPrice ? (
            <Text className="mt-1 text-sm font-extrabold text-primary">
              {formatVND(req.listingPrice)}
              <Text className="text-xs font-normal text-muted-foreground">/tháng</Text>
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Badge tone={p.tone} icon="ellipse">
          {p.label}
        </Badge>
        <Text className="text-xs text-muted-foreground">
          Gửi {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true, locale: vi })}
        </Text>
      </View>
      <Text className="text-sm leading-5 text-muted-foreground">{p.hint}</Text>

      <View className="flex-row flex-wrap rounded-xl border border-border bg-muted px-3 py-1">
        <Fact
          label="Dọn vào"
          value={req.moveInDate ? format(new Date(req.moveInDate), 'dd/MM/yyyy') : '—'}
        />
        <Fact label="Thời hạn" value={`${req.leaseMonths} tháng`} />
        <Fact label="Số người ở" value={`${req.occupantCount || 1} người`} />
        <Fact
          label="Tiền cọc"
          value={req.depositAmount != null ? formatVND(req.depositAmount) : 'Theo tin đăng'}
        />
      </View>

      {mode === 'RECEIVED' ? (
        <View>
          <View className="flex-row items-center gap-1.5">
            <Icon name="person-outline" size={15} className="text-primary" />
            <Text className="shrink text-sm font-semibold text-foreground">{req.renterName}</Text>
          </View>
          <ContactLine
            icon="call-outline"
            onPress={() => void Linking.openURL(`tel:${req.renterPhone}`)}>
            {req.renterPhone}
          </ContactLine>
          {req.renterEmail ? (
            <ContactLine icon="mail-outline">{req.renterEmail}</ContactLine>
          ) : null}
          {req.renterNote ? (
            <Text numberOfLines={2} className="mt-1 text-sm italic text-muted-foreground">
              &quot;{req.renterNote}&quot;
            </Text>
          ) : null}
        </View>
      ) : null}
      {req.rejectReason ? (
        <View className="rounded-xl border border-danger bg-danger-soft p-3">
          <Text className="text-sm text-danger">Lý do từ chối: {req.rejectReason}</Text>
        </View>
      ) : null}
      {req.status === 'PENDING' && req.respondBy ? (
        <Text className="text-sm text-muted-foreground">
          Hạn chủ nhà phản hồi: {vnDateTime(req.respondBy)} (giờ Việt Nam)
        </Text>
      ) : null}

      {agreement ? (
        <View
          accessibilityLabel="Hợp đồng của yêu cầu thuê"
          className="gap-3 rounded-xl border border-primary-border bg-primary-soft p-3">
          <View>
            <View className="flex-row items-center gap-1.5">
              <Icon name="document-text-outline" size={16} className="text-primary" />
              <Text className="shrink text-sm font-semibold text-foreground">
                {agreement.agreementKind === 'DEPOSIT'
                  ? 'Hợp đồng đặt cọc giữ phòng'
                  : 'Hợp đồng thuê'}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-muted-foreground">
              {agreement.contractNumber}
              {agreement.agreementKind === 'DEPOSIT' && agreement.status === 'ACTIVE'
                ? ' · Đã ký đủ hai bên'
                : ''}
            </Text>
          </View>
          <AgreementDocumentActions
            key={agreement.id}
            contract={agreement}
            perspective={sideOf(mode)}
            onNavigate={onNavigate}
          />
        </View>
      ) : null}
      <StartChangeNotice request={req} mode={mode} onOpen={() => actions.openStartChange(req)} />
      {kind === 'review' ? (
        <RentalReceiptNotice request={req} onOpen={() => actions.review(req)} />
      ) : null}

      {/* The one action area */}
      <View className="gap-2 border-t border-border pt-3">
        {kind === 'respond' ? (
          <>
            <ActionButton
              label={acceptButtonLabel(holdLabel)}
              icon="checkmark-circle-outline"
              disabled={busy || !canManage}
              onClick={() => actions.accept(req)}
            />
            <ActionButton
              label="Từ chối"
              variant="secondary"
              disabled={busy || !canManage}
              onClick={() => actions.reject(req)}
            />
            {manageTitle ? <Text className="text-xs text-warning">{manageTitle}</Text> : null}
          </>
        ) : null}
        {kind === 'pay' ? (
          <ActionButton
            label={state.payLabel}
            icon="card-outline"
            disabled={busy}
            onClick={() => actions.pay(req)}
          />
        ) : null}
        {kind === 'createContract' ? (
          <>
            <RentalContractFallbackButton
              request={req}
              mode={mode}
              contract={contract}
              busy={creatingContract}
              disabled={busy || !canManageContract}
              onCreate={actions.createContract}
            />
            {contractTitle ? <Text className="text-xs text-warning">{contractTitle}</Text> : null}
          </>
        ) : null}
        {kind === 'open' ? (
          <ActionButton
            label={state.openLabel}
            icon={state.opensContract ? 'document-text-outline' : undefined}
            disabled={state.opensContract && busy}
            onClick={() =>
              state.opensContract ? actions.openContract(contract!.id) : actions.openDetail(req)
            }
          />
        ) : null}
        {state.showDetailSecondary ? (
          <ActionButton
            label="Xem chi tiết"
            variant="secondary"
            onClick={() => actions.openDetail(req)}
          />
        ) : null}
        <View className="flex-row flex-wrap items-center gap-1">
          <LinkButton label="Xem bài đăng" onPress={openListing} />
          {state.showAskAi && conflict ? (
            <LinkButton
              label={`Hỏi AI đánh giá (${conflict.pendingCount} yêu cầu)`}
              icon="sparkles-outline"
              tone="text-primary"
              hint={`Phòng này có ${conflict.pendingCount} yêu cầu đang chờ duyệt`}
              onPress={() => actions.askAi(conflict)}
            />
          ) : null}
          {state.showStartChange ? (
            <LinkButton
              label="Đề nghị bắt đầu thuê sớm"
              onPress={() => actions.openStartChange(req)}
            />
          ) : null}
          {state.showCancel ? (
            <LinkButton
              label="Hủy yêu cầu"
              tone="text-danger"
              disabled={busy}
              onPress={() => actions.cancel(req)}
            />
          ) : null}
        </View>
      </View>

      {req.status === 'ACCEPTED' ? (
        <PolicyNotice
          tone="neutral"
          title="Hợp đồng cọc & hợp đồng thuê"
          text={depositPolicyText(req.depositAmount)}
        />
      ) : null}
    </View>
  );
}
