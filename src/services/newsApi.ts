import axiosClient from '@/lib/axios-client';
import type { ApiResponse, PageResponse } from '@/types/api';

export type NewsSummary = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  featured: boolean;
  views: number;
  tags: string[];
  thumbnailUrl: string | null;
  authorName: string;
  publishedAt: string | null;
};

export type NewsDetail = NewsSummary & {
  contentBlocks: {
    type: 'PARAGRAPH' | 'HEADING' | 'QUOTE' | 'IMAGE';
    text: string | null;
    storageObjectId: string | null;
    caption: string | null;
  }[];
  media: { storageObjectId: string; role: string; url: string | null }[];
};

export async function getPublicNews(params: {
  page: number;
  size?: number;
  category?: string;
  keyword?: string;
}) {
  const response = await axiosClient.get<PageResponse<NewsSummary>>('/api/v1/public/news', {
    params: { size: 12, ...params },
  });
  return response.data;
}

export async function getNewsBySlug(slug: string) {
  const response = await axiosClient.get<ApiResponse<NewsDetail>>(
    `/api/v1/public/news/${encodeURIComponent(slug)}`
  );
  return response.data.result;
}

export async function recordNewsView(slug: string) {
  const response = await axiosClient.post<ApiResponse<{ views: number }>>(
    `/api/v1/public/news/${encodeURIComponent(slug)}/view`
  );
  return response.data.result;
}
