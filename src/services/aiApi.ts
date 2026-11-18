import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

export type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  listingIds?: string[];
  suggestedQuestions?: string[];
};

export type AiConversation = {
  id: string;
  messages: AiMessage[];
};

export type AiAnswer = {
  answer: string;
  listingIds?: string[];
  suggestedQuestions?: string[];
};

export async function createAiConversation() {
  const response = await axiosClient.post<ApiResponse<AiConversation>>(
    '/api/v1/ai/agent/conversations'
  );
  return response.data.result;
}

export async function getAiConversation(id: string) {
  const response = await axiosClient.get<ApiResponse<AiConversation>>(
    `/api/v1/ai/agent/conversations/${encodeURIComponent(id)}`
  );
  return response.data.result;
}

export async function askAi(question: string, conversationId: string) {
  const response = await axiosClient.post<ApiResponse<AiAnswer>>(
    '/api/v1/ai/agent/ask',
    { question, conversationId },
    { timeout: 120000 }
  );
  return response.data.result;
}
