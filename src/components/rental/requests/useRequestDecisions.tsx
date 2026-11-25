// Accept / reject / cancel of hs-web-app components/rental-request/RentalRequestDialogs.tsx.
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { format } from 'date-fns';

import { useDialog } from '@/components/AppDialog';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { hasProfileGateNotice, openSettings } from '@/lib/profile-gate-signal';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import rentalRequestService from '@/services/rental/rental-request.service';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { acceptSummary, createSingleFlight, isMissingPayeeAccount, type Mode } from './logic';

const BODY = 'text-sm leading-6 text-muted-foreground';
const RULE = 'text-sm leading-6 text-secondary';
const STRONG = 'font-bold text-foreground';

/** Body of the accept confirmation: the facts the landlord commits to, and the exclusivity rules. */
export function AcceptSummary({
  request,
  holdLabel,
}: {
  request: RentalRequestResponse;
  holdLabel: string | null;
}) {
  const summary = acceptSummary(request);
  const rules = [
    <Text key="reserved" className={RULE}>
      Bài đăng chuyển sang <Text className={STRONG}>Đang giữ chỗ</Text>. Người thuê cần báo chuyển
      trước hạn trên yêu cầu thanh toán.
    </Text>,
    <Text key="others" className={RULE}>
      Các yêu cầu còn chờ duyệt của cùng tin đăng sẽ tự động bị từ chối với lý do chủ nhà đã chọn
      yêu cầu khác.
    </Text>,
    <Text key="deposit" className={RULE}>
      {request.depositAmount === 0
        ? 'Không yêu cầu đặt cọc: bỏ qua hợp đồng cọc. Tiền thuê tháng đầu và ký hợp đồng thuê mở vào ngày bắt đầu thuê.'
        : 'Nếu ngày vào ở còn ở phía trước, chỉ thu cọc trước và ký riêng hợp đồng cọc sau khi xác nhận nhận tiền. Tiền tháng đầu và ký hợp đồng thuê mở vào ngày bắt đầu thuê.'}
    </Text>,
    <Text key="expiry" className={RULE}>
      Chưa báo chuyển khi hết hạn thì giải phóng giữ chỗ nếu tin còn hạn đăng. Đã báo chuyển, có
      tranh chấp hoặc đã nhận cọc thì không tự giải phóng phòng. Các yêu cầu đã bị từ chối không tự
      khôi phục khi hết hạn giữ chỗ.
    </Text>,
  ];
  return (
    <View className="mt-2 gap-3">
      <Text className={BODY}>
        Bạn đang chấp thuận yêu cầu thuê của <Text className={STRONG}>{request.renterName}</Text>
        {holdLabel ? ` và giữ chỗ ${holdLabel}.` : ' và giữ chỗ cho khách.'}
      </Text>
      <View className="rounded-xl border border-border bg-muted px-3 py-1">
        <InfoRow
          label="Ngày vào ở"
          value={request.moveInDate ? format(new Date(request.moveInDate), 'dd/MM/yyyy') : '—'}
        />
        <InfoRow label="Thời hạn" value={summary.people} />
        <InfoRow label="Xe" value={summary.vehicles} />
        <InfoRow label="Tiền thuê kỳ đầu" value={summary.rent} />
        <InfoRow label="Tiền đặt cọc" value={summary.deposit} />
        <InfoRow
          label="Tổng ban đầu"
          value={summary.total}
          strong
          className="border-t border-border"
        />
      </View>
      <PolicyNotice
        tone="warning"
        title="Quy tắc khi chấp thuận"
        summary="Phòng chuyển sang Đang giữ chỗ; các yêu cầu chờ duyệt khác của tin này bị từ chối.">
        <View className="gap-2">
          {rules.map((rule) => (
            <View key={rule.key} className="flex-row gap-2">
              <Text className={RULE}>•</Text>
              <View className="flex-1">{rule}</View>
            </View>
          ))}
        </View>
      </PolicyNotice>
    </View>
  );
}

