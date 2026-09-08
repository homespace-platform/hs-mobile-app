import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomTabBar, { type MainTab } from '@/components/BottomTabBar';
import {
  getNewsBySlug,
  getPublicNews,
  newsImage,
  type NewsDetail,
  type NewsSummary,
} from '@/services/newsApi';

const CATEGORIES = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'MARKET', label: 'Thị trường' },
  { value: 'LEGAL', label: 'Pháp lý' },
  { value: 'GUIDE', label: 'Cẩm nang' },
  { value: 'INVESTMENT', label: 'Đầu tư' },
  { value: 'TREND', label: 'Xu hướng' },
];

function categoryLabel(value: string) {
  return CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

function formatDate(value: string | null) {
  if (!value) return 'Mới cập nhật';
  return new Date(value).toLocaleDateString('vi-VN');
}

function plainText(value?: string | null) {
  return (value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}

function NewsImage({ uri, className }: { uri?: string | null; className: string }) {
  const [failed, setFailed] = useState(false);
  const source = failed ? newsImage(null) : newsImage(uri);
  return <Image source={{ uri: source }} onError={() => setFailed(true)} className={className} />;
}

function ArticleCard({ article, onPress }: { article: NewsSummary; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-4 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <NewsImage uri={article.thumbnailUrl} className="h-48 w-full bg-slate-100" />
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wide text-blue-600">
            {categoryLabel(article.category)}
          </Text>
          <View className="flex-row items-center">
            <Ionicons name="eye-outline" size={14} color="#94a3b8" />
            <Text className="ml-1 text-xs text-slate-400">{article.views}</Text>
          </View>
        </View>
        <Text className="mt-2 text-lg font-bold leading-6 text-slate-900" numberOfLines={2}>
          {article.title}
        </Text>
        <Text className="mt-2 text-sm leading-5 text-slate-500" numberOfLines={3}>
          {plainText(article.summary)}
        </Text>
        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-slate-600">{article.authorName}</Text>
          <Text className="text-xs text-slate-400">{formatDate(article.publishedAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ArticleDetail({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [article, setArticle] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setArticle(await getNewsBySlug(slug));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#2563eb" />
        <Text className="mt-3 text-sm text-slate-500">Đang tải bài viết...</Text>
      </SafeAreaView>
    );
  }

  if (!article || error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Ionicons name="newspaper-outline" size={42} color="#94a3b8" />
        <Text className="mt-3 font-bold text-slate-800">Không thể tải bài viết</Text>
        <Pressable onPress={load} className="mt-4 rounded-xl bg-blue-600 px-5 py-3">
          <Text className="font-semibold text-white">Thử lại</Text>
        </Pressable>
        <Pressable onPress={onBack} className="mt-2 px-5 py-3">
          <Text className="font-semibold text-slate-500">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const contentImage = (storageObjectId: string | null) =>
    article.media.find((item) => item.storageObjectId === storageObjectId)?.url;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-slate-100 px-4 py-3">
        <Pressable onPress={onBack} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={25} color="#0f172a" />
        </Pressable>
        <Text className="ml-2 flex-1 text-base font-bold text-slate-900">Bài viết</Text>
        <Pressable className="h-10 w-10 items-center justify-center">
          <Ionicons name="share-social-outline" size={22} color="#334155" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <NewsImage uri={article.thumbnailUrl} className="h-64 w-full bg-slate-100" />
        <View className="px-5 py-6">
          <Text className="text-xs font-bold uppercase tracking-wide text-blue-600">
            {categoryLabel(article.category)}
          </Text>
          <Text className="mt-3 text-3xl font-extrabold leading-10 text-slate-900">
            {article.title}
          </Text>
          <Text className="mt-4 text-base leading-7 text-slate-600">
            {plainText(article.summary)}
          </Text>

          <View className="my-6 flex-row items-center border-y border-slate-100 py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Ionicons name="person" size={20} color="#2563eb" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-bold text-slate-800">{article.authorName}</Text>
              <Text className="mt-0.5 text-xs text-slate-400">
                {formatDate(article.publishedAt)} · {article.views} lượt xem
              </Text>
            </View>
          </View>

          {article.contentBlocks.length ? (
            article.contentBlocks.map((block, index) => {
              if (block.type === 'IMAGE') {
                return (
                  <View key={`${block.type}-${index}`} className="my-4">
                    <NewsImage
                      uri={contentImage(block.storageObjectId)}
                      className="h-56 w-full rounded-2xl bg-slate-100"
                    />
                    {block.caption ? (
                      <Text className="mt-2 text-center text-xs italic text-slate-400">
                        {plainText(block.caption)}
                      </Text>
                    ) : null}
                  </View>
                );
              }
              if (block.type === 'HEADING') {
                return (
                  <Text
                    key={`${block.type}-${index}`}
                    className="mb-3 mt-6 text-xl font-bold text-slate-900">
                    {plainText(block.text)}
                  </Text>
                );
              }
              if (block.type === 'QUOTE') {
                return (
                  <View
                    key={`${block.type}-${index}`}
                    className="my-4 rounded-r-2xl border-l-4 border-blue-500 bg-blue-50 p-4">
                    <Text className="text-base italic leading-7 text-blue-900">
                      {plainText(block.text)}
                    </Text>
                  </View>
                );
              }
              return (
                <Text
                  key={`${block.type}-${index}`}
                  className="mb-4 text-base leading-7 text-slate-700">
                  {plainText(block.text)}
                </Text>
              );
            })
          ) : (
            <Text className="text-base leading-7 text-slate-700">{plainText(article.summary)}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function NewsScreen({ onSelectTab }: { onSelectTab: (tab: MainTab) => void }) {
  const [articles, setArticles] = useState<NewsSummary[]>([]);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setArticles(await getPublicNews());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return articles.filter(
      (article) =>
        (category === 'ALL' || article.category === category) &&
        (!keyword ||
          article.title.toLowerCase().includes(keyword) ||
          article.summary.toLowerCase().includes(keyword) ||
          article.tags.some((tag) => tag.toLowerCase().includes(keyword)))
    );
  }, [articles, category, search]);

  if (selectedSlug) {
    return <ArticleDetail slug={selectedSlug} onBack={() => setSelectedSlug(null)} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <View className="bg-white px-5 pb-5 pt-2">
          <Text className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            HomeSpace
          </Text>
          <Text className="mt-1 text-2xl font-bold text-slate-900">Tin tức & Thị trường</Text>
          <Text className="mt-2 text-sm leading-5 text-slate-500">
            Cập nhật giá thuê, pháp lý và kinh nghiệm tìm nhà an toàn.
          </Text>
          <View className="mt-4 flex-row items-center rounded-2xl bg-slate-100 px-4">
            <Ionicons name="search-outline" size={19} color="#94a3b8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm kiếm bài viết..."
              placeholderTextColor="#94a3b8"
              className="ml-2 flex-1 py-3 text-sm text-slate-800"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 pl-5">
          {CATEGORIES.map((item) => {
            const active = item.value === category;
            return (
              <Pressable
                key={item.value}
                onPress={() => setCategory(item.value)}
                className={`mr-2 rounded-full px-4 py-2.5 ${active ? 'bg-slate-900' : 'border border-slate-200 bg-white'}`}>
                <Text
                  className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mt-6 px-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-slate-900">Bản tin mới nhất</Text>
            <Text className="text-xs font-semibold text-slate-400">{filtered.length} bài viết</Text>
          </View>

          {loading ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#2563eb" />
              <Text className="mt-3 text-sm text-slate-500">Đang tải tin tức...</Text>
            </View>
          ) : error ? (
            <View className="items-center rounded-3xl border border-slate-200 bg-white px-6 py-12">
              <Ionicons name="cloud-offline-outline" size={38} color="#94a3b8" />
              <Text className="mt-3 text-center font-bold text-slate-800">
                News service chưa hoạt động
              </Text>
              <Text className="mt-1 text-center text-sm text-slate-500">
                Khởi động service rồi bấm thử lại.
              </Text>
              <Pressable onPress={load} className="mt-4 rounded-xl bg-blue-600 px-5 py-3">
                <Text className="font-semibold text-white">Thử lại</Text>
              </Pressable>
            </View>
          ) : filtered.length ? (
            filtered.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onPress={() => setSelectedSlug(article.slug)}
              />
            ))
          ) : (
            <View className="items-center rounded-3xl border border-slate-200 bg-white px-6 py-12">
              <Ionicons name="newspaper-outline" size={38} color="#94a3b8" />
              <Text className="mt-3 font-bold text-slate-800">Không tìm thấy bài viết</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomTabBar active="news" onSelect={onSelectTab} />
    </SafeAreaView>
  );
}
