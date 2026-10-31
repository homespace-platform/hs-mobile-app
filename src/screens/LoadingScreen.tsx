import { ActivityIndicator, Text, View } from 'react-native';

export default function LoadingScreen({ message = 'Đang tải...' }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" className="text-primary" />
      <Text className="mt-3 text-sm text-muted-foreground">{message}</Text>
    </View>
  );
}
