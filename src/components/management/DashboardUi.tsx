import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import { apiError } from '@/lib/api-error';
import { onSessionEnd, sessionGeneration } from '@/lib/session-end';

export function useDashboardData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const current = useRef<AbortController | null>(null);
  const reload = useCallback(() => {
    current.current?.abort();
    const controller = new AbortController();
    const generation = sessionGeneration();
    current.current = controller;
    setLoading(true);
    setError(null);
    void load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted && generation === sessionGeneration()) setData(result);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted && generation === sessionGeneration())
          setError(apiError(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted && generation === sessionGeneration()) setLoading(false);
      });
  }, [load]);
  useEffect(() => {
    reload();
    const unsubscribe = onSessionEnd(() => {
      current.current?.abort();
      setData(null);
      setError(null);
    });
    return () => {
      current.current?.abort();
      unsubscribe();
    };
  }, [reload]);
  return { data, error, loading, reload };
}

export const statusLabel = (status: string) =>
  (
    ({
      ACTIVE: 'Đang hiệu lực',
      DRAFT: 'Bản nháp',
      SIGNING: 'Chờ ký',
      PENDING: 'Chờ phản hồi',
      CONFIRMED: 'Đã xác nhận',
      ACCEPTED: 'Đã chấp nhận',
      REJECTED: 'Bị từ chối',
      CANCELLED: 'Đã huỷ',
      EXPIRED: 'Hết hạn',
      COMPLETED: 'Hoàn tất',
      CLOSED: 'Đã tất toán',
      TERMINATED: 'Đã kết thúc',
      PROPOSED: 'Chờ thống nhất',
      REFUND_PENDING: 'Chờ hoàn cọc',
      BALANCE_PENDING: 'Chờ thanh toán cuối',
      DISPUTED: 'Đang trao đổi',
      OPEN: 'Đang mở',
      ESCALATED: 'Đã chuyển hỗ trợ',
      CONFIRMED_PAYMENT: 'Tiền cọc đã thu ban đầu',
      PUBLISHED: 'Đang hiển thị',
      PENDING_REVIEW: 'Chờ duyệt',
      RESERVED: 'Đang giữ chỗ',
      HIDDEN: 'Đã ẩn',
      VIOLATION: 'Cần điều chỉnh',
      REQUESTED: 'Đang chờ',
      WAITING_HANDOVER: 'Chờ bàn giao',
      HELD: 'Đang giữ',
      PARTIALLY_REFUNDED: 'Đã hoàn một phần',
      REFUNDED: 'Đã hoàn',
      SETTLED: 'Đã quyết toán',
    }) as Record<string, string>
  )[status] || 'Đang xử lý';

export function Section({
  title,
  children,
  unavailable = false,
}: {
  title: string;
  children?: ReactNode;
  unavailable?: boolean;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
      <Text accessibilityRole="header" className="text-base font-bold text-foreground">
        {title}
      </Text>
      {unavailable ? (
        <Text className="text-sm leading-5 text-muted-foreground">
          Chưa tải được nhóm dữ liệu này. Hãy thử tải lại.
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      <Text className="flex-1 text-sm text-muted-foreground">{label}</Text>
      <Text className="max-w-full text-base font-bold text-foreground">{value}</Text>
    </View>
  );
}

export function ActionRow({
  title,
  detail,
  href,
  onAction,
}: {
  title: string;
  detail?: string;
  href?: string | null;
  onAction: (href: string) => void;
}) {
  const content = (
    <>
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        {detail ? <Text className="text-xs leading-5 text-muted-foreground">{detail}</Text> : null}
      </View>
      {href ? <Icon name="chevron-forward" size={17} className="text-subtle" /> : null}
    </>
  );
  return href ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => onAction(href)}
      className="min-h-12 flex-row items-center gap-2 rounded-xl bg-muted px-3 py-3 active:bg-primary-soft">
      {content}
    </Pressable>
  ) : (
    <View className="min-h-12 flex-row items-center gap-2 rounded-xl bg-muted px-3 py-3">
      {content}
    </View>
  );
}

export function Empty({ text = 'Chưa có mục cần theo dõi.' }: { text?: string }) {
  return <Text className="text-sm leading-5 text-muted-foreground">{text}</Text>;
}

export function Refresh({
  loading,
  error,
  hasData,
  reload,
}: {
  loading: boolean;
  error: string | null;
  hasData: boolean;
  reload: () => void;
}) {
  return (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading}
        onPress={reload}
        className="min-h-12 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4">
        {loading ? (
          <ActivityIndicator className="text-primary" />
        ) : (
          <Icon name="refresh-outline" size={18} className="text-primary" />
        )}
        <Text className="text-sm font-semibold text-primary">
          {loading ? 'Đang tải tổng quan...' : 'Cập nhật dữ liệu'}
        </Text>
      </Pressable>
      {error ? (
        <Text
          accessibilityRole="alert"
          className="rounded-xl bg-danger-soft p-3 text-sm leading-5 text-danger">
          {hasData ? 'Dữ liệu trước đó đang được giữ lại. ' : ''}
          {error}
        </Text>
      ) : null}
    </View>
  );
}
