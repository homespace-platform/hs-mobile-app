import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export type RelatedListing = {
  id: string;
  title: string;
  price: string;
  location: string;
  image: string;
};

export type ChatConversation = {
  id: string;
  participantId: string;
  participantName?: string;
  participantAvatar?: string;
  participantEmail?: string;
  listing?: RelatedListing;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  listing?: RelatedListing;
  createdAt: string;
};

type MessagePage = { items: ChatMessage[]; nextBefore?: string };
type ParticipantProfile = { displayName?: string; email?: string; avatarUrl?: string };

export async function createConversation(
  participantId: string,
  listing?: RelatedListing,
  participantProfile?: ParticipantProfile
) {
  const response = await axiosClient.post<ApiResponse<ChatConversation>>(
    '/api/v1/chat/conversations',
    {
      participantId,
      ...(listing ? { listing } : {}),
      ...(participantProfile ? { participantProfile } : {}),
    }
  );
  return response.data.result;
}

export async function listConversations() {
  const response = await axiosClient.get<ApiResponse<ChatConversation[]>>(
    '/api/v1/chat/conversations',
    { params: { limit: 30 } }
  );
  return response.data.result ?? [];
}

export async function listMessages(conversationId: string) {
  const response = await axiosClient.get<ApiResponse<MessagePage>>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { params: { limit: 50 } }
  );
  return response.data.result;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  listing?: RelatedListing,
  senderProfile?: ParticipantProfile
) {
  const response = await axiosClient.post<ApiResponse<ChatMessage>>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      content,
      ...(listing ? { listing } : {}),
      ...(senderProfile ? { senderProfile } : {}),
    }
  );
  return response.data.result;
}

export async function markConversationRead(conversationId: string) {
  await axiosClient.patch(`/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/read`);
}
