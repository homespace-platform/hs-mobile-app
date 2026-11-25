// Web: components/contract/ContractListView.tsx.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import AgreementDocumentActions from '@/components/rental/onboarding/AgreementDocumentActions';
import { useToast } from '@/components/rental/onboarding/common';
import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { EmptyBlock, Skeleton } from '@/components/rental/shared/StateBlocks';
import Icon from '@/components/Icon';
import { ScreenHeader } from '@/components/Screen';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import {
  GROUPS,
  groupOf,
  hint,
  primaryAction,
  turnOf,
  type Group,
  type Kind,
  type Perspective,
} from '@/lib/rental/ContractListView';
import { contractStatus } from '@/lib/rental/rental-labels';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import type { RentalNavigate, RentalScreenNavProps } from '@/lib/rental-nav/routes';
import { useVisiblePoll } from '@/lib/rental-sync/hooks';
import { contractService } from '@/services/rental/contract.service';
import type { ContractResponse } from '@/types/rental/contract.type';

export type ContractListScreenProps = RentalScreenNavProps & {
  perspective: DashboardRole;
  /** ?kind=. Switching it: onNavigate({ screen: 'contract-list', side, kind }, { replace: true }). */
  kind: 'LEASE' | 'DEPOSIT';
};

const emptyRule = {
  landlord: {
    summary: 'Hợp đồng cọc xuất hiện sau khi bạn xác nhận nhận cọc.',
    detail:
      'Với hồ sơ có cọc, hợp đồng cọc sẽ xuất hiện sau khi xác nhận nhận cọc. Hồ sơ không đặt cọc hoặc cọc 0 đồng bỏ qua hợp đồng cọc. Hợp đồng thuê được chuẩn bị khi đến ngày bắt đầu và xác nhận đủ tiền thuê.',
    link: 'Xem yêu cầu thuê',
    mode: 'RECEIVED',
  },
  tenant: {
    summary: 'Bạn ký hợp đồng cọc sau khi chủ nhà xác nhận nhận cọc.',
    detail:
      'Với hồ sơ có cọc, bạn xem và ký hợp đồng cọc sau khi chủ nhà xác nhận nhận cọc. Không đặt cọc hoặc cọc 0 đồng thì bỏ qua bước này. Hợp đồng thuê xuất hiện khi đến ngày bắt đầu và xác nhận đủ tiền.',
    link: 'Xem yêu cầu đã gửi',
    mode: 'SENT',
  },
} as const;

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="min-h-11 justify-center">
      <Text className="text-sm font-bold text-primary">{label}</Text>
    </Pressable>
  );
}

