// hs-web-app components/rental-request/RentalRequestModal.tsx.
import { useState } from 'react';
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import ModalShell from '@/components/rental/shared/ModalShell';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import RentalCostSummary from '@/components/rental/shared/RentalCostSummary';
import { formatVND } from '@/lib/rental/rental-request.helper';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { formStatusLine, submitDisabled, type ContactDraft } from './logic';
import { ContactFields, NegotiableDeposit, NoteField, PolicyAgreement } from './RequestFormDetails';
import { OccupantField, VehicleFields } from './RequestFormPeople';
import { LeaseTermField, MoveInDateField } from './RequestFormTerms';
import RequestThumbnail from './RequestThumbnail';
import { useRentalHoldMinutes } from './useRentalHoldMinutes';
import { useRentalRequestForm } from './useRentalRequestForm';

export type RentalRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  listingAddress?: string;
  listingPrice?: number;
  depositType?: 'NONE' | 'FIXED_AMOUNT' | 'MONTH_COUNT' | 'NEGOTIABLE';
  listingDepositAmount?: number | null;
  depositMonths?: number | null;
  listingThumbnail?: string | null;
  minimumLeaseMonths?: number;
  listingMaxOccupants?: number | null;
  onSuccess?: (request: RentalRequestResponse) => void;
};

export default function RentalRequestModal(props: RentalRequestModalProps) {
  // Contact fields stay per listing while the sheet is closed, as in the hidden web component.
  const [contacts] = useState(() => new Map<string, ContactDraft>());
  if (!props.isOpen) return null;
  const contact = contacts.get(props.listingId) ?? {};
  contacts.set(props.listingId, contact);
  return <RentalRequestSheet key={props.listingId} {...props} contact={contact} />;
}

function RentalRequestSheet({
  listingPrice = 0,
  minimumLeaseMonths = 6,
  ...props
}: RentalRequestModalProps & { contact: ContactDraft }) {
  const holdMinutes = useRentalHoldMinutes();
  const form = useRentalRequestForm({ ...props, listingPrice, minimumLeaseMonths });
  const status = formStatusLine({
    accepted: form.accepted,
    estimateError: form.estimateError,
    hasEstimate: !!form.estimate,
    loadingEstimate: form.loadingEstimate,
  });

  const footer = (
    <>
      {status ? (
        <Text
          accessibilityLiveRegion="polite"
          className={`w-full text-xs font-medium ${status.error ? 'text-danger' : 'text-muted-foreground'}`}>
          {status.text}
        </Text>
      ) : null}
      <ActionButton
        label="Hủy"
        variant="secondary"
        disabled={form.isSubmitting}
        onClick={props.onClose}
      />
      <ActionButton
        label={form.isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu thuê'}
        icon="sparkles-outline"
        busy={form.isSubmitting}
        disabled={submitDisabled({
          isSubmitting: form.isSubmitting,
          hasPolicy: !!form.policy,
          accepted: form.accepted,
          loadingEstimate: form.loadingEstimate,
          estimateError: form.estimateError,
          hasPaymentPlan: !!form.estimate?.paymentPlan,
        })}
        onClick={() => void form.submit()}
        className="grow"
      />
    </>
  );

  return (
    // As on web, closing stays possible while the request is being sent.
    <ModalShell
      title={
        <View className="flex-1">
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            Gửi yêu cầu thuê nhà
          </Text>
          <Text className="text-xs text-muted-foreground">
            Đăng ký quan tâm và thỏa thuận điều kiện thuê
          </Text>
        </View>
      }
      icon="home-outline"
      onClose={props.onClose}
      footer={footer}>
      <View className="gap-5">
        <PolicyNotice
          tone="warning"
          icon="time-outline"
          title="Điều kiện giữ chỗ"
          summary={
            <>
              Sau khi chủ nhà chấp thuận, bạn có{' '}
              <Text className="font-bold">
                {holdMinutes ? `${holdMinutes} phút` : 'thời hạn hiển thị trên yêu cầu thanh toán'}
              </Text>{' '}
              để hoàn tất khoản giữ chỗ.
            </>
          }>
          <Text className="text-sm leading-6 text-secondary">
            Khoản giữ chỗ được mở sau khi chủ nhà chấp thuận.{' '}
            {form.depositAmount === 0
              ? 'Không yêu cầu đặt cọc: bỏ qua chuyển cọc và ký hợp đồng cọc. Tiền thuê tháng đầu và ký hợp đồng thuê mở vào ngày bắt đầu thuê.'
              : 'Dọn vào cùng ngày: thu cọc + tiền thuê tháng đầu. Dọn vào sau: chỉ thu cọc trước, đến ngày dọn vào mới mở tiền thuê tháng đầu. Sau khi chủ nhà xác nhận nhận cọc, hai bên xem và ký hợp đồng cọc trước, không đợi đến ngày vào. Hợp đồng thuê ký riêng khi đến ngày vào và xác nhận đủ tiền tháng đầu.'}{' '}
            Bạn có thể đề nghị chủ nhà đồng ý bắt đầu thuê sớm.
          </Text>
        </PolicyNotice>

        <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <RequestThumbnail
            url={props.listingThumbnail}
            label={props.listingTitle}
            className="h-14 w-14"
          />
          <View className="flex-1">
            <Text numberOfLines={1} className="text-sm font-bold text-foreground">
              {props.listingTitle}
            </Text>
            {props.listingAddress ? (
              <Text numberOfLines={1} className="text-xs text-muted-foreground">
                {props.listingAddress}
              </Text>
            ) : null}
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <Text className="text-xs font-extrabold text-primary">
                {formatVND(listingPrice)}/tháng
              </Text>
              <Text className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {form.deposit.badge}
              </Text>
            </View>
          </View>
        </View>

        <MoveInDateField form={form} />
        <LeaseTermField form={form} minimumLeaseMonths={minimumLeaseMonths} />
        <OccupantField form={form} listingPrice={listingPrice} />
        <VehicleFields form={form} />
        <ContactFields form={form} />
        <NegotiableDeposit form={form} listingPrice={listingPrice} />
        <RentalCostSummary
          estimate={form.estimate}
          loading={form.loadingEstimate}
          error={form.estimateError}
          depositBadge={form.deposit.badge}
          occupantCount={form.occupantCount}
        />
        <NoteField form={form} />
        <PolicyAgreement form={form} />
      </View>
    </ModalShell>
  );
}
