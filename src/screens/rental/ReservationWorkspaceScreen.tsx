// Web: components/contract/RentalReservationWorkspace.tsx. Also usable before a deposit PDF exists,
// including missing templates and zero-deposit rentals.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Icon from '@/components/Icon';
import RentalOnboardingPanel from '@/components/rental/onboarding/RentalOnboardingPanel';
import { Card } from '@/components/rental/shared/Card';
import NextActionCard from '@/components/rental/shared/NextActionCard';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { ScreenHeader } from '@/components/Screen';
import type { DashboardRole } from '@/lib/rental/dashboard-role';
import { describeNextAction } from '@/lib/rental/rental-labels';
import { readOnboarding } from '@/lib/rental/rental-onboarding-read';
import type { RentalScreenNavProps } from '@/lib/rental-nav/routes';
import type { RentalOnboarding } from '@/services/rental/rental-onboarding.service';

export type ReservationWorkspaceScreenProps = RentalScreenNavProps & {
  perspective: DashboardRole;
  rentalId: string;
};

export default function ReservationWorkspaceScreen(props: ReservationWorkspaceScreenProps) {
  return <Workspace key={props.rentalId} {...props} />;
}

function Workspace({ perspective, rentalId, onBack, onNavigate }: ReservationWorkspaceScreenProps) {
  const [view, setView] = useState<RentalOnboarding | null>(null);
  const scroll = useRef<ScrollView>(null);
  const panelY = useRef(0);
  const alive = useRef(true);
  // Read-only.
  const load = useCallback(async () => {
    if (!rentalId) return;
    try {
      const next = await readOnboarding(rentalId);
      if (alive.current) setView(next);
    } catch {
      // The panel below shows the load error; the card simply stays hidden.
    }
  }, [rentalId]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const role = perspective === 'tenant' ? 'TENANT' : 'LANDLORD';
  const next = describeNextAction(view?.nextAction, role);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Hồ sơ cọc & nhận nhà" onBack={onBack} />
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerClassName="gap-4 px-4 pb-8 pt-2">
        <Pressable
          onPress={() =>
            onNavigate(
              { screen: 'contract-list', side: perspective, kind: 'DEPOSIT' },
              { replace: true }
            )
          }
          accessibilityRole="link"
          className="min-h-11 flex-row items-center gap-1 self-start">
          <Icon name="chevron-back" size={16} className="text-primary" />
          <Text className="text-sm font-semibold text-primary">
            Hợp đồng {perspective === 'tenant' ? 'đi thuê' : 'cho thuê'}
          </Text>
        </Pressable>
        <Card>
          <PolicyNotice
            tone="neutral"
            title="Hồ sơ cọc & nhận nhà"
            summary="Theo dõi khoản cọc, ký hợp đồng và hoàn tất thanh toán trước khi nhận nhà.">
            <Text className="text-sm leading-6 text-secondary">
              Theo dõi khoản cọc, ký hợp đồng và hoàn tất thanh toán trước khi nhận nhà. Hồ sơ không
              đặt cọc sẽ bỏ qua bước ký cọc.
            </Text>
          </PolicyNotice>
        </Card>
        {view ? (
          <NextActionCard
            role={role}
            nextAction={view.nextAction}
            fallbackMessage={view.message}
            primary={
              next?.mine
                ? {
                    label: 'Xử lý ngay',
                    link: true,
                    onClick: () => scroll.current?.scrollTo({ y: panelY.current, animated: true }),
                  }
                : undefined
            }
          />
        ) : null}
        <View
          onLayout={(event) => {
            panelY.current = event.nativeEvent.layout.y;
          }}>
          {rentalId ? (
            <RentalOnboardingPanel
              rentalRequestId={rentalId}
              isLandlord={perspective === 'landlord'}
              onSnapshot={setView}
              onUpdated={load}
              onNavigate={onNavigate}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
