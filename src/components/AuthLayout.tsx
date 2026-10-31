import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="grow justify-center px-6 py-8">
          <View className="w-full max-w-md self-center rounded-3xl border border-border bg-surface p-6">
            <View className="mb-6 rounded-2xl bg-logo p-4">
              <Image
                source={require('../../assets/homespace-horizontal-logo.png')}
                resizeMode="contain"
                className="h-20 w-full"
                accessible
                accessibilityLabel="HomeSpace"
              />
            </View>
            <Text
              accessibilityRole="header"
              className="text-center text-2xl font-bold text-foreground">
              {title}
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
              {subtitle}
            </Text>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
