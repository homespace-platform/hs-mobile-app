import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import type { ChatConversation } from '@/services/chatApi';
import LoadingScreen from '@/screens/LoadingScreen';
import LoginScreen from '@/screens/LoginScreen';
import ConversationDetailScreen from '@/screens/ConversationDetailScreen';
import HomeScreen from '@/screens/HomeScreen';
import ListingDetailScreen from '@/screens/ListingDetailScreen';
import MessagesScreen from '@/screens/MessagesScreen';
import NewsScreen from '@/screens/NewsScreen';
import ProfileScreen from '@/screens/ProfileScreen';

function SignedInApp() {
  const [screen, setScreen] = useState<
    'home' | 'news' | 'messages' | 'profile' | 'detail' | 'conversation-detail'
  >('home');
  const [listingId, setListingId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationDetail, setConversationDetail] = useState<ChatConversation | null>(null);
  const selectTab = (tab: 'home' | 'news' | 'messages' | 'profile') => {
    setConversationId(null);
    setScreen(tab);
  };

  if (screen === 'detail' && listingId) {
    return (
      <ListingDetailScreen
        listingId={listingId}
        onBack={() => setScreen('home')}
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
    return <NewsScreen onSelectTab={selectTab} />;
  }

  if (screen === 'profile') {
    return <ProfileScreen onSelectTab={selectTab} />;
  }

  return (
    <HomeScreen
      onSelectTab={selectTab}
      onOpenListing={(id) => {
        setListingId(id);
        setScreen('detail');
      }}
    />
  );
}

function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen message="Đang khởi tạo phiên đăng nhập..." />;
  }

  return status === 'signedIn' ? <SignedInApp /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
