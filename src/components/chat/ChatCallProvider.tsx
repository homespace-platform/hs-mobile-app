import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { randomUUID } from 'expo-crypto';
import { AppState, Modal, Platform, ScrollView, Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { Button } from '@/components/Screen';
import ChatCallRoom from '@/components/chat/ChatCallRoom';
import { createChatCalls, type ChatCallSession } from '@/lib/realtime/chat-calls';
import {
  emitChatWithAck,
  isChatSocketConnected,
  subscribeChatEvents,
  useRealtimeConnections,
} from '@/lib/realtime/connections';
import { listConversations } from '@/services/chatApi';

const ChatCallContext = createContext<{
  session: ChatCallSession | null;
  startCall: ReturnType<typeof createChatCalls>['start'];
} | null>(null);

export function ChatCallProvider({ children }: { children: ReactNode }) {
  const showDialog = useDialog();
  const [session, setSession] = useState<ChatCallSession | null>(null);
  const [dismissingPrompt, setDismissingPrompt] = useState(false);
  const [calls] = useState(() =>
    createChatCalls({
      emitWithAck: emitChatWithAck,
      isConnected: isChatSocketConnected,
      newCallId: randomUUID,
      async lookupParticipantName(conversationId, callerId) {
        const conversation = (await listConversations()).find(
          (item) => item.id === conversationId && item.participantId === callerId
        );
        return conversation?.participantName || conversation?.participantEmail;
      },
      onChange: setSession,
      onInviteError: (message) => showDialog('Cuộc gọi HomeSpace', message),
    })
  );

  useEffect(() => {
    const unsubscribe = subscribeChatEvents(calls.receive);
    calls.setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      calls.setForeground(state === 'active');
      // The call room handles active calls, including temporary pauses for system permissions.
    });
    return () => {
      subscription.remove();
      unsubscribe();
      calls.setForeground(false);
      calls.end();
    };
  }, [calls]);
  // Subscribe to call signaling before starting the shared socket.
  useRealtimeConnections();

  const incoming = session?.phase === 'ringing' ? session : null;
  const activeCall = session?.phase === 'active' ? session.call : null;
  const endActiveCall = useCallback(() => {
    if (activeCall) calls.end(activeCall);
  }, [activeCall, calls]);

  function declineIncoming() {
    if (incoming) calls.end(incoming.call);
  }

  function acceptIncoming() {
    if (!incoming || !calls.accept(incoming.call)) return;
    // iOS must dismiss the incoming modal before presenting the call room modal.
    if (Platform.OS === 'ios') setDismissingPrompt(true);
  }

  return (
    <ChatCallContext.Provider value={{ session, startCall: calls.start }}>
      {children}
      <Modal
        visible={Boolean(incoming)}
        transparent
        statusBarTranslucent
        onRequestClose={declineIncoming}
        onDismiss={() => setDismissingPrompt(false)}>
        {incoming ? (
          <ScrollView contentContainerClassName="flex-grow items-center justify-center bg-overlay/65 p-5">
            <View
              accessibilityViewIsModal
              className="w-full max-w-md items-center rounded-3xl border border-border bg-surface p-5">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
                <Icon
                  name={incoming.call.mode === 'video' ? 'videocam-outline' : 'call-outline'}
                  size={27}
                  className="text-primary"
                />
              </View>
              <Text accessibilityRole="header" className="mt-3 text-xl font-bold text-foreground">
                {incoming.call.mode === 'video' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'}
              </Text>
              <Text className="mt-1 text-center text-base text-secondary">
                {incoming.participantName}
              </Text>
              <View className="mt-3 w-full flex-row gap-3">
                <View className="flex-1">
                  <Button label="Từ chối" danger onPress={declineIncoming} />
                </View>
                <View className="flex-1">
                  <Button label="Nhận cuộc gọi" onPress={acceptIncoming} />
                </View>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </Modal>
      {activeCall && session && !dismissingPrompt ? (
        <ChatCallRoom
          key={activeCall.callId}
          call={activeCall}
          participantName={session.participantName}
          onEnd={endActiveCall}
        />
      ) : null}
    </ChatCallContext.Provider>
  );
}

export function useChatCalls() {
  const context = useContext(ChatCallContext);
  if (!context) throw new Error('useChatCalls must be used inside ChatCallProvider');
  return context;
}
