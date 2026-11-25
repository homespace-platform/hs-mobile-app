// Web: components/contract/page/ContractPage.tsx. The screen owns the ScrollView; this draws the
// header, the next step, the tab bar and the open tab. Draft form state lives in the screen, so no
// hidden tab needs to stay mounted (web keepMounted).
import { useEffect, useMemo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import Badge from '@/components/rental/shared/Badge';
import DetailTabs, { type TabItem } from '@/components/rental/shared/DetailTabs';
import NextActionCard, { type CardAction } from '@/components/rental/shared/NextActionCard';
import { Skeleton } from '@/components/rental/shared/StateBlocks';
import { contractDetailPath } from '@/lib/rental/contract-routes';
import { POST_ACTIVE } from '@/lib/rental/ContractDetailView';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { deriveNextStep, type NextStep, type StepLink } from '@/lib/rental/nextStep';
import { PageDataContext } from '@/lib/rental/pageData';
import { paymentModulePath, paymentQuery } from '@/lib/rental/payment-module';
import {
  DETAIL_TABS,
  describeNextAction,
  type DetailTab,
  type Role,
} from '@/lib/rental/rental-labels';
import type { RentalNavigate, RentalRoute } from '@/lib/rental-nav/routes';
import { contractLifecycleService } from '@/services/rental/contract-lifecycle.service';
import type { NextAction } from '@/services/rental/rental-onboarding.service';
import type { ContractResponse } from '@/types/rental/contract.type';

import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { pageStep, stepButtons } from './contractDetailLogic';
import { usePolledRead } from './pageHooks';

type Props = {
  perspective: DashboardRole;
  role: Role;
  actorId: string;
  contract: ContractResponse;
  /** Pre-tenancy: the next step comes from the server. Otherwise it is derived from page data. */
  preActive: boolean;
  nextAction: NextAction | null;
  onboardingMessage?: string | null;
  onboardingLoaded: boolean;
  onboardingError?: boolean;
  onRetryOnboarding?: () => void;
  tab: DetailTab;
  setTab: (tab: DetailTab) => void;
  /** Switch tab, then scroll to an anchor of it. */
  goTo: (tab: DetailTab, anchorId: string) => void;
  available: DetailTab[];
  /** Bumped after a panel changed something, so the derived next step reloads. */
  syncTick: number;
  header: ReactNode;
  panels: Partial<Record<DetailTab, ReactNode>>;
  onNavigate: RentalNavigate;
};

function StepExtra({ step }: { step: NextStep }) {
  return (
    <View className="gap-2">
      {step.hint ? (
        <Text className="text-sm leading-6 text-muted-foreground">{step.hint}</Text>
      ) : null}
      <Badge tone={step.mine ? (step.tone === 'danger' ? 'danger' : 'info') : 'warning'}>
        {step.mine ? 'Đến lượt bạn' : 'Đang chờ bên còn lại'}
      </Badge>
    </View>
  );
}

export default function ContractPage({
  perspective,
  role,
  actorId,
  contract,
  preActive,
  nextAction,
  onboardingMessage,
  onboardingLoaded,
  onboardingError,
  onRetryOnboarding,
  tab,
  setTab,
  goTo,
  available,
  syncTick,
  header,
  panels,
  onNavigate,
}: Props) {
  const workspace = useAmendmentWorkspace();
  const root = !preActive && !contract.parentContractId && POST_ACTIVE.includes(contract.status);
  const lifecycle = usePolledRead(
    () => contractLifecycleService.get(contract.id),
    contract.id,
    root
  );
  const reloadLifecycle = lifecycle.reload;
  useEffect(() => {
    if (syncTick > 0 && root) void reloadLifecycle();
  }, [syncTick, root, reloadLifecycle]);

  const active = available.includes(tab) ? tab : 'overview';

  // Editing an amendment happens inline in the contract terms, so bring the viewer there.
  const editing = Boolean(workspace?.editing);
  useEffect(() => {
    if (editing && tab !== 'content') setTab('content');
  }, [editing, tab, setTab]);

  const step = useMemo(
    () =>
      preActive
        ? null
        : deriveNextStep({
            role,
            actorId,
            contract,
            lifecycle: lifecycle.data,
            proposals: workspace?.data?.proposals,
          }),
    [preActive, role, actorId, contract, lifecycle.data, workspace?.data?.proposals]
  );
  const view = preActive ? describeNextAction(nextAction, role) : null;
  const badgeTab: DetailTab | undefined = view?.mine ? view.tab : step?.mine ? step.tab : undefined;

  const tabs: TabItem<DetailTab>[] = DETAIL_TABS.map((t) => ({
    ...t,
    hidden: !available.includes(t.id),
    badge: t.id === badgeTab && t.id !== active ? '1' : undefined,
  }));

  // Rent invoices are in this lease's payment tab; deposit steps go through the landing, which opens
  // the deposit agreement.
  const linkRoute = (link: StepLink): RentalRoute =>
    link.kind !== 'invoices'
      ? contractDetailPath(perspective, link.id)
      : link.section === 'monthly'
        ? {
            ...contractDetailPath(perspective, contract.id),
            ...paymentQuery('monthly', link.invoiceId),
          }
        : paymentModulePath(contract.id, 'deposit');
  // Same page: only tab/section/invoice change, so replace keeps the mounted screen.
  const open = (route: RentalRoute) =>
    onNavigate(route, {
      replace: route.screen === 'contract-detail' && route.contractId === contract.id,
    });

  const buttons = stepButtons({ view, step, active });
  const toAction = (
    button: NonNullable<ReturnType<typeof stepButtons>['primary']>
  ): CardAction => ({
    label: button.label,
    link: Boolean(button.link),
    onClick: () => (button.link ? open(linkRoute(button.link)) : setTab(button.tab!)),
  });
  const primary = buttons.primary ? toAction(buttons.primary) : undefined;
  const secondary = buttons.secondary.map(toAction);

  const kind = pageStep(preActive, onboardingLoaded, Boolean(onboardingError), Boolean(step));
  const card =
    kind === 'server' ? (
      <NextActionCard
        role={role}
        nextAction={nextAction}
        fallbackMessage={onboardingMessage}
        primary={primary}
        secondary={[]}
      />
    ) : kind === 'error' ? (
      <View
        accessibilityRole="alert"
        className="gap-3 rounded-2xl border border-border bg-surface p-4">
        <Text className="text-sm text-foreground">Chưa tải được bước tiếp theo của hồ sơ.</Text>
        <ActionButton label="Thử lại" variant="secondary" onClick={onRetryOnboarding} />
      </View>
    ) : kind === 'loading' ? (
      <View accessible accessibilityLabel="Đang kiểm tra bước tiếp theo">
        <Skeleton className="h-24 w-full rounded-2xl" />
      </View>
    ) : kind === 'derived' && step ? (
      <NextActionCard
        role={role}
        custom={{ title: step.title, hint: step.hint, mine: step.mine, tone: step.tone }}
        extra={<StepExtra step={step} />}
        primary={primary}
        secondary={secondary}
      />
    ) : null;

  const pageData = useMemo(
    () => ({ lifecycle: lifecycle.data, setTab, goTo, available }),
    [lifecycle.data, setTab, goTo, available]
  );

  return (
    <PageDataContext.Provider value={pageData}>
      <View className="gap-4">
        {header}
        {root && lifecycle.error ? (
          <View
            accessibilityRole="alert"
            className="gap-3 rounded-2xl border border-warning bg-warning-soft p-3">
            <Text className="text-sm leading-6 text-warning">
              Chưa cập nhật được tiến trình hợp đồng. Bước tiếp theo đang hiển thị có thể chưa mới
              nhất.
            </Text>
            <ActionButton
              label="Tải lại"
              variant="secondary"
              onClick={() => void reloadLifecycle()}
            />
          </View>
        ) : null}
        {card}
        <DetailTabs tabs={tabs} active={active} onChange={setTab} idPrefix="contract" />
        <View key={active} className="gap-4">
          {panels[active]}
        </View>
      </View>
    </PageDataContext.Provider>
  );
}
