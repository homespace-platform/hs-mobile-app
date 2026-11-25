import type { ChatConversation, ChatMessage, RelatedListing } from '@/services/chatApi';

const time = (value?: string) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

// Stopgap until the backend migration merges legacy duplicates: one row per participant, the most
// recent one wins (unread counts are summed). `preferId` keeps that id when it belongs to the group,
// so a conversation just returned by createConversation can still be opened.
export function dedupeConversationsByParticipant(
  items: ChatConversation[],
  preferId?: string | null
): ChatConversation[] {
  const groups = new Map<string, ChatConversation[]>();
  for (const item of items) {
    const group = groups.get(item.participantId);
    if (group) group.push(item);
    else groups.set(item.participantId, [item]);
  }
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const latest = group.reduce((a, b) => (time(b.lastMessageAt) > time(a.lastMessageAt) ? b : a));
    const preferred = group.find((item) => item.id === preferId);
    return {
      ...latest,
      id: preferred?.id ?? latest.id,
      unreadCount: group.reduce((total, item) => total + (item.unreadCount || 0), 0),
    };
  });
}

// A listing opened from a listing detail without text is attached once to the next message, unless the
// latest listing card in the thread is already mine and for the same listing.
export function shouldAttachPendingListing(
  pending: RelatedListing | null | undefined,
  messages: ChatMessage[],
  myId?: string
): boolean {
  if (!pending) return false;
  const last = [...messages].reverse().find((message) => message.listing);
  return !(last && last.senderId === myId && last.listing?.id === pending.id);
}
export function chatMessageCaption({ content, attachments }: ChatMessage): string {
  if (!attachments?.length) return content;
  if (attachments.length === 1) {
    return content === `Đã gửi ${attachments[0].fileName}` || content === 'Đã gửi tệp đính kèm'
      ? ''
      : content;
  }
  return content === `Đã gửi ${attachments.length} tệp đính kèm` ? '' : content;
}
