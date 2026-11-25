import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { DialogProvider } from '@/components/AppDialog';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import type { MainTab } from '@/components/BottomTabBar';
import type { ChatConversation } from '@/services/chatApi';
import LoadingScreen from '@/screens/LoadingScreen';
import LoginScreen from '@/screens/LoginScreen';
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
import type { ManagementSection } from '@/services/managementApi';
import { usePushEvents } from '@/lib/push/use-push-events';
import { useRealtimeConnections } from '@/lib/realtime/connections';

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
  const [favoritesOrigin, setFavoritesOrigin] = useState<'home' | 'profile'>('profile');
  const [ownListing, setOwnListing] = useState(false);
  const [managementSection, setManagementSection] = useState<ManagementSection | null>(null);
  const [managementOrigin, setManagementOrigin] = useState<
    'profile' | 'detail' | 'notifications' | null
  >(null);
  const [filters, setFilters] = useState<Record<string, string | number>>({});
  const [listingId, setListingId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ChatConversation | null>(null);
  const selectTab = (tab: MainTab) => {
    setConversationId(null);
    setScreen(tab);
    if (tab === 'management') {
      setManagementSection(null);
      setManagementOrigin(null);
    }
  };

  useRealtimeConnections();
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
  const openManagement = (section: ManagementSection) => {
    setManagementSection(section);
    setManagementOrigin(
      screen === 'profile' || screen === 'detail' || screen === 'notifications' ? screen : null
    );
    setScreen('management');
  };
  const browse = (nextFilters: Record<string, string | number>) => {
    setFilters(nextFilters);
    setScreen('browse');
  };

  if (screen === 'favorites' || screen === 'history' || screen === 'browse')
    return (
      <ListingCollectionScreen
        mode={screen}
        filters={filters}
        onBack={() => setScreen(screen === 'favorites' ? favoritesOrigin : 'home')}
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
        onOpenMessages={(id) => {
          setConversationId(id);
          setScreen('messages');
        }}
      />
    );
  }

  if (screen === 'messages') {
    return (
      <MessagesScreen
        initialConversationId={conversationId}
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
    return <SearchScreen onSelectTab={selectTab} onOpenListing={openListing} />;
  }

  if (screen === 'management') {
    return (
      <ManagementScreen
        key={managementSection ?? 'root'}
        onSelectTab={selectTab}
        onOpenListing={openListing}
        initialSection={managementSection}
        onExit={
          managementOrigin
            ? () => {
                setManagementSection(null);
                setScreen(managementOrigin);
                setManagementOrigin(null);
              }
            : undefined
        }
      />
    );
  }

  if (screen === 'profile') {
    return (
      <ProfileScreen
        onSelectTab={selectTab}
        onOpenManagement={openManagement}
        onOpenFavorites={() => {
          setFavoritesOrigin('profile');
          setScreen('favorites');
        }}
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
      onOpenFavorites={() => {
        setFavoritesOrigin('home');
        setScreen('favorites');
      }}
      onOpenHistory={() => setScreen('history')}
    />
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

  return status === 'signedIn' ? <SignedInApp /> : <SignedOutApp />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DialogProvider>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
