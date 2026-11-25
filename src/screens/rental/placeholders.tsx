// Temporary bodies of the Phase 2 stubs. No owner edits this file; Phase 3 deletes it once unused.
import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/Screen';

const PENDING = 'Đang phát triển';

export function BlockPlaceholder({ title }: { title: string }) {
  return (
    <View className="rounded-2xl border border-border bg-surface p-4">
      <Text className="font-bold text-foreground">{title}</Text>
      <Text className="mt-1 text-sm text-muted-foreground">{PENDING}</Text>
    </View>
  );
}

/** ScreenHeader also owns the Android back button: real screens must keep rendering it. */
export function ScreenPlaceholder({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title={title} onBack={onBack} />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center text-muted-foreground">{PENDING}</Text>
      </View>
    </SafeAreaView>
  );
}

export function ModalPlaceholder({
  visible,
  title,
  onClose,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <ScreenPlaceholder title={title} onBack={onClose} /> : null}
    </Modal>
  );
}
