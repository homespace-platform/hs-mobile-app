import axiosClient from '@/lib/axios-client';
import type { ApiResponse, PageResponse } from '@/types/api';

export const MOCK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80';

export function newsImage(url?: string | null) {
  return !url || url.includes('homespace-dev-files') ? MOCK_NEWS_IMAGE : url;
}

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

export async function getPublicNews(params: { page: number; category?: string; keyword?: string }) {
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