export function useRequestDecisions({
  mode,
  holdLabel,
  afterChange,
  afterCancel,
}: {
  mode: Mode;
  holdLabel: string | null;
  afterChange: () => Promise<unknown> | void;
  afterCancel: () => void;
}) {
  const showDialog = useDialog();
  const { confirm, askReason } = useActionDialog();
  const [processing, setProcessing] = useState(false);
  const single = useRef(createSingleFlight(setProcessing));
  const notify = (message: string) => showDialog('Thông báo', message);
  const succeed = (message: string) => showDialog('Thành công', message, undefined, 'success');

  const accept = (request: RentalRequestResponse) =>
    single.current(async () => {
      const ok = await confirm({
        title: holdLabel ? `Duyệt yêu cầu & giữ chỗ ${holdLabel}` : 'Duyệt yêu cầu & giữ chỗ',
        description: <AcceptSummary request={request} holdLabel={holdLabel} />,
        confirmLabel: 'Xác nhận chấp thuận',
      });
      if (!ok) return;
      try {
        await rentalRequestService.acceptRentalRequest(request.id);
        succeed(
          'Đã chấp thuận và giữ chỗ. Các yêu cầu còn chờ duyệt của tin đăng này đã được từ chối kèm lý do.'
        );
        await afterChange();
      } catch (error) {
        if (hasProfileGateNotice(error)) return;
        if (isMissingPayeeAccount(error)) {
          showDialog(
            'Thông báo',
            'Bạn cần thiết lập tài khoản nhận tiền mặc định trước khi chấp nhận yêu cầu thuê.',
            [
              { text: 'Đóng', style: 'cancel' },
              { text: 'Cài đặt tài khoản', onPress: () => openSettings('bank-accounts') },
            ]
          );
        } else notify(getApiErrorMessage(error, 'Duyệt yêu cầu thất bại.'));
      }
    });

  const reject = (request: RentalRequestResponse) =>
    single.current(async () => {
      // Optional reason: an empty answer is allowed, closing the dialog is not.
      const reason = await askReason({
        title: 'Từ chối yêu cầu thuê',
        minLength: 0,
        label: 'Lý do từ chối (tuỳ chọn)',
        tone: 'danger',
        confirmLabel: 'Xác nhận từ chối',
        placeholder:
          'VD: Căn hộ hiện đã có khách đặt cọc trước hoặc không đáp ứng thời gian dọn vào...',
        description: (
          <Text className={`mt-1 ${BODY}`}>
            Từ chối yêu cầu của <Text className={STRONG}>{request.renterName}</Text> cho căn{' '}
            {request.listingTitle}.
          </Text>
        ),
      });
      if (reason === null) return;
      try {
        await rentalRequestService.rejectRentalRequest(request.id, reason);
        succeed('Đã từ chối yêu cầu thuê.');
        await afterChange();
      } catch (error) {
        if (!hasProfileGateNotice(error))
          notify(getApiErrorMessage(error, 'Từ chối yêu cầu thất bại.'));
        // RentalRequestDialogs.tsx:91-94 does not reload after a failed rejection.
      }
    });

  const cancel = (request: RentalRequestResponse) =>
    single.current(async () => {
      const ok = await confirm({
        title: 'Hủy yêu cầu thuê nhà?',
        tone: 'danger',
        confirmLabel: 'Xác nhận hủy',
        cancelLabel: 'Giữ yêu cầu',
        description:
          request.status === 'ACCEPTED' ? (
            <Text className={`mt-1 ${BODY}`}>
              Hủy ngay lượt giữ chỗ chưa chuyển tiền cho căn{' '}
              <Text className={STRONG}>{request.listingTitle}</Text>, không cần chờ hết hạn. Tin
              đăng và chỗ xe sẽ được trả lại nếu đủ điều kiện. Nếu người thuê đã chuyển hoặc chủ nhà
              đã nhận tiền, không hủy ở đây; hãy báo chuyển hoặc yêu cầu đối soát.
            </Text>
          ) : (
            <Text className={`mt-1 ${BODY}`}>
              Bạn có chắc chắn muốn hủy yêu cầu thuê cho căn{' '}
              <Text className={STRONG}>{request.listingTitle}</Text>?
            </Text>
          ),
      });
      if (!ok) return;
      try {
        await rentalRequestService.cancelRentalRequest(request.id);
        succeed(mode === 'SENT' ? 'Đã hủy yêu cầu thuê của bạn.' : 'Đã hủy yêu cầu thuê.');
        afterCancel();
        await afterChange();
      } catch (error) {
        if (!hasProfileGateNotice(error))
          notify(getApiErrorMessage(error, 'Hủy yêu cầu thất bại.'));
        await afterChange();
      }
    });

  return { accept, reject, cancel, processing };
}
