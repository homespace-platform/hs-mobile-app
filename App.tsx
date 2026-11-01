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
import RegisterScreen from '@/screens/RegisterScreen';
import ManagementScreen from '@/screens/ManagementScreen';
import ConversationDetailScreen from '@/screens/ConversationDetailScreen';
import HomeScreen from '@/screens/HomeScreen';
import ListingDetailScreen from '@/screens/ListingDetailScreen';
import MessagesScreen from '@/screens/MessagesScreen';
import NewsScreen from '@/screens/NewsScreen';
import SearchScreen from '@/screens/SearchScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import ListingCollectionScreen from '@/screens/ListingCollectionScreen';
import type { ManagementSection } from '@/services/managementApi';

function SignedInApp() {
  const [screen, setScreen] = useState<
    MainTab | 'detail' | 'conversation-detail' | 'favorites' | 'browse' | 'news'
  >('home');
  const [returnScreen, setReturnScreen] = useState<MainTab | 'favorites' | 'browse' | 'news'>(
    'home'
  );
  const [ownListing, setOwnListing] = useState(false);
  const [managementSection, setManagementSection] = useState<ManagementSection | null>(null);
  const [managementOrigin, setManagementOrigin] = useState<'profile' | 'detail' | null>(null);
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

  const openListing = (id: string, own = false, section?: ManagementSection) => {
    if (screen !== 'detail' && screen !== 'conversation-detail') setReturnScreen(screen);
    setOwnListing(own);
    setListingId(id);
    setScreen('detail');
    if (section) setManagementSection(section);
  };
  const openManagement = (section: ManagementSection) => {
    setManagementSection(section);
    setManagementOrigin(screen === 'profile' || screen === 'detail' ? screen : null);
    setScreen('management');
  };
  const browse = (nextFilters: Record<string, string | number>) => {
    setFilters(nextFilters);
    setScreen('browse');
  };

  if (screen === 'favorites' || screen === 'browse')
    return (
      <ListingCollectionScreen
        favorites={screen === 'favorites'}
        filters={filters}
        onBack={() => setScreen(screen === 'favorites' ? 'profile' : 'home')}
        onOpenListing={openListing}
      />
    );

  if (screen === 'detail' && listingId) {
    return (
      <ListingDetailScreen
        listingId={listingId}
        own={ownListing}
        onBack={() => setScreen(returnScreen)}
        onOpenManagement={openManagement}
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
        onOpenFavorites={() => setScreen('favorites')}
      />
    );
  }

  return (
    <HomeScreen
      onSelectTab={selectTab}
      onOpenListing={openListing}
      onBrowse={browse}
      onOpenNews={() => setScreen('news')}
    />
  );
}

function SignedOutApp() {
  const [registering, setRegistering] = useState(false);
  return registering ? (
    <RegisterScreen onBack={() => setRegistering(false)} />
  ) : (
    <LoginScreen onRegister={() => setRegistering(true)} />
  );
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
