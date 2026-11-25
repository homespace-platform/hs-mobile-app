// hs-web-app components/rental-request/RentalRequestAiReviewModal.tsx. Mounted = open.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import ModalShell from '@/components/rental/shared/ModalShell';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import rentalRequestReviewService from '@/services/rental/rental-request-review.service';
import type {
  RentalReview,
  RentalReviewRow,
  RentalReviewTurn,
} from '@/types/rental/rental-request.type';

import AiText from './AiText';
import { aiFacts, scorePercent } from './logic';

const SUGGESTIONS = [
  'Vì sao chọn người này?',
  'Rủi ro khi chọn người này là gì?',
  'Nếu tôi ưu tiên doanh thu ổn định thì nên chọn ai?',
];

function RankRow({ row, onAccept }: { row: RentalReviewRow; onAccept: () => void }) {
  return (
    <View
      className={`gap-2 rounded-2xl border bg-surface p-4 ${row.rank === 1 ? 'border-success' : 'border-border'}`}>
      <View className="flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-primary-soft">
          <Text className="text-xs font-bold text-primary">{row.rank}</Text>
        </View>
        <Text className="flex-1 text-sm font-semibold text-foreground">{row.renterName}</Text>
        <Text className="text-xs font-semibold text-muted-foreground">{row.score}/100</Text>
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-1.5 overflow-hidden rounded-full bg-muted">
        <View
          className="h-full rounded-full bg-brand"
          style={{ width: `${scorePercent(row.score)}%` }}
        />
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {aiFacts(row).map((item) => (
          <View key={item} className="rounded-full border border-border bg-muted px-2 py-0.5">
            <Text className="text-xs text-foreground">{item}</Text>
          </View>
        ))}
      </View>
      {row.strengths.map((item) => (
        <Text key={item} className="text-xs leading-5 text-success">
          ✓ {item}
        </Text>
      ))}
      {row.weaknesses.map((item) => (
        <Text key={item} className="text-xs leading-5 text-warning">
          • {item}
        </Text>
      ))}
      <ActionButton label="Chấp thuận yêu cầu này" variant="secondary" onClick={onAccept} />
    </View>
  );
}

