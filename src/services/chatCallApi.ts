import axiosClient from '@/lib/axios-client';
import type { ApiResponse } from '@/types/api';

type ChatCallToken = {
  appId: string;
  channel: string;
  token: string;
  uid: string;
};

export async function getChatCallToken(conversationId: string, callId: string): Promise<ChatCallToken> {
  const { data } = await axiosClient.post<ApiResponse<ChatCallToken>>(
    `/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/call-token`,
    { callId }
  );
  const result = data.result;
  if (typeof result?.appId !== 'string' || !result.appId.trim() ||
      typeof result.token !== 'string' || !result.token.trim() ||
      typeof result.uid !== 'string' || !result.uid.trim() ||
      result.channel !== `hs_${callId.replaceAll('-', '')}`) {
    throw new Error('Máy chủ trả thông tin cuộc gọi không hợp lệ.');
  }
  return result;
}
