// Web: app/dashboard/contracts/[id]/page.tsx (notification landing). The legacy web route
// /dashboard/invoices/<id> is rewritten to this screen by normalizeRentalRoute.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  resolveLanding,
  type LandingResult,
} from '@/components/rental/contract/contractDetailLogic';
import { linkText } from '@/components/rental/contract/fields';
import RentalWorkflowPanel from '@/components/rental/onboarding/RentalWorkflowPanel';
import { useViewer } from '@/components/rental/requests/useViewer';
import ActionButton from '@/components/rental/shared/ActionButton';
import { Card } from '@/components/rental/shared/Card';
import { LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { ScreenHeader } from '@/components/Screen';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  contractDetailPath,
  contractListPath,
  type ContractRouteQuery,
} from '@/lib/rental/contract-routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { safeResourceId } from '@/lib/rental/payment-module';
import { DOCUMENT_NOT_FOUND, type RentalScreenNavProps } from '@/lib/rental-nav/routes';
import { contractService } from '@/services/rental/contract.service';
import { rentalWorkflowService } from '@/services/rental/rental-workflow.service';

export type ContractLandingScreenProps = RentalScreenNavProps & {
  /** The caller's side, else the role selected in Quản lý (web stored dashboard role). */
  side: DashboardRole;
  /** Already passed safeResourceId. */
  contractId: string;
  /** Hand to contractLandingTarget, then onNavigate(target, { replace: true }). */
  query: ContractRouteQuery;
};

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      className="min-h-11 justify-center self-start">
      <Text className={linkText}>{label}</Text>
    </Pressable>
  );
}

function Message({ children }: { children: ReactNode }) {
  return (
    <View accessibilityLiveRegion="polite" className="gap-1">
      <Card className="gap-1">{children}</Card>
    </View>
  );
}

const body = 'text-sm leading-6 text-foreground';

export default function ContractLandingScreen(props: ContractLandingScreenProps) {
  const viewer = useViewer();
  const { login } = useAuth();
  const contractId = safeResourceId(props.contractId);

  const missing = (
    <Message>
      <Text className={body}>{DOCUMENT_NOT_FOUND}</Text>
      <Link
        label="Về danh sách hợp đồng"
        // Web /dashboard/contracts: the stored dashboard role.
        onPress={() => props.onNavigate(contractListPath(props.side), { replace: true })}
      />
    </Message>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Chi tiết hợp đồng" onBack={props.onBack} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-4 px-4 pb-8 pt-3">
        {viewer.failed ? (
          <Card className="gap-3">
            <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
              Đăng nhập để mở văn bản
            </Text>
            <Text className="text-sm text-muted-foreground">
              Văn bản chỉ hiển thị cho các bên của hợp đồng.
            </Text>
            <ActionButton label="Đăng nhập" onClick={() => void login().then(viewer.retry)} />
          </Card>
        ) : !viewer.userId ? (
          <LoadingBlock label="Đang xác thực tài khoản…" />
        ) : !contractId ? (
          missing
        ) : (
          <Landing
            key={`${viewer.userId}:${contractId}`}
            {...props}
            userId={viewer.userId}
            contractId={contractId}
            missing={missing}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Landing({
  userId,
  contractId,
  query,
  onNavigate,
  missing,
}: ContractLandingScreenProps & { userId: string; missing: ReactNode }) {
  const [phase, setPhase] = useState<LandingResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The navigate callback and query object are new on every render; only a retry re-reads.
  const latest = useRef({ query, onNavigate });
  useEffect(() => {
    latest.current = { query, onNavigate };
  });
  useEffect(() => {
    let live = true;
    setPhase(null);
    void resolveLanding(
      { userId, contractId, query: latest.current.query },
      {
        getContract: contractService.getContract,
        earlyExitDocuments: (id) => rentalWorkflowService.documents(id, 'early-exit'),
      }
    ).then((result) => {
      if (!live) return;
      // Keeps the query (?tab=sign|payment|end) so a notification link lands on the exact section.
      if (result.kind === 'redirect') latest.current.onNavigate(result.target, { replace: true });
      else setPhase(result);
    });
    return () => {
      live = false;
    };
  }, [userId, contractId, attempt]);

  if (!phase || phase.kind === 'redirect') return <LoadingBlock label="Đang mở văn bản…" />;
  if (phase.kind === 'retry')
    return (
      <View
        accessibilityRole="alert"
        className="gap-3 rounded-2xl border border-warning bg-warning-soft p-4">
        <Text className="text-sm leading-6 text-warning">
          Chưa kết nối được máy chủ để mở văn bản. Lỗi kết nối không có nghĩa bạn mất quyền xem.
        </Text>
        <ActionButton
          label="Thử lại"
          variant="secondary"
          onClick={() => setAttempt((n) => n + 1)}
        />
      </View>
    );
  if (phase.kind === 'missing') return <>{missing}</>;
  const openRoot = () => onNavigate(contractDetailPath(phase.side, phase.rootId));
  if (phase.earlyExitRentalRequestId)
    return (
      <View className="gap-3">
        <Link label="Mở hợp đồng gốc" onPress={openRoot} />
        <RentalWorkflowPanel
          rentalRequestId={phase.earlyExitRentalRequestId}
          kind="early-exit"
          contractId={phase.rootId}
          agreementId={contractId}
          focusRequest
          onNavigate={onNavigate}
        />
      </View>
    );
  return (
    <Message>
      <Text className={body}>Văn bản này được quản lý cùng hồ sơ của hợp đồng gốc.</Text>
      <Link label="Mở hợp đồng gốc" onPress={openRoot} />
    </Message>
  );
}
