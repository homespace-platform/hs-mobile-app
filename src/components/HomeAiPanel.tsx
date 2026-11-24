import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import Icon from '@/components/Icon';
import { apiError } from '@/lib/api-error';
import { askAi, createAiConversation, getAiConversation, type AiMessage } from '@/services/aiApi';

export default function HomeAiPanel({ onOpenListing }: { onOpenListing?: (id: string) => void }) {
  const [draft, setDraft] = useState('');
  const [opened, setOpened] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const sending = useRef(false);

  async function send(value = draft) {
    const question = value.trim();
    if (!question || question.length > 500 || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setOpened(true);
    setDraft('');
    const localMessage: AiMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: question,
    };
    setMessages((current) => [...current, localMessage]);
    let id = conversationId.current;
    try {
      if (!id) {
        const conversation = await createAiConversation();
        id = conversation.id;
        conversationId.current = id;
      }
      const answer = await askAi(question, id);
      setMessages((current) => [
        ...current,
        {
          id: `answer-${Date.now()}`,
          role: 'assistant',
          content: answer.answer,
          listingIds: answer.listingIds,
          suggestedQuestions: answer.suggestedQuestions,
        },
      ]);
    } catch (cause) {
      if (id) {
        try {
          const conversation = await getAiConversation(id);
          setMessages(conversation.messages);
          setError(
            'Kết nối bị gián đoạn. Mình đã tải lại hội thoại; hãy kiểm tra câu trả lời trước khi gửi lại.'
          );
        } catch {
          setError('Chưa nhận được phản hồi. Câu hỏi có thể đã được lưu, hãy thử mở lại sau.');
        }
      } else {
        setMessages((current) => current.filter((message) => message !== localMessage));
        setDraft(question);
        setError(`Chưa tạo được hội thoại: ${apiError(cause)}`);
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <View className="mt-5 rounded-2xl border border-primary-border bg-surface p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="sparkles-outline" size={20} className="text-primary" />
        <Text className="text-sm font-bold text-primary">Tìm kiếm nhanh AI</Text>
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Ví dụ: Mình cần phòng cho 2 người, dưới 4 triệu, có ban công ở Phú Lợi…"
        multiline
        maxLength={500}
        accessibilityLabel="Mô tả nhu cầu tìm nhà hoặc hỏi HomeSpace AI"
        className="mt-3 min-h-16 rounded-xl bg-muted px-4 py-3 text-sm text-foreground placeholder:text-subtle"
      />
      <Pressable
        onPress={() => void send()}
        disabled={busy || !draft.trim()}
        accessibilityRole="button"
        className={`mt-3 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand px-4 ${busy || !draft.trim() ? 'opacity-50' : ''}`}>
        {busy ? (
          <ActivityIndicator className="text-on-brand" />
        ) : (
          <Icon name="send" size={17} className="text-on-brand" />
        )}
        <Text className="font-bold text-on-brand">
          {busy ? 'AI đang hỗ trợ…' : 'Hỏi HomeSpace AI'}
        </Text>
      </Pressable>
      {opened ? (
        <View className="mt-4 border-t border-border pt-4">
          <Text className="mb-3 font-bold text-foreground">Hội thoại</Text>
          {messages.map((message) => (
            <View
              key={message.id}
              className={`mb-3 rounded-2xl p-3 ${message.role === 'user' ? 'bg-primary-soft' : 'bg-muted'}`}>
              <Text className="text-xs font-bold text-primary">
                {message.role === 'user' ? 'Bạn' : 'HomeSpace AI'}
              </Text>
              <Text selectable className="mt-1 text-sm leading-5 text-foreground">
                {message.content}
              </Text>
              {message.listingIds?.map((id, index) => (
                <Pressable
                  key={id}
                  onPress={() => onOpenListing?.(id)}
                  className="mt-2 self-start rounded-lg bg-surface px-3 py-2">
                  <Text className="text-sm font-semibold text-primary">
                    Xem tin đăng {index + 1} →
                  </Text>
                </Pressable>
              ))}
              {message.suggestedQuestions?.map((question) => (
                <Pressable
                  key={question}
                  onPress={() => void send(question)}
                  className="mt-2 rounded-lg border border-primary-border px-3 py-2">
                  <Text className="text-xs text-primary">{question}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}
