import { ActivityIndicator, Text, View } from 'react-native';

export default function LoadingScreen({ message = 'Đang tải...' }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator size="large" color="#0f766e" />
      <Text className="mt-3 text-sm text-slate-500">{message}</Text>
    </View>
  );
}
