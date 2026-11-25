// Web: components/rental-request/RentalStartChangeQuickModal.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import { useActionDialog } from '@/components/rental/shared/ActionDialog';
import { Card } from '@/components/rental/shared/Card';
import ModalShell from '@/components/rental/shared/ModalShell';
import { LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { readOnboarding } from '@/lib/rental/rental-onboarding-read';
import {
  calendarDate,
  startChangeStatus,
  vietnamTime,
} from '@/lib/rental/rental-start-change-quick-view';
import type { RentalListMode } from '@/lib/rental-nav/routes';
import { useVisiblePoll } from '@/lib/rental-sync/hooks';
import {
  rentalOnboardingService as service,
  type RentalOnboarding,
} from '@/services/rental/rental-onboarding.service';
import type { RentalRequestResponse } from '@/types/rental/rental-request.type';

import { myUserId, ToneBox, useToast } from './common';
import {
  confirmStartChange,
  EarlierStartForm,
  StartChangeReview,
  type StartChangeAction,
} from './EarlierStart';

export { StartChangeReview };

/** One line on the list card: a pending or decided earlier-start request and where to open it. */
export function StartChangeNotice({
  request,
  mode,
  onOpen,
}: {
  request: RentalRequestResponse;
  mode: RentalListMode;
  onOpen: () => void;
}) {
  const change = request.latestStartChange;
  if (!change) return null;
  const pending = change.status === 'REQUESTED' && request.status === 'ACCEPTED';
  return (
    <View
      accessibilityLabel="Đề nghị bắt đầu thuê sớm"
      className={`gap-2 rounded-2xl border p-3 ${pending ? 'border-warning bg-warning-soft' : 'border-border bg-muted'}`}>
      <View className="flex-row items-start gap-2">
        <Icon name="calendar-outline" size={18} className="text-foreground" />
        <Text className="flex-1 text-sm font-semibold text-foreground">
          {pending
            ? mode === 'RECEIVED'
              ? 'Có đề nghị bắt đầu sớm cần xử lý'
              : 'Đã gửi đề nghị bắt đầu sớm · Chờ chủ nhà duyệt'
            : `Đề nghị bắt đầu sớm · ${startChangeStatus[change.status] || 'Cần kiểm tra'}`}
        </Text>
      </View>
      <Text className="text-sm text-foreground">
        {calendarDate(change.previousDate)} →{' '}
        <Text className="font-bold">{calendarDate(change.requestedDate)}</Text>
      </Text>
      {pending ? (
        <Text className="text-xs text-foreground">
          Hạn phản hồi: {vietnamTime(change.respondBy)} (giờ Việt Nam)
        </Text>
      ) : null}
      <ActionButton
        label={pending && mode === 'RECEIVED' ? 'Xử lý đề nghị' : 'Xem đề nghị'}
        variant="secondary"
        onClick={onOpen}
      />
    </View>
  );
}

export type RentalStartChangeQuickModalProps = {
  request: RentalRequestResponse;
  mode: RentalListMode;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
};

export default function RentalStartChangeQuickModal(props: RentalStartChangeQuickModalProps) {
  return <StartChangeBody key={`${props.request.id}:${props.mode}`} {...props} />;
}

function StartChangeBody({ request, mode, onClose, onUpdated }: RentalStartChangeQuickModalProps) {
  const toast = useToast();
  const { confirm } = useActionDialog();
  const alive = useRef(false);
  const sequence = useRef(0);
  const lock = useRef(false);
  const [data, setData] = useState<{ view: RentalOnboarding; userId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const view = data?.view ?? null;
  const userId = data?.userId ?? null;
  const { id: requestId, ownerId, renterId } = request;

  const load = useCallback(
    async (sync = false) => {
      const seq = ++sequence.current;
      const viewer = await myUserId();
      if (!viewer || viewer !== (mode === 'RECEIVED' ? ownerId : renterId))
        throw new Error('Bạn không có quyền xem đề nghị của hồ sơ này.');
      // First open syncs stages on the server; polling only reads.
      const next = sync ? await service.refresh(requestId) : await readOnboarding(requestId);
      if (next.askerRole !== (mode === 'RECEIVED' ? 'LANDLORD' : 'TENANT'))
        throw new Error('Vai trò truy cập không phù hợp.');
      if (alive.current && seq === sequence.current) {
        setData({ view: next, userId: viewer });
        setError('');
      }
    },
    [requestId, ownerId, renterId, mode]
  );

  useEffect(() => {
    alive.current = true;
    void load(true)
      .catch((e) => {
        if (alive.current) setError(getApiErrorMessage(e, 'Không tải được đề nghị.'));
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, [load]);
  useVisiblePoll(() => {
    if (!lock.current)
      void load().catch(() => {
        if (alive.current)
          setError('Chưa làm mới được trạng thái. Hãy bấm Làm mới trước khi xử lý.');
      });
  }, 15000);

  async function refresh() {
    if (lock.current) return;
    setLoading(true);
    try {
      await load(true);
    } catch (e) {
      if (alive.current) setError(getApiErrorMessage(e, 'Không tải được đề nghị.'));
    } finally {
      if (alive.current) setLoading(false);
    }
  }

  async function mutate(task: () => Promise<RentalOnboarding>) {
    // `userId` is only set after the ownership check passed.
    if (lock.current || loading || error || !userId) return;
    lock.current = true;
    setBusy(true);
    sequence.current++;
    try {
      const next = await task();
      if (alive.current) setData({ view: next, userId });
      toast.success('Đã cập nhật đề nghị bắt đầu thuê sớm.');
      const results = await Promise.allSettled([load(), Promise.resolve().then(onUpdated)]);
      if (alive.current && results.some((r) => r.status === 'rejected'))
        setError('Đã ghi nhận thao tác nhưng chưa làm mới được danh sách. Vui lòng bấm Làm mới.');
    } catch (e) {
      toast.error(
        getApiErrorMessage(
          e,
          'Không thể xử lý đề nghị. Điều kiện hoặc thời hạn có thể đã thay đổi.'
        )
      );
      const results = await Promise.allSettled([load(), Promise.resolve().then(onUpdated)]);
      if (alive.current && results[0].status === 'rejected')
        setError('Chưa xác định được kết quả mới nhất. Hãy bấm Làm mới trước khi thao tác tiếp.');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function decide(id: string, action: StartChangeAction) {
    const change = view?.startChanges.find((c) => c.id === id);
    if (!view || !change || (action === 'approve' && view.stage !== 'WAITING_START')) return;
    if (!(await confirmStartChange(confirm, change, action))) return;
    void mutate(() =>
      action === 'withdraw'
        ? service.withdraw(request.id, id)
        : service.decide(request.id, id, action === 'approve')
    );
  }

  const canRequest = !!(
    userId &&
    mode === 'SENT' &&
    view?.askerRole === 'TENANT' &&
    view.canRequestEarlierStart
  );

  return (
    <ModalShell
      title="Đề nghị bắt đầu thuê sớm"
      icon="calendar-outline"
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <>
          <ActionButton
            label="Làm mới"
            icon="refresh"
            variant="secondary"
            disabled={busy || loading}
            onClick={() => void refresh()}
          />
          <ActionButton label="Đóng" variant="secondary" disabled={busy} onClick={onClose} />
        </>
      }>
      <View className="gap-4">
        <Text className="text-base font-bold text-foreground">{request.listingTitle}</Text>
        {error ? (
          <ToneBox tone="warning" alert>
            {error}
          </ToneBox>
        ) : null}
        {loading ? (
          <LoadingBlock label="Đang tải đề nghị…" />
        ) : view ? (
          <>
            <Card className="gap-1">
              <Text className="text-sm text-foreground">
                Người thuê: <Text className="font-bold">{request.renterName}</Text>
              </Text>
              <Text className="text-sm leading-6 text-foreground">
                Ngày bắt đầu hiện tại:{' '}
                <Text className="font-bold">{calendarDate(view.startsOn)}</Text> · Kết thúc:{' '}
                {calendarDate(view.endExclusive)} (không gồm ngày này)
              </Text>
              <Text className="text-sm leading-6 text-muted-foreground">{view.message}</Text>
            </Card>
            <StartChangeReview
              request={request}
              view={view}
              actorId={userId}
              mode={mode}
              busy={busy || !!error}
              onAction={(id, action) => void decide(id, action)}
            />
            {canRequest ? (
              <EarlierStartForm
                key={view.startChanges.length}
                view={view}
                busy={busy || !!error}
                onSubmit={(startsOn, reason) =>
                  void mutate(() => service.request(request.id, startsOn, reason))
                }
              />
            ) : null}
            {!canRequest && view.startChanges.length === 0 ? (
              <Text className="text-sm leading-6 text-muted-foreground">
                Hồ sơ chưa đủ điều kiện hoặc đã qua giai đoạn đổi ngày bắt đầu thuê.
              </Text>
            ) : null}
            <Text className="text-xs text-muted-foreground">
              Cập nhật {vietnamTime(view.serverNow)} (giờ Việt Nam)
            </Text>
          </>
        ) : null}
      </View>
    </ModalShell>
  );
}
