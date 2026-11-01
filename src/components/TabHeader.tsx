import type { ReactNode } from 'react';
import { Image, Text, View } from 'react-native';

export default function TabHeader({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View className="border-b border-border bg-surface px-5 pb-4 pt-2">
      <Image
        source={require('../../assets/homespace-horizontal-logo.png')}
        resizeMode="contain"
        accessibilityLabel="HomeSpace"
        className="h-10 w-36"
      />
      <View className="mt-2 min-h-8 flex-row items-center justify-between">
        <Text accessibilityRole="header" className="text-2xl font-bold text-foreground">
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}
