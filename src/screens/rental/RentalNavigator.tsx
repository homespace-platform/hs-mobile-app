// Rental flow navigator. Like App.tsx: state + conditional rendering. The stack lives in App so it
// survives a detour to the listing page. Only the top screen is mounted; Android back belongs to
// that screen's ScreenHeader, so a screen with unsaved input can ask before calling onBack.
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ScreenHeader } from '@/components/Screen';
import {
  backStack,
  contractQueryOf,
  navigateStack,
  routeKey,
  type RentalNavigate,
  type RentalRoute,
  type RentalScreenNavProps,
} from '@/lib/rental-nav/routes';
import ComplaintScreen from '@/screens/rental/ComplaintScreen';
import ContractDetailScreen from '@/screens/rental/ContractDetailScreen';
import ContractLandingScreen from '@/screens/rental/ContractLandingScreen';
import ContractListScreen from '@/screens/rental/ContractListScreen';
import PaymentHistoryScreen from '@/screens/rental/PaymentHistoryScreen';
import PaymentLinkScreen from '@/screens/rental/PaymentLinkScreen';
import RentalRequestsScreen from '@/screens/rental/RentalRequestsScreen';
import ReservationWorkspaceScreen from '@/screens/rental/ReservationWorkspaceScreen';

type ExternalProps = {
  onOpenListing: (listingId: string) => void;
  onBrowseListings: () => void;
};

function renderRoute(route: RentalRoute, nav: RentalScreenNavProps, external: ExternalProps) {
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
      return null; // navigateStack never stores it (normalizeRentalRoute).
  }
}

export default function RentalNavigator({
  stack,
  onStackChange,
  ...external
}: ExternalProps & {
  /** Not empty. */
  stack: RentalRoute[];
  onStackChange: Dispatch<SetStateAction<RentalRoute[]>>;
}) {
  const onBack = useCallback(() => onStackChange(backStack), [onStackChange]);
  const onNavigate = useCallback<RentalNavigate>(
    (route, options) => onStackChange((current) => navigateStack(current, route, options)),
    [onStackChange]
  );
  const route = stack[stack.length - 1];
  return (
    <View key={`${stack.length}:${routeKey(route)}`} className="flex-1">
      {renderRoute(route, { onBack, onNavigate }, external)}
    </View>
  );
}
