import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ScreenHeader } from '@/components/Screen';

export type ChatCallRoomProps = {
  call: { conversationId: string; callId: string; mode: 'voice' | 'video' };
  participantName: string;
  onEnd: () => void;
};

export default function ChatCallRoom({ onEnd }: ChatCallRoomProps) {
  return (
    <Modal onRequestClose={onEnd}>
      <SafeAreaView className="flex-1 bg-background">
        <ScreenHeader title="Cuộc gọi" onBack={onEnd} />
        <View className="p-5">
          <Text className="text-foreground">Hãy mở ứng dụng HomeSpace trên điện thoại hoặc dùng website HomeSpace để gọi.</Text>
          <Button label="Đóng" onPress={onEnd} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
