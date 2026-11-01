import { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@/components/Icon';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/Screen';
import { useDialog } from '@/components/AppDialog';
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
      className="mb-4 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <NewsImage uri={article.thumbnailUrl} className="h-48 w-full bg-muted" />
      <View className="p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-wide text-primary">
            {categoryLabel(article.category)}
          </Text>
          <View className="flex-row items-center">
            <Ionicons name="eye-outline" size={14} className="text-subtle" />
            <Text className="ml-1 text-xs text-subtle">{article.views}</Text>
          </View>
        </View>
        <Text className="mt-2 text-lg font-bold leading-6 text-foreground" numberOfLines={2}>
          {article.title}
        </Text>
        <Text className="mt-2 text-sm leading-5 text-muted-foreground" numberOfLines={3}>
          {plainText(article.summary)}
        </Text>
        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-xs font-semibold text-secondary">{article.authorName}</Text>
          <Text className="text-xs text-subtle">{formatDate(article.publishedAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ArticleDetail({ slug, onBack }: { slug: string; onBack: () => void }) {
  const showDialog = useDialog();
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
      <SafeAreaView className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator className="text-primary" />
        <Text className="mt-3 text-sm text-muted-foreground">Đang tải bài viết...</Text>
      </SafeAreaView>
    );
  }

  if (!article || error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface px-6">
        <Ionicons name="newspaper-outline" size={42} className="text-subtle" />
        <Text className="mt-3 font-bold text-foreground">Không thể tải bài viết</Text>
        <Pressable onPress={load} className="mt-4 rounded-xl bg-brand px-5 py-3">
          <Text className="font-semibold text-on-brand">Thử lại</Text>
        </Pressable>
        <Pressable onPress={onBack} className="mt-2 px-5 py-3">
          <Text className="font-semibold text-muted-foreground">Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const contentImage = (storageObjectId: string | null) =>
    article.media.find((item) => item.storageObjectId === storageObjectId)?.url;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-border px-4 py-3">
        <Pressable onPress={onBack} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={25} className="text-foreground" />
        </Pressable>
        <Text className="ml-2 flex-1 text-base font-bold text-foreground">Bài viết</Text>
        <Pressable
          onPress={() =>
            Share.share({ message: `${article.title}\n\n${plainText(article.summary)}` }).catch(
              () => showDialog('Chia sẻ', 'Không thể mở bảng chia sẻ. Vui lòng thử lại.')
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Chia sẻ bài viết"
          className="h-10 w-10 items-center justify-center">
          <Ionicons name="share-social-outline" size={22} className="text-secondary" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
        <NewsImage uri={article.thumbnailUrl} className="h-64 w-full bg-muted" />
        <View className="px-5 py-6">
          <Text className="text-xs font-bold uppercase tracking-wide text-primary">
            {categoryLabel(article.category)}
          </Text>
          <Text className="mt-3 text-3xl font-extrabold leading-10 text-foreground">
            {article.title}
          </Text>
          <Text className="mt-4 text-base leading-7 text-secondary">
            {plainText(article.summary)}
          </Text>

          <View className="my-6 flex-row items-center border-y border-border py-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
              <Ionicons name="person" size={20} className="text-primary" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-bold text-foreground">{article.authorName}</Text>
              <Text className="mt-0.5 text-xs text-subtle">
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
                      className="h-56 w-full rounded-2xl bg-muted"
                    />
                    {block.caption ? (
                      <Text className="mt-2 text-center text-xs italic text-subtle">
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
                    className="mb-3 mt-6 text-xl font-bold text-foreground">
                    {plainText(block.text)}
                  </Text>
                );
              }
              if (block.type === 'QUOTE') {
                return (
                  <View
                    key={`${block.type}-${index}`}
                    className="my-4 rounded-r-2xl border-l-4 border-primary bg-primary-soft p-4">
                    <Text className="text-base italic leading-7 text-primary">
                      {plainText(block.text)}
                    </Text>
                  </View>
                );
              }
              return (
                <Text
                  key={`${block.type}-${index}`}
                  className="mb-4 text-base leading-7 text-secondary">
                  {plainText(block.text)}
                </Text>
              );
            })
          ) : (
            <Text className="text-base leading-7 text-secondary">{plainText(article.summary)}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function NewsScreen({ onBack }: { onBack: () => void }) {
  const [articles, setArticles] = useState<NewsSummary[]>([]);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const requestId = useRef(0);
  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (nextPage = 1) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(false);
      if (nextPage === 1) {
        setArticles([]);
        setHasMore(false);
        setTotal(0);
      }
      try {
        const result = await getPublicNews({
          page: nextPage,
          ...(category !== 'ALL' ? { category } : {}),
          ...(keyword ? { keyword } : {}),
        });
        if (id !== requestId.current) return;
        setArticles((current) => (nextPage === 1 ? result.result : [...current, ...result.result]));
        setPage(nextPage);
        setHasMore(result.hasMore);
        setTotal(result.totalElements);
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [category, keyword]
  );

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    load();
    return invalidateRequests;
  }, [load, invalidateRequests]);

  if (selectedSlug) {
    return <ArticleDetail slug={selectedSlug} onBack={() => setSelectedSlug(null)} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Tin tức & Thị trường" onBack={onBack} />
      <View className="bg-surface px-5 pb-4">
        <Text className="mt-1 text-sm leading-5 text-muted-foreground">
          Cập nhật giá thuê, pháp lý và kinh nghiệm tìm nhà an toàn.
        </Text>
        <View className="mt-4 flex-row items-center rounded-2xl bg-muted px-4">
          <Ionicons name="search-outline" size={19} className="text-subtle" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kiếm bài viết..."
            className="ml-2 flex-1 py-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
          />
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-6"
        refreshControl={
          <RefreshControl refreshing={loading && page === 1} onRefresh={() => load()} />
        }>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 pl-5">
          {CATEGORIES.map((item) => {
            const active = item.value === category;
            return (
              <Pressable
                key={item.value}
                onPress={() => setCategory(item.value)}
                className={`mr-2 rounded-full px-4 py-2.5 ${active ? 'bg-inverse' : 'border border-border bg-surface'}`}>
                <Text
                  className={`text-sm font-semibold ${active ? 'text-on-inverse' : 'text-secondary'}`}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mt-6 px-5">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-foreground">Bản tin mới nhất</Text>
            <Text className="text-xs font-semibold text-subtle">{total} bài viết</Text>
          </View>

          {loading && !articles.length ? (
            <View className="items-center py-16">
              <ActivityIndicator className="text-primary" />
              <Text className="mt-3 text-sm text-muted-foreground">Đang tải tin tức...</Text>
            </View>
          ) : error ? (
            <View className="items-center rounded-3xl border border-border bg-surface px-6 py-12">
              <Ionicons name="cloud-offline-outline" size={38} className="text-subtle" />
              <Text className="mt-3 text-center font-bold text-foreground">
                Không thể tải tin tức
              </Text>
              <Text className="mt-1 text-center text-sm text-muted-foreground">
                Vui lòng thử lại sau.
              </Text>
              <Pressable onPress={() => load()} className="mt-4 rounded-xl bg-brand px-5 py-3">
                <Text className="font-semibold text-on-brand">Thử lại</Text>
              </Pressable>
            </View>
          ) : articles.length ? (
            articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onPress={() => setSelectedSlug(article.slug)}
              />
            ))
          ) : (
            <View className="items-center rounded-3xl border border-border bg-surface px-6 py-12">
              <Ionicons name="newspaper-outline" size={38} className="text-subtle" />
              <Text className="mt-3 font-bold text-foreground">Không tìm thấy bài viết</Text>
            </View>
          )}
          {hasMore && !error ? (
            <Pressable
              disabled={loading}
              onPress={() => load(page + 1)}
              className="items-center rounded-xl bg-brand px-5 py-3">
              <Text className="font-semibold text-on-brand">
                {loading ? 'Đang tải...' : 'Xem thêm'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