export default function RentalRequestAiReviewModal({
  listingId,
  listingTitle,
  onClose,
  onAccept,
}: {
  listingId: string;
  listingTitle: string;
  onClose: () => void;
  /** Opens the existing accept confirmation; the landlord always confirms. */
  onAccept: (requestId: string) => void;
}) {
  const alive = useRef(false);
  const asking = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const [review, setReview] = useState<RentalReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<RentalReviewTurn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await rentalRequestReviewService.review(listingId);
      if (alive.current) setReview(next);
    } catch (e) {
      if (alive.current) {
        setReview(null);
        setError(
          getApiErrorMessage(e, 'Chưa đánh giá được các yêu cầu lúc này. Vui lòng thử lại.')
        );
      }
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  async function ask(text: string) {
    const content = text.trim();
    if (!content || asking.current || !review) return;
    asking.current = true;
    setBusy(true);
    setQuestion('');
    const history = turns;
    setTurns([...history, { role: 'user', content }]);
    try {
      const result = await rentalRequestReviewService.ask(listingId, content, history);
      if (!alive.current) return;
      setReview(result.review);
      setTurns((current) => [...current, { role: 'assistant', content: result.answer }]);
    } catch (e) {
      if (alive.current) {
        setTurns((current) => [
          ...current,
          {
            role: 'assistant',
            content: getApiErrorMessage(e, 'AI chưa trả lời được lúc này. Bạn thử lại sau nhé.'),
          },
        ]);
      }
    } finally {
      asking.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const best = review?.ranking.find((row) => row.requestId === review.recommendedRequestId);
  const canSend = !busy && !!question.trim();

  return (
    <ModalShell
      title={
        <View className="flex-1">
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            AI đánh giá yêu cầu thuê
          </Text>
          <Text numberOfLines={1} className="text-xs text-muted-foreground">
            {listingTitle}
          </Text>
        </View>
      }
      icon="sparkles-outline"
      scrollRef={scroll}
      onClose={onClose}
      closeLabel="Đóng đánh giá AI"
      footer={
        <>
          <ActionButton
            label="Đánh giá lại"
            variant="secondary"
            disabled={loading || busy}
            onClick={() => void load()}
            className="grow"
          />
          <ActionButton label="Đóng" variant="secondary" onClick={onClose} className="grow" />
        </>
      }>
      <View className="gap-4">
        {loading ? (
          <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">
            Đang đọc và so sánh các yêu cầu…
          </Text>
        ) : null}
        {error ? (
          <View
            accessibilityRole="alert"
            className="rounded-xl border border-warning bg-warning-soft p-3">
            <Text className="text-sm leading-6 text-warning">{error}</Text>
          </View>
        ) : null}

        {review && best ? (
          <>
            <View className="gap-2 rounded-2xl border border-success bg-success-soft p-4">
              <View className="flex-row items-center gap-2">
                <Icon name="checkmark-circle-outline" size={18} className="text-success" />
                <Text className="text-sm font-bold text-success">Đề xuất cho chủ nhà</Text>
              </View>
              <AiText content={review.summary} />
            </View>

            {review.ranking.map((row) => (
              <RankRow
                key={row.requestId}
                row={row}
                onAccept={() => {
                  onClose();
                  onAccept(row.requestId);
                }}
              />
            ))}

            <View
              accessibilityLabel="Hỏi AI nhanh"
              className="gap-3 rounded-2xl border border-border bg-surface p-4">
              <View className="flex-row items-center gap-2">
                <Icon name="chatbubbles-outline" size={18} className="text-primary" />
                <Text className="text-sm font-semibold text-foreground">Hỏi AI nhanh</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {SUGGESTIONS.map((item) => (
                  <Pressable
                    key={item}
                    disabled={busy}
                    onPress={() => void ask(item)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy }}
                    className={`min-h-11 justify-center rounded-full border border-primary-border bg-primary-soft px-3 py-1 ${busy ? 'opacity-50' : ''}`}>
                    <Text className="text-xs font-semibold text-primary">{item}</Text>
                  </Pressable>
                ))}
              </View>
              {turns.map((turn, index) => (
                <View
                  key={index}
                  onLayout={
                    index === turns.length - 1 ? () => scroll.current?.scrollToEnd() : undefined
                  }
                  className={
                    turn.role === 'user'
                      ? 'ml-8 rounded-xl bg-brand px-3 py-2'
                      : 'mr-8 rounded-xl bg-muted px-3 py-2'
                  }>
                  {turn.role === 'user' ? (
                    <Text className="text-sm leading-6 text-on-brand">{turn.content}</Text>
                  ) : (
                    <AiText content={turn.content} />
                  )}
                </View>
              ))}
              {busy ? (
                <Text accessibilityLiveRegion="polite" className="text-xs text-muted-foreground">
                  AI đang trả lời…
                </Text>
              ) : null}
              <View className="flex-row gap-2">
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  maxLength={500}
                  editable={!busy}
                  returnKeyType="send"
                  onSubmitEditing={() => void ask(question)}
                  placeholder="Ví dụ: So sánh rủi ro của hai người thuê"
                  accessibilityLabel="Ví dụ: So sánh rủi ro của hai người thuê"
                  className="min-h-12 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
                />
                <Pressable
                  onPress={() => void ask(question)}
                  disabled={!canSend}
                  accessibilityRole="button"
                  accessibilityLabel="Gửi câu hỏi"
                  accessibilityState={{ disabled: !canSend }}
                  className={`h-12 w-12 items-center justify-center rounded-xl bg-brand ${canSend ? '' : 'opacity-50'}`}>
                  <Icon name="send" size={18} className="text-on-brand" />
                </Pressable>
              </View>
            </View>

            <View className="flex-row gap-1.5">
              <Icon name="warning-outline" size={14} className="text-muted-foreground" />
              <Text className="flex-1 text-xs leading-5 text-muted-foreground">
                Điểm số tính từ dữ liệu yêu cầu theo trọng số cố định; AI chỉ giải thích. Bạn là
                người quyết định chấp thuận hay từ chối.
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </ModalShell>
  );
}
