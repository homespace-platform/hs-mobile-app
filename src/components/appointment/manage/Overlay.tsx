import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * An in-screen layer, deliberately not an RN Modal: AppDialog is a Modal at the app root, and a
 * second Modal stacked on an open one may not appear (iOS). The screen's back handler closes it.
 */
export default function Overlay({ children }: { children: ReactNode }) {
  return (
    <View accessibilityViewIsModal className="absolute inset-0 bg-overlay/65">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 items-center justify-center px-3 py-4">
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