function Pager({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: 'chevron-back' | 'chevron-forward';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface ${disabled ? 'opacity-40' : 'active:bg-muted'}`}>
      <Icon name={icon} size={18} className="text-foreground" />
    </Pressable>
  );
}

function ContractCard({
  c,
  perspective,
  onNavigate,
}: {
  c: ContractResponse;
  perspective: Perspective;
  onNavigate: RentalNavigate;
}) {
  const kind: Kind = c.agreementKind === 'DEPOSIT' ? 'DEPOSIT' : 'LEASE';
  const status = contractStatus(c.status, kind);
  const turn = turnOf(c, perspective);
  const action = primaryAction(c, perspective, turn);
  const note = hint(c, perspective, turn);
  const detail = contractDetailPath(perspective, c.id);
  const tenantDraft = kind === 'LEASE' && c.status === 'DRAFT' && perspective === 'tenant';
  return (
    <View
      className={`gap-2 rounded-2xl border bg-surface p-4 ${turn === 'mine' ? 'border-2 border-primary' : 'border-border'}`}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-sm font-semibold text-primary">
          {kind === 'DEPOSIT' ? 'Hợp đồng cọc · Giữ phòng' : 'Hợp đồng thuê'}
        </Text>
        <Badge tone={status.tone}>{status.label}</Badge>
      </View>
      <Pressable
        onPress={() => onNavigate(detail)}
        accessibilityRole="link"
        className="min-h-11 justify-center">
        <Text numberOfLines={1} className="text-base font-bold text-foreground">
          {c.contractNumber}
        </Text>
      </Pressable>
      <Text className="text-sm leading-5 text-muted-foreground">
        {perspective === 'landlord' ? 'Bạn là bên cho thuê' : 'Bạn là bên đi thuê'}
        {c.createdAt ? ` · Tạo ${format(new Date(c.createdAt), 'dd/MM/yyyy')}` : ''}
        {kind === 'LEASE' && c.effectiveLeaseMonths
          ? ` · Thời hạn ${c.effectiveLeaseMonths} tháng`
          : ''}
      </Text>
      {note ? <Text className="text-sm font-medium text-foreground">{note}</Text> : null}
      {tenantDraft ? (
        <View className="rounded-xl bg-muted px-3 pt-3">
          <Text className="text-sm leading-6 text-muted-foreground">
            Đây là bản đang soạn, chưa có hiệu lực. Bạn được xem nội dung; chỉ ký được khi đã đến
            ngày thuê và xác nhận đủ tiền.
          </Text>
          <LinkText
            label="Xem hợp đồng & đề nghị bắt đầu thuê sớm →"
            onPress={() => onNavigate(detail)}
          />
        </View>
      ) : null}
      <View className="gap-2 border-t border-border pt-3">
        <ActionButton label={`${action.label} →`} onClick={() => onNavigate(action.href)} />
        {!action.detail && !tenantDraft ? (
          <ActionButton label="Mở hồ sơ" variant="secondary" onClick={() => onNavigate(detail)} />
        ) : null}
        <AgreementDocumentActions
          contract={c}
          perspective={perspective}
          showDetails={false}
          onNavigate={onNavigate}
        />
      </View>
    </View>
  );
}

export default function ContractListScreen({
  perspective,
  kind,
  onBack,
  onNavigate,
}: ContractListScreenProps) {
  const toast = useToast();
  const sequence = useRef({ value: 0 });
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContractResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [group, setGroup] = useState<Group>('ALL');
  const notify = useRef(toast);
  useEffect(() => {
    notify.current = toast;
  }, [toast]);

  const load = useCallback(
    async (silent = false) => {
      const current = ++sequence.current.value;
      if (!silent) setLoading(true);
      try {
        // The groups are a client-side view over the page: the API filter stays "all statuses".
        const res = await contractService.listContracts({
          role: perspective.toUpperCase() as 'LANDLORD' | 'TENANT',
          page,
          size: 12,
          agreementKind: kind,
        });
        if (current !== sequence.current.value) return;
        setItems(res.result || []);
        setTotalPages(res.totalPages || 1);
      } catch (err) {
        if (current === sequence.current.value && !silent)
          notify.current.error(getApiErrorMessage(err, 'Không thể tải danh sách hợp đồng.'));
      } finally {
        if (current === sequence.current.value) setLoading(false);
      }
    },
    [page, perspective, kind]
  );

  useEffect(() => {
    const counter = sequence.current;
    void load();
    return () => {
      ++counter.value;
    };
  }, [load]);
  useVisiblePoll(() => load(true), 30_000);

  const counts: Record<Group, number> = {
    ALL: items.length,
    MINE: 0,
    WAITING: 0,
    RUNNING: 0,
    ENDED: 0,
  };
  for (const c of items) counts[groupOf(turnOf(c, perspective))]++;
  const shown =
    group === 'ALL' ? items : items.filter((c) => groupOf(turnOf(c, perspective)) === group);
  const rule = emptyRule[perspective];

  const chip = (id: Group, label: string, onPress: () => void) => (
    <Pressable
      key={id}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: group === id }}
      className={`min-h-11 justify-center rounded-full border px-4 ${group === id ? 'border-primary bg-brand' : 'border-border bg-surface'}`}>
      <Text
        className={`text-sm font-semibold ${group === id ? 'text-on-brand' : 'text-muted-foreground'}`}>
        {label} ({counts[id]})
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader
        title={perspective === 'landlord' ? 'Hợp đồng cho thuê' : 'Hợp đồng đi thuê'}
        onBack={onBack}
      />
      <ScrollView contentContainerClassName="gap-3 px-4 pb-8 pt-3">
        <View className="flex-row items-center gap-3">
          <Text className="flex-1 text-sm leading-5 text-muted-foreground">
            {perspective === 'landlord'
              ? 'Ký và theo dõi hợp đồng cọc, hợp đồng thuê của các hồ sơ cho thuê.'
              : 'Xem và ký hợp đồng cọc giữ phòng, hợp đồng thuê của bạn.'}
          </Text>
          <Pressable
            onPress={() => void load()}
            accessibilityRole="button"
            className="min-h-11 flex-row items-center gap-1.5 rounded-xl border border-border bg-surface px-3 active:bg-muted">
            <Icon name="refresh" size={16} className="text-foreground" />
            <Text className="text-sm font-semibold text-foreground">Làm mới</Text>
          </Pressable>
        </View>

        <View
          accessibilityRole="tablist"
          accessibilityLabel="Loại hợp đồng"
          className="flex-row gap-2 rounded-2xl border border-border bg-surface p-1.5">
          {(['LEASE', 'DEPOSIT'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setPage(1);
                setGroup('ALL');
                onNavigate(
                  { screen: 'contract-list', side: perspective, kind: option },
                  { replace: true }
                );
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === option }}
              className={`min-h-11 flex-1 items-center justify-center rounded-xl px-3 ${kind === option ? 'bg-brand' : ''}`}>
              <Text
                className={`text-sm font-semibold ${kind === option ? 'text-on-brand' : 'text-muted-foreground'}`}>
                {option === 'DEPOSIT' ? 'Hợp đồng cọc' : 'Hợp đồng thuê'}
              </Text>
            </Pressable>
          ))}
        </View>
        {kind === 'DEPOSIT' ? (
          <PolicyNotice
            tone="neutral"
            title="Hợp đồng cọc"
            summary="Ký cọc, theo dõi hạn vào ở và thanh toán tháng đầu tại đây.">
            <Text className="text-sm leading-6 text-secondary">
              Xem và ký cọc, theo dõi hạn vào ở, thanh toán tháng đầu và xử lý hồ sơ giữ phòng tại
              đây. Sau khi ký cọc, bạn cần hoàn tất nghĩa vụ đúng hạn.
            </Text>
          </PolicyNotice>
        ) : null}

        <View accessibilityLabel="Nhóm hợp đồng" className="flex-row flex-wrap gap-2">
          {chip('ALL', 'Tất cả', () => {
            setPage(1);
            setGroup('ALL');
          })}
          {GROUPS.map((g) => chip(g.id, g.label(kind), () => setGroup(g.id)))}
        </View>
        <Text className="text-xs leading-5 text-muted-foreground">
          Số lượng tính trên các hợp đồng đang hiển thị ở trang này.
        </Text>

        {loading ? (
          <View accessibilityState={{ busy: true }} className="gap-3">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-40 w-full rounded-2xl" />
            ))}
            <Text className="text-center text-sm text-muted-foreground">Đang tải…</Text>
          </View>
        ) : items.length === 0 ? (
          <EmptyBlock
            title={kind === 'DEPOSIT' ? 'Chưa có hợp đồng cọc' : 'Chưa có hợp đồng thuê'}
            icon="document-text-outline"
            action={
              <View className="self-stretch">
                <PolicyNotice
                  tone="neutral"
                  title="Khi nào xuất hiện hợp đồng?"
                  actionLabel="Xem quy tắc"
                  summary={rule.summary}>
                  <Text className="text-sm leading-6 text-secondary">{rule.detail}</Text>
                </PolicyNotice>
                <View className="items-center">
                  <LinkText
                    label={rule.link}
                    onPress={() => onNavigate({ screen: 'rental-requests', mode: rule.mode })}
                  />
                </View>
              </View>
            }
          />
        ) : (
          <>
            {shown.length === 0 ? (
              <View className="items-center rounded-2xl border border-dashed border-border-strong bg-surface p-5">
                <Text className="text-center text-sm text-muted-foreground">
                  Không có hợp đồng thuộc nhóm này ở trang hiện tại.
                </Text>
                <LinkText label="Xem tất cả" onPress={() => setGroup('ALL')} />
              </View>
            ) : null}
            {shown.map((c) => (
              <ContractCard key={c.id} c={c} perspective={perspective} onNavigate={onNavigate} />
            ))}
            {totalPages > 1 ? (
              <View className="flex-row items-center justify-end gap-3 pt-1">
                <Pager
                  label="Trang trước"
                  icon="chevron-back"
                  disabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                />
                <Text className="text-sm text-foreground">
                  {page}/{totalPages}
                </Text>
                <Pager
                  label="Trang sau"
                  icon="chevron-forward"
                  disabled={page >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
