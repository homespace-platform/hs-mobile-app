// Rental flow navigator. Like App.tsx: state + conditional rendering. The stack lives in App so it
// survives a detour to the listing page. Only the top screen is mounted; Android back belongs to
// that screen's ScreenHeader, so a screen with unsaved input can ask before calling onBack.
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingBlock } from '@/components/rental/shared/StateBlocks';
import { Button, ScreenHeader } from '@/components/Screen';
import {
  backStack,
  contractQueryOf,
  navigateStack,
  normalizeRentalRoute,
  routeKey,
  stackSide,
  type RentalNavigate,
  type RentalRoute,
  type RentalScreenNavProps,
} from '@/lib/rental-nav/routes';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import ComplaintScreen from '@/screens/rental/ComplaintScreen';
import ContractDetailScreen from '@/screens/rental/ContractDetailScreen';
import ContractLandingScreen from '@/screens/rental/ContractLandingScreen';
import ContractListScreen from '@/screens/rental/ContractListScreen';
import PaymentHistoryScreen from '@/screens/rental/PaymentHistoryScreen';
import PaymentLinkScreen from '@/screens/rental/PaymentLinkScreen';
import RentalRequestsScreen from '@/screens/rental/RentalRequestsScreen';
import ReservationWorkspaceScreen from '@/screens/rental/ReservationWorkspaceScreen';

/** Web legacy /dashboard/invoices/<contractId> page. */
function InvoiceRedirect({
  route,
  onBack,
  onNavigate,
}: RentalScreenNavProps & { route: RentalRoute }) {
  // Once per mount: a second replace would drop the screen below.
  const go = useRef(() => onNavigate(normalizeRentalRoute(route), { replace: true }));
  useEffect(() => go.current(), []);
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="HomeSpace" onBack={onBack} />
      <LoadingBlock label="Đang mở thanh toán & hóa đơn…" />
    </SafeAreaView>
  );
}

type ExternalProps = {
  /** "Xem bài đăng" of a rental record: open it with the viewer's identity; Back returns here. */
  onOpenListing: (listingId: string) => void;
  onBrowseListings: () => void;
};

function renderRoute(
  route: RentalRoute,
  nav: RentalScreenNavProps,
  external: ExternalProps,
  /** The caller's side (see stackSide). */
  callerSide: DashboardRole
) {
  switch (route.screen) {
    case 'rental-requests':
      return (
        <RentalRequestsScreen
          {...nav}
          {...external}
          mode={route.mode}
          requestId={route.requestId}
          invalidLink={route.invalidLink}
        />
      );
    case 'contract-list':
      return <ContractListScreen {...nav} perspective={route.side} kind={route.kind ?? 'LEASE'} />;
    case 'contract-detail':
      return (
        <ContractDetailScreen
          {...nav}
          {...contractQueryOf(route)}
          perspective={route.side}
          contractId={route.contractId}
        />
      );
    case 'contract-landing':
      return (
        <ContractLandingScreen
          {...nav}
          side={callerSide}
          contractId={route.contractId}
          query={contractQueryOf(route)}
        />
      );
    case 'reservation':
      return (
        <ReservationWorkspaceScreen {...nav} perspective={route.side} rentalId={route.rentalId} />
      );
    case 'payment-history':
      return <PaymentHistoryScreen {...nav} role={route.side} contractId={route.contractId} />;
    case 'complaint':
      return (
        <ComplaintScreen
          {...nav}
          rentalRequestId={route.requestId}
          initialComplaintId={route.complaintId}
        />
      );
    case 'payment-lookup':
      return <PaymentLinkScreen {...nav} paymentId={route.paymentId} />;
    case 'link-error': {
      const side = route.contractListSide;
      return (
        <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
          <ScreenHeader title="HomeSpace" onBack={nav.onBack} />
          <View className="gap-4 px-5 pt-6">
            <Text accessibilityRole="alert" className="text-foreground">
              {route.message}
            </Text>
            {side ? (
              <Button
                label="Về danh sách hợp đồng"
                onPress={() => nav.onNavigate({ screen: 'contract-list', side }, { replace: true })}
              />
            ) : null}
          </View>
        </SafeAreaView>
      );
    }
    case 'invoice-landing':
      return <InvoiceRedirect {...nav} route={route} />;
  }
}

export default function RentalNavigator({
  stack,
  onStackChange,
  role,
  onExit,
  ...external
}: ExternalProps & {
  /** Back on the first screen, when it must lead elsewhere than an empty stack does. */
  onExit?: () => void;
  /** The role selected in Quản lý. */
  role: DashboardRole;
  /** Not empty. */
  stack: RentalRoute[];
  onStackChange: Dispatch<SetStateAction<RentalRoute[]>>;
}) {
  // A ref keeps onBack stable while the caller passes a new onExit on every render.
  const exit = useRef(onExit);
  useEffect(() => {
    exit.current = onExit;
  });
  const depth = stack.length;
  const onBack = useCallback(() => {
    if (depth === 1 && exit.current) exit.current();
    else onStackChange(backStack);
  }, [onStackChange, depth]);
  const onNavigate = useCallback<RentalNavigate>(
    (route, options) =>
      onStackChange((current) => navigateStack(current, route, { ...options, role })),
    [onStackChange, role]
  );
  const route = stack[stack.length - 1];
  return (
    <View key={`${stack.length}:${routeKey(route)}`} className="flex-1">
      {renderRoute(route, { onBack, onNavigate }, external, stackSide(stack.slice(0, -1), role))}
    </View>
  );
}
