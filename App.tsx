import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import LoadingScreen from '@/screens/LoadingScreen';
import LoginScreen from '@/screens/LoginScreen';
import ProfileScreen from '@/screens/ProfileScreen';

function AuthGate() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen message="Đang khởi tạo phiên đăng nhập..." />;
  }

  return status === 'signedIn' ? <ProfileScreen /> : <LoginScreen />;
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
