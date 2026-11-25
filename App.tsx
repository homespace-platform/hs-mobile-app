import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DialogProvider } from '@/components/AppDialog';
import { ChatCallProvider } from '@/components/chat/ChatCallProvider';
import BackendHealthGate from '@/components/BackendHealthGate';
import NetworkGate from '@/components/NetworkGate';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import type { MainTab } from '@/components/BottomTabBar';
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
import type { RentalRoute } from '@/lib/rental-nav/routes';
import type { ManagementRole } from '@/lib/dashboard-navigation';
import type { ManagementSection } from '@/services/managementApi';
import InitialPasswordGate from '@/components/InitialPasswordGate';
import { setOpenSettingsHandler } from '@/lib/profile-gate-signal';
import type { ProfileGateSection } from '@/lib/profile-gate';
import { useOnboardingSync } from '@/lib/use-onboarding';
import { usePushEvents } from '@/lib/push/use-push-events';
import { useKycDeepLink } from '@/lib/kyc/use-kyc-deep-link';

function SignedInApp() {
  const [screen, setScreen] = useState<
    | MainTab
    | 'detail'
    | 'conversation-detail'
    | 'favorites'
    | 'history'
    | 'browse'
    | 'news'
    | 'notifications'
  >('home');
  const [returnScreen, setReturnScreen] = useState<
    MainTab | 'favorites' | 'history' | 'browse' | 'news' | 'notifications'
  >('home');
  const [ownListing, setOwnListing] = useState(false);
  const [managementRole, setManagementRole] = useState<ManagementRole>('tenant');
  const [managementSection, setManagementSection] = useState<ManagementSection | null>(null);
  // Appointment of a tapped notification; the appointments screen opens it and clears it on close.
  const [linkedAppointmentId, setLinkedAppointmentId] = useState<string | null>(null);
  const [managementOrigin, setManagementOrigin] = useState<'detail' | 'notifications' | null>(null);
  // Back stack of the rental flow, shown inside the Quản lý tab while not empty.
  const [rentalStack, setRentalStack] = useState<RentalRoute[]>([]);
  const [filters, setFilters] = useState<Record<string, string | number>>({});
  const [listingId, setListingId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingListing, setPendingListing] = useState<RelatedListing | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ChatConversation | null>(null);
  // Settings section requested from anywhere (banner, 1010 dialog); ProfileScreen opens it and clears it.
  const [pendingSettings, setPendingSettings] = useState<ProfileGateSection | null>(null);
  useEffect(() => {
    setOpenSettingsHandler((section) => {
      setPendingSettings(section);
      setConversationId(null);
      setScreen('profile');
    });
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
    route === 'messages' ? selectTab('messages') : setScreen('notifications')
  );

  const openListing = (id: string, own = false, section?: ManagementSection) => {
    if (screen !== 'detail' && screen !== 'conversation-detail') setReturnScreen(screen);
    setOwnListing(own);
    setListingId(id);
    setScreen('detail');
    if (section) setManagementSection(section);
  };
  const openManagement = (section: ManagementSection, appointmentId?: string) => {
    setRentalStack([]);
    setManagementSection(section);
    setLinkedAppointmentId(appointmentId ?? null);
    setManagementOrigin(screen === 'detail' || screen === 'notifications' ? screen : null);
    setScreen('management');
  };
  const browse = (nextFilters: Record<string, string | number>) => {
    setFilters(nextFilters);
    setScreen('search'); // Home entry points land on the "Tìm nhà" screen with these initial filters
  };

  if (screen === 'favorites' || screen === 'history' || screen === 'browse')
    return (
      <ListingCollectionScreen
        mode={screen}
        filters={filters}
        onBack={() => setScreen('home')}
        onOpenListing={openListing}
        onExplore={() => selectTab('search')}
      />
    );

  if (screen === 'detail' && listingId) {
    return (
      <ListingDetailScreen
        listingId={listingId}
        own={ownListing}
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
    return (
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
      />
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
    return <NewsScreen onBack={() => setScreen('home')} />;
  }

  if (screen === 'notifications') {
    return (
      <NotificationsScreen
        onBack={() => setScreen('home')}
        onOpenListing={openListing}
        onOpenManagement={openManagement}
        onOpenNews={() => setScreen('news')}
      />
    );
  }

  if (screen === 'search') {
    return (
      <SearchScreen onSelectTab={selectTab} onOpenListing={openListing} initialFilters={filters} />
    );
  }

  if (screen === 'management') {
    if (rentalStack.length) {
      return (
        <RentalNavigator
          stack={rentalStack}
          onStackChange={setRentalStack}
          onOpenListing={(id) => openListing(id)}
          onBrowseListings={() => selectTab('search')}
        />
      );
    }
    if (!managementSection) {
      return (
        <ManagementDashboardScreen
          role={managementRole}
          onSelectRole={setManagementRole}
          onOpenAppointments={openManagement}
          onOpenRental={(route) => setRentalStack([route])}
          onSelectTab={selectTab}
        />
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
    return (
      <ProfileScreen
        onSelectTab={selectTab}
        pendingSettings={pendingSettings}
        onSettingsOpened={() => setPendingSettings(null)}
      />
    );
  }

  return (
    <HomeScreen
      onSelectTab={selectTab}
      onOpenListing={openListing}
      onBrowse={browse}
      onOpenNews={() => setScreen('news')}
      onOpenManagement={openManagement}
      onOpenNotifications={() => setScreen('notifications')}
      onOpenFavorites={() => setScreen('favorites')}
      onOpenHistory={() => setScreen('history')}
    />
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
