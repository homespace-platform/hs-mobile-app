import { useEffect, useState, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DialogProvider } from '@/components/AppDialog';
import { ChatCallProvider } from '@/components/chat/ChatCallProvider';
import BackendHealthGate from '@/components/BackendHealthGate';
import NetworkGate from '@/components/NetworkGate';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import type { MainTab } from '@/components/BottomTabBar';
import { TabHeaderNavigation, type HeaderShortcut } from '@/components/TabHeader';
import MembershipScreen from '@/components/membership/MembershipScreen';
import type { ChatConversation, RelatedListing } from '@/services/chatApi';
import LoadingScreen from '@/screens/LoadingScreen';
import LoginScreen from '@/screens/LoginScreen';
import ManagementDashboardScreen from '@/screens/ManagementDashboardScreen';
import ManagementScreen from '@/screens/ManagementScreen';
import ConversationDetailScreen from '@/screens/ConversationDetailScreen';
import HomeScreen from '@/screens/HomeScreen';
import ListingDetailScreen from '@/screens/ListingDetailScreen';
import MessagesScreen from '@/screens/MessagesScreen';
import NewsScreen from '@/screens/NewsScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import SearchScreen from '@/screens/SearchScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import ListingCollectionScreen from '@/screens/ListingCollectionScreen';
import RentalNavigator from '@/screens/rental/RentalNavigator';
import { rentalRouteForDestination, type RentalRoute } from '@/lib/rental-nav/routes';
import type { ManagementRole } from '@/lib/dashboard-navigation';
import type { ManagementSection } from '@/services/managementApi';
import InitialPasswordGate from '@/components/InitialPasswordGate';
import { setOpenSettingsHandler } from '@/lib/profile-gate-signal';
import { leaveThen } from '@/lib/leave-guard';
import type { ProfileGateSection } from '@/lib/profile-gate';
import { useOnboardingSync } from '@/lib/use-onboarding';
import { usePushEvents } from '@/lib/push/use-push-events';
import { useKycDeepLink } from '@/lib/kyc/use-kyc-deep-link';

