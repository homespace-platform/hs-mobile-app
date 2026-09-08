import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import LoadingScreen from '@/screens/LoadingScreen';
import LoginScreen from '@/screens/LoginScreen';
import HomeScreen from '@/screens/HomeScreen';
import ListingDetailScreen from '@/screens/ListingDetailScreen';
import MessagesScreen from '@/screens/MessagesScreen';
import NewsScreen from '@/screens/NewsScreen';
import ProfileScreen from '@/screens/ProfileScreen';

function SignedInApp() {
  const [screen, setScreen] = useState<'home' | 'news' | 'messages' | 'profile' | 'detail'>('home');
  const [listingId, setListingId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

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
        onSelectTab={(tab) => setScreen(tab)}
      />
    );
  }

  if (screen === 'news') {
    return <NewsScreen onSelectTab={(tab) => setScreen(tab)} />;
  }

  if (screen === 'profile') {
    return <ProfileScreen onSelectTab={(tab) => setScreen(tab)} />;
  }

  return (
    <HomeScreen
      onSelectTab={(tab) => setScreen(tab)}
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
