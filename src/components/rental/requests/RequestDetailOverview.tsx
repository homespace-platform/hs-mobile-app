// "Tổng quan" tab of hs-web-app components/rental-request/RentalRequestDetailModal.tsx:277-329.
import type { ComponentProps, ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { format } from 'date-fns';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import { SectionCard } from '@/components/rental/shared/Card';
import EndOfPeriodCharges from '@/components/rental/shared/EndOfPeriodCharges';
import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { vnDateTime } from '@/lib/rental/format';
import { formatVND } from '@/lib/rental/rental-request.helper';
import {
  calculateEstimatedEndDate,
  formatCarCount,
  formatMotorbikeCount,
  formatOccupantCount,
  parseCostBreakdownSnapshot,
  parseExcludedChargesSnapshot,
} from '@/lib/rental/rental-request-snapshot.helper';
import type { PaymentRequest } from '@/types/rental/payment-request.type';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { paymentTotals, type Mode } from './logic';

const BODY = 'text-sm leading-6 text-secondary';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-[48%] grow rounded-xl border border-border bg-muted p-3">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text selectable className="mt-0.5 text-sm font-bold text-foreground">
        {value}
      </Text>
    </View>
  );
}

function LinkFact({
  label,
  value,
  icon,
  url,
}: {
  label: string;
  value: string;
  icon: ComponentProps<typeof Icon>['name'];
  url: string;
}) {
  return (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${value}`}
      className="min-h-11 rounded-xl border border-border bg-muted p-3 active:opacity-80">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <View className="mt-0.5 flex-row items-center gap-1.5">
        <Icon name={icon} size={15} className="text-primary" />
        <Text className="shrink text-sm font-bold text-primary">{value}</Text>
      </View>
    </Pressable>
  );
}

export function ToneBox({
  tone,
  icon,
  children,
}: {
  tone: 'warning' | 'danger';
  icon: ComponentProps<typeof Icon>['name'];
  children: ReactNode;
}) {
  const warning = tone === 'warning';
  return (
    <View
      className={`flex-row gap-2 rounded-2xl border p-3 ${warning ? 'border-warning bg-warning-soft' : 'border-danger bg-danger-soft'}`}>
      <Icon name={icon} size={18} className={warning ? 'text-warning' : 'text-danger'} />
      <View className="flex-1">{children}</View>
    </View>
  );
}

export default function RequestDetailOverview({
  detail,
  mode,
  payment,
  holdText,
  onOpenListing,
}: {
  detail: RentalRequestResponse;
  mode: Mode;
  payment: PaymentRequest | null;
  holdText: string | null;
  onOpenListing: (listingId: string) => void;
}) {
  const { rentPrice, prepaidFees, upfrontTotal } = paymentTotals(detail, payment);

  return (
    <>
      {detail.status === 'PENDING' && detail.respondBy ? (
        <PolicyNotice
          tone="neutral"
          title="Hạn chủ nhà phản hồi"
          summary="Quá hạn yêu cầu tự hết hiệu lực; phòng chưa bị khóa ở bước này.">
          <Text className={BODY}>
            Hạn chủ nhà phản hồi: {vnDateTime(detail.respondBy)} (giờ Việt Nam). Quá hạn yêu cầu tự
            hết hiệu lực; phòng chưa bị khóa ở bước này.
          </Text>
        </PolicyNotice>
      ) : null}
      {detail.status === 'EXPIRED' && detail.holdExpiresAt ? (
        <ToneBox tone="warning" icon="time-outline">
          <Text className="text-sm font-semibold text-warning">
            Thời hạn giữ chỗ{holdText ? ` ${holdText}` : ''} đã kết thúc vào lúc{' '}
            {format(new Date(detail.holdExpiresAt), 'HH:mm:ss, dd/MM/yyyy')}
          </Text>
        </ToneBox>
      ) : null}
      {detail.rejectReason ? (
        <ToneBox tone="danger" icon="close-circle-outline">
          <Text className="text-sm font-bold text-danger">Lý do từ chối</Text>
          <Text className="mt-1 text-sm italic text-danger">&quot;{detail.rejectReason}&quot;</Text>
        </ToneBox>
      ) : null}

      <SectionCard title="Bài đăng cho thuê">
        <View>
          <Text className="text-base font-bold text-foreground">{detail.listingTitle}</Text>
          {detail.listingPrice != null ? (
            <Text className="mt-1 text-sm text-muted-foreground">
              Giá niêm yết hiện tại:{' '}
              <Text className="font-bold text-foreground">{formatVND(detail.listingPrice)}</Text>
              /tháng
            </Text>
          ) : null}
        </View>
        <ActionButton
          label="Xem bài đăng"
          icon="open-outline"
          variant="secondary"
          onClick={() => onOpenListing(detail.listingId)}
        />
      </SectionCard>

      <SectionCard title={mode === 'RECEIVED' ? 'Thông tin khách thuê' : 'Thông tin của bạn'}>
        <View className="flex-row">
          <Fact label="Họ và tên" value={detail.renterName} />
        </View>
        <LinkFact
          label="Số điện thoại"
          value={detail.renterPhone}
          icon="call-outline"
          url={`tel:${detail.renterPhone}`}
        />
        {detail.renterEmail ? (
          <LinkFact
            label="Email liên hệ"
            value={detail.renterEmail}
            icon="mail-outline"
            url={`mailto:${detail.renterEmail}`}
          />
        ) : null}
        {detail.renterNote ? (
          <View className="gap-1 rounded-xl border border-border bg-muted p-3">
            <Text className="text-xs font-semibold text-muted-foreground">
              Lời nhắn gửi chủ nhà
            </Text>
            <Text selectable className="text-sm italic leading-6 text-foreground">
              &quot;{detail.renterNote}&quot;
            </Text>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Điều kiện thuê & nhân khẩu">
        <View className="flex-row flex-wrap gap-2">
          <Fact
            label="Ngày dọn vào"
            value={detail.moveInDate ? format(new Date(detail.moveInDate), 'dd/MM/yyyy') : '—'}
          />
          <Fact label="Thời hạn thuê" value={`${detail.leaseMonths} tháng`} />
          <Fact
            label="Dự kiến kết thúc"
            value={calculateEstimatedEndDate(detail.moveInDate, detail.leaseMonths) || '—'}
          />
          <Fact label="Số người ở" value={formatOccupantCount(detail.occupantCount)} />
          <Fact label="Xe máy" value={formatMotorbikeCount(detail.motorbikeCount)} />
          <Fact label="Ô tô" value={formatCarCount(detail.carCount)} />
        </View>
      </SectionCard>

      <SectionCard title="Khoản thanh toán ban đầu">
        <PolicyNotice
          tone="neutral"
          title="Nghĩa vụ thanh toán"
          summary="Nghĩa vụ gồm cọc và tiền tháng đầu.">
          <Text className={BODY}>
            Nghĩa vụ gồm cọc và tiền tháng đầu. Nếu nhận nhà trong tương lai, hai khoản được mở ở
            hai thời điểm riêng; xem từng khoản ở mục Thanh toán & cọc. HomeSpace không nhận tiền và
            không giữ tiền.
          </Text>
        </PolicyNotice>
        <View className="rounded-xl border border-primary-border bg-primary-soft px-3 py-1">
          <InfoRow label="Tiền thuê kỳ đầu" value={formatVND(rentPrice)} />
          <InfoRow label="Tiền đặt cọc" value={formatVND(detail.depositAmount ?? 0)} />
          {prepaidFees > 0 ? (
            <InfoRow label="Phí đã trả trước (yêu cầu cũ)" value={formatVND(prepaidFees)} />
          ) : null}
          <InfoRow
            label="Tổng cọc + tháng đầu"
            value={formatVND(upfrontTotal)}
            strong
            className="border-t border-primary-border"
          />
        </View>
        <Text className="text-xs leading-5 text-muted-foreground">
          Đây là tổng nghĩa vụ, không phải số tiền cần chuyển ngay. Cọc là khoản bảo đảm, hoàn trả
          theo điều kiện hợp đồng.
        </Text>
        <EndOfPeriodCharges
          predictableCharges={parseCostBreakdownSnapshot(detail.costBreakdownSnapshot)}
          excludedCharges={parseExcludedChargesSnapshot(detail.excludedChargesSnapshot)}
          prepaidFees={prepaidFees}
        />
      </SectionCard>
    </>
  );
}