function SignedInApp() {
  const [screen, setScreen] = useState<
    | MainTab
    | 'detail'
    | 'conversation-detail'
    | HeaderShortcut
    | 'browse'
  >('home');
  const [returnScreen, setReturnScreen] = useState<
    MainTab | HeaderShortcut | 'browse'
  >('home');
  const [shortcutReturnTab, setShortcutReturnTab] = useState<MainTab>('home');
  const [ownListing, setOwnListing] = useState(false);
  const [managementRole, setManagementRole] = useState<ManagementRole>('tenant');
  const [managementSection, setManagementSection] = useState<ManagementSection | null>(null);
  // Appointment of a tapped notification; the appointments screen opens it and clears it on close.
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);
  const [managementOrigin, setManagementOrigin] = useState<
    'detail' | 'notifications' | 'membership' | null
  >(null);
  // Back stack of the rental flow, shown inside the Quản lý tab while not empty.
  const [rentalStack, setRentalStack] = useState<RentalRoute[]>([]);
  // Back on the first rental screen returns to the notification center, not the Quản lý menu.
  const [rentalFromNotifications, setRentalFromNotifications] = useState(false);
  const [filters, setFilters] = useState<Record<string, string | number>>({});
  const [listingId, setListingId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingListing, setPendingListing] = useState<RelatedListing | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ChatConversation | null>(null);
  // Settings section requested from anywhere (banner, 1010 dialog); ProfileScreen opens it and clears it.
  const [pendingSettings, setPendingSettings] = useState<ProfileGateSection | null>(null);
  useEffect(() => {
    setOpenSettingsHandler((section) =>
      leaveThen(() => {
        setPendingSettings(section);
        setConversationId(null);
        setScreen('profile');
      })
    );
    return () => setOpenSettingsHandler(undefined);
  }, []);
  const selectTab = (tab: MainTab) => {
    setConversationId(null);
    setPendingListing(null);
    setFilters({}); // a plain tab press opens "Tìm nhà" without Home's initial filters
    setScreen(tab);
    if (tab === 'management') {
      setRentalStack([]);
      setManagementSection(null);
      setManagementOrigin(null);
      setLinkedAppointmentId(null);
    }
  };

  useKycDeepLink();
  // Push taps (also from a killed app): chat opens the Messages tab, everything else the notification center.
  usePushEvents((route) =>
    leaveThen(() => {
      if (route === 'messages') selectTab('messages');
      else {
        setShortcutReturnTab('home');
        setScreen('notifications');
      }
    })
  );

  const openListing = (id: string, own = false, section?: ManagementSection) => {
    if (screen !== 'detail' && screen !== 'conversation-detail') setReturnScreen(screen);
    setOwnListing(own);
    setListingId(id);
    setScreen('detail');
    if (section) setManagementSection(section);
  };
  const openRental = (route: RentalRoute) => {
    setRentalFromNotifications(screen === 'notifications');
    setRentalStack([route]);
    setManagementSection(null);
    setManagementOrigin(null);
    setLinkedAppointmentId(null);
    setScreen('management');
  };
  const openManagement = (section: ManagementSection, appointmentId?: string) => {
    // Requests, contracts and payments have their own screens; ManagementScreen never gets them.
    const rentalRoute = rentalRouteForDestination(section);
    if (rentalRoute) return openRental(rentalRoute);
    // Opened from a listing, the rental flow stays underneath: leaving returns to that listing, and
    // its Back to the request list.
    if (screen !== 'detail') setRentalStack([]);
    setManagementSection(section);
    setLinkedAppointmentId(appointmentId ?? null);
    setManagementOrigin(
      screen === 'detail' || screen === 'notifications' || screen === 'membership' ? screen : null
    );
    setScreen('management');
  };
  const browse = (nextFilters: Record<string, string | number>) => {
    setFilters(nextFilters);
    setScreen('search'); // Home entry points land on the "Tìm nhà" screen with these initial filters
  };
  const closeShortcut = () => setScreen(shortcutReturnTab);
  const withTabHeader = (tab: MainTab, content: ReactNode) => (
    <TabHeaderNavigation.Provider
      value={{
        onSelectTab: (next) => leaveThen(() => selectTab(next)),
        onOpenShortcut: (shortcut) => leaveThen(() => {
          setShortcutReturnTab(tab);
          setScreen(shortcut);
        }),
      }}>
      {content}
    </TabHeaderNavigation.Provider>
  );

  if (screen === 'favorites' || screen === 'history' || screen === 'browse')
    return (
      <ListingCollectionScreen
        mode={screen}
        filters={filters}
        onBack={screen === 'browse' ? () => setScreen('home') : closeShortcut}
        onOpenListing={openListing}
        onExplore={() => selectTab('search')}
      />
    );

  if (screen === 'detail' && listingId) {
    return (
      <ListingDetailScreen
        listingId={listingId}
        own={ownListing}
        onSelectTab={selectTab}
        onBack={() => setScreen(returnScreen)}
        onOpenManagement={openManagement}
        onOpenListing={(id) => openListing(id)}
        onOpenMessages={(id, listing) => {
          setConversationId(id);
          setPendingListing(listing ?? null);
          setScreen('messages');
        }}
      />
    );
  }

  if (screen === 'messages') {
    return withTabHeader(
      'messages',
      <MessagesScreen
        initialConversationId={conversationId}
        pendingListing={pendingListing}
        onPendingListingConsumed={() => setPendingListing(null)}
        onSelectTab={selectTab}
        onOpenConversationDetails={(conversation) => {
          setConversationId(conversation.id);
          setConversationDetail(conversation);
          setScreen('conversation-detail');
        }}
      />,
    );
  }

  if (screen === 'conversation-detail' && conversationDetail) {
    return (
      <ConversationDetailScreen
        conversation={conversationDetail}
        onBack={() => setScreen('messages')}
        onUpdated={setConversationDetail}
      />
    );
  }

  if (screen === 'news') {
    return <NewsScreen onBack={closeShortcut} />;
  }

  if (screen === 'notifications') {
    return (
      <NotificationsScreen
        onBack={closeShortcut}
        onOpenListing={openListing}
        onOpenManagement={openManagement}
        rentalRole={managementRole}
        onOpenRental={openRental}
        onOpenNews={() => setScreen('news')}
      />
    );
  }

  if (screen === 'membership') {
    return (
      <MembershipScreen
        onBack={closeShortcut}
        onManageListings={() => openManagement('landlord-properties')}
      />
    );
  }

  if (screen === 'search') {
    return withTabHeader(
      'search',
      <SearchScreen onSelectTab={selectTab} onOpenListing={openListing} initialFilters={filters} />,
    );
  }

  if (screen === 'management') {
    // A section opened from a listing covers the kept rental flow until it is left.
    if (rentalStack.length && managementOrigin !== 'detail') {
      return (
        <RentalNavigator
          stack={rentalStack}
          onStackChange={setRentalStack}
          role={managementRole}
          onOpenListing={(id) => openListing(id)}
          onBrowseListings={() => selectTab('search')}
          onExit={
            rentalFromNotifications
              ? () => {
                  setRentalStack([]);
                  setScreen('notifications');
                }
              : undefined
          }
        />
      );
    }
    if (!managementSection) {
      return withTabHeader(
        'management',
        <ManagementDashboardScreen
          role={managementRole}
          onSelectRole={setManagementRole}
          onOpenSection={openManagement}
          onOpenRental={openRental}
          onSelectTab={selectTab}
        />,
      );
    }
    return (
      <ManagementScreen
        key={managementSection}
        onSelectTab={selectTab}
        onOpenListing={openListing}
        initialSection={managementSection}
        linkedAppointmentId={linkedAppointmentId}
        onLinkConsumed={() => setLinkedAppointmentId(null)}
        onExit={() => {
          setManagementSection(null);
          if (managementOrigin) setScreen(managementOrigin);
          setManagementOrigin(null);
        }}
      />
    );
  }

  if (screen === 'profile') {
    return withTabHeader(
      'profile',
      <ProfileScreen
        onSelectTab={selectTab}
        pendingSettings={pendingSettings}
        onSettingsOpened={() => setPendingSettings(null)}
      />,
    );
  }

  return withTabHeader(
    'home',
    <HomeScreen
      onSelectTab={selectTab}
      onOpenListing={openListing}
      onBrowse={browse}
      onOpenManagement={openManagement}
    />,
  );
}

function SignedInRoot() {
  useOnboardingSync();
  return (
    <ChatCallProvider>
      <SignedInApp />
      <InitialPasswordGate />
    </ChatCallProvider>
  );
}

function SignedOutApp() {
  return <LoginScreen />;
}

function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen message="Đang khởi tạo phiên đăng nhập..." />;
  }

  return status === 'signedIn' ? <SignedInRoot /> : <SignedOutApp />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DialogProvider>
          <NetworkGate>
            <BackendHealthGate>
              <AuthProvider>
                <AuthGate />
              </AuthProvider>
            </BackendHealthGate>
          </NetworkGate>
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
