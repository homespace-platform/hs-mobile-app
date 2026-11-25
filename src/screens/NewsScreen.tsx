import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { ScreenHeader } from '@/components/Screen';
import { webBaseUrl } from '@/config/env';
import { newsPlainText, newsTextParts, readNewsInlineImage } from '@/lib/news-content';
import {
  getNewsBySlug,
  getPublicNews,
  recordNewsView,
  type NewsDetail,
  type NewsSummary,
} from '@/services/newsApi';
import type { PageResponse } from '@/types/api';

const CATEGORIES = [
  { value: 'ALL', label: 'Tất cả', colors: 'bg-muted text-secondary' },
  { value: 'MARKET', label: 'Thị trường', colors: 'bg-brand text-on-brand' },
  { value: 'LEGAL', label: 'Pháp lý', colors: 'bg-news-legal text-on-brand' },
  { value: 'GUIDE', label: 'Cẩm nang thuê', colors: 'bg-success-soft text-success' },
  { value: 'INVESTMENT', label: 'Đầu tư', colors: 'bg-warning-soft text-warning' },
  { value: 'TREND', label: 'Xu hướng', colors: 'bg-danger-soft text-danger' },
];
const OVERVIEW_SIZE = 50;
const CARD_BATCH_SIZE = 8;
const FALLBACK_IMAGE = require('../../assets/homespace-logo.png');

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : 'Mới cập nhật';
}

function CategoryBadge({ value }: { value: string }) {
  const category = CATEGORIES.find((item) => item.value === value.toUpperCase());
  const colors = category?.colors ?? 'bg-muted text-secondary';
  return (
    <Text
      className={`self-start overflow-hidden rounded-full px-2.5 py-1 text-xs font-bold ${colors}`}>
      {category?.label ?? value}
    </Text>
  );
}

function NewsImage({ uri, alt }: { uri?: string | null; alt: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const remote = uri && failedUri !== uri ? uri : null;
  return (
    <Image
      source={remote ? { uri: remote } : FALLBACK_IMAGE}
      accessibilityLabel={alt}
      className={`h-full w-full ${remote ? 'bg-muted' : 'bg-logo'}`}
      resizeMode={remote ? 'cover' : 'contain'}
      onError={remote ? () => setFailedUri(remote) : undefined}
    />
  );
}

function ArticleShare({ article, overlay = false }: { article: NewsSummary; overlay?: boolean }) {
  const showDialog = useDialog();

  async function share() {
    try {
      const url = `${(webBaseUrl || 'https://www.homespace.id.vn').replace(/\/+$/, '')}/news/${encodeURIComponent(article.slug)}`;
      await Share.share(
        Platform.OS === 'ios'
          ? { message: article.title, url }
          : { message: `${article.title}\n${url}` }
      );
    } catch {
      showDialog('Chia sẻ', 'Không thể mở bảng chia sẻ. Vui lòng thử lại.');
    }
  }

  return (
    <Pressable
      onPress={share}
      accessibilityRole="button"
      accessibilityLabel="Chia sẻ bài viết"
      className={`h-11 w-11 items-center justify-center rounded-full ${overlay ? 'bg-overlay/70' : 'bg-primary-soft'}`}>
      <Icon
        name="share-social-outline"
        size={19}
        className={overlay ? 'text-on-brand' : 'text-primary'}
      />
    </Pressable>
  );
}

function ArticleCard({
  article,
  onOpen,
}: {
  article: NewsSummary;
  onOpen: (slug: string) => void;
}) {
  const summary = newsPlainText(article.summary);
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <Pressable accessibilityRole="button" onPress={() => onOpen(article.slug)}>
        <View className="aspect-[16/10] w-full">
          <NewsImage key={article.thumbnailUrl} uri={article.thumbnailUrl} alt={article.title} />
          <View className="absolute left-3 top-3">
            <CategoryBadge value={article.category} />
          </View>
        </View>
        <View className="p-4">
          <Text className="text-base font-bold leading-6 text-foreground" numberOfLines={2}>
            {article.title}
          </Text>
          {summary ? (
            <Text className="mt-1.5 text-sm leading-5 text-muted-foreground" numberOfLines={2}>
              {summary}
            </Text>
          ) : null}
          <View className="mt-3 flex-row items-center justify-between gap-2 border-t border-border pt-3">
            <View className="flex-row items-center gap-1.5">
              <Icon name="calendar-outline" size={14} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">
                {formatDate(article.publishedAt)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Icon name="eye-outline" size={15} className="text-muted-foreground" />
              <Text className="text-xs text-muted-foreground">
                {(article.views ?? 0).toLocaleString('vi-VN')}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
      <View
        pointerEvents="box-none"
        className="absolute right-2 top-2 flex-row items-center gap-1.5">
        {article.featured ? (
          <View
            pointerEvents="none"
            className="flex-row items-center gap-1 rounded-full bg-warning-soft px-2 py-1">
            <Icon name="sparkles" size={13} className="text-warning" />
            <Text className="text-xs font-bold text-warning">Nổi bật</Text>
          </View>
        ) : null}
        <ArticleShare article={article} overlay />
      </View>
    </View>
  );
}

function ArticleBlocks({ article }: { article: NewsDetail }) {
  return article.contentBlocks.map((block, index) => {
    const pasted = block.type === 'PARAGRAPH' ? readNewsInlineImage(block.text) : null;
    if (block.type === 'IMAGE' || pasted) {
      const uri =
        pasted?.src ??
        article.media.find((item) => item.storageObjectId === block.storageObjectId)?.url;
      if (!uri) return null;
      return (
        <View key={index} className="my-3">
          <View className="aspect-[16/10] overflow-hidden rounded-2xl">
            <NewsImage
              uri={uri}
              alt={pasted?.alt ?? (newsPlainText(block.caption) || article.title)}
            />
          </View>
          {block.caption ? (
            <Text className="mt-2 text-center text-sm italic text-muted-foreground">
              {newsPlainText(block.caption)}
            </Text>
          ) : null}
        </View>
      );
    }

    const parts = newsTextParts(block.text);
    if (!parts.some((part) => part.text.trim())) return null;
    const heading = block.type === 'HEADING';
    const typography = heading
      ? 'mb-3 mt-4 text-xl font-bold leading-7 text-foreground'
      : block.type === 'QUOTE'
        ? 'my-3 rounded-r-xl border-l-4 border-primary bg-primary-soft p-3 text-base italic leading-7 text-secondary'
        : 'mb-4 text-base leading-7 text-secondary';
    return (
      <Text key={index} accessibilityRole={heading ? 'header' : undefined} className={typography}>
        {parts.map((part, partIndex) => (
          <Text key={partIndex} className={part.style}>
            {part.text}
          </Text>
        ))}
      </Text>
    );
  });
}

function ArticleDetail({
  slug,
  onBack,
  onOpen,
  onRecordView,
}: {
  slug: string;
  onBack: () => void;
  onOpen: (slug: string) => void;
  onRecordView: (slug: string, views: number) => void;
}) {
  const [article, setArticle] = useState<NewsDetail | null>(null);
  const [related, setRelated] = useState<NewsSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    let active = true;
    getNewsBySlug(slug)
      .then((detail) => {
        if (!active) return;
        setArticle(detail);
        setStatus('ready');
        if (!recorded.current) {
          recorded.current = true;
          void recordNewsView(slug)
            .then(({ views }) => {
              if (active) setArticle({ ...detail, views });
              onRecordView(slug, views);
            })
            .catch(() => {});
        }
        return getPublicNews({ page: 1, size: 4, category: detail.category });
      })
      .then((response) => {
        if (active && response)
          setRelated(response.result.filter((item) => item.slug !== slug).slice(0, 3));
      })
      .catch(() => {
        if (active) setStatus((current) => (current === 'ready' ? current : 'error'));
      });
    return () => {
      active = false;
    };
  }, [attempt, onRecordView, slug]);

  const body = article?.contentBlocks.map((block) => newsPlainText(block.text)).join(' ').trim();
  const words = (body || newsPlainText(article?.summary)).match(/\S+/g)?.length ?? 0;
  const readMinutes = Math.ceil(words / 220);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Bài viết" onBack={onBack} />
      {status === 'loading' ? (
        <NewsNotice loading title="Đang tải bài viết..." />
      ) : status === 'error' || !article ? (
        <NewsNotice
          title="Không thể tải bài viết"
          onRetry={() => {
            setStatus('loading');
            setAttempt((value) => value + 1);
          }}
        />
      ) : (
        <ScrollView contentContainerClassName="px-5 pb-8 pt-5">
          <CategoryBadge value={article.category} />
          <Text
            accessibilityRole="header"
            className="mt-3 text-3xl font-extrabold leading-10 text-foreground">
            {article.title}
          </Text>
          <View className="my-4 flex-row items-center gap-3 border-y border-border py-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
              <Icon name="person" size={19} className="text-primary" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-foreground">
                {article.authorName || 'HomeSpace'}
              </Text>
              <Text className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {formatDate(article.publishedAt)} · {(article.views ?? 0).toLocaleString('vi-VN')}{' '}
                lượt xem
              </Text>
              {readMinutes ? (
                <Text className="text-xs text-muted-foreground">Khoảng {readMinutes} phút đọc</Text>
              ) : null}
            </View>
            <ArticleShare article={article} />
          </View>
          <View className="aspect-video overflow-hidden rounded-3xl">
            <NewsImage uri={article.thumbnailUrl} alt={article.title} />
          </View>
          {article.summary ? (
            <View className="my-5 rounded-2xl border-l-4 border-primary bg-muted p-4">
              <Text className="text-base font-semibold leading-6 text-foreground">
                {newsPlainText(article.summary)}
              </Text>
            </View>
          ) : null}
          <ArticleBlocks article={article} />
          {article.tags?.length ? (
            <View className="mt-4 flex-row flex-wrap items-center gap-2 border-t border-border pt-4">
              <Text className="text-sm font-bold text-foreground">Thẻ</Text>
              {article.tags.map((tag) => (
                <Text
                  key={tag}
                  className="overflow-hidden rounded-full bg-muted px-3 py-1 text-sm text-secondary">
                  #{tag}
                </Text>
              ))}
            </View>
          ) : null}
          {related.length ? (
            <View className="mt-6 gap-4 border-t border-border pt-4">
              <Text accessibilityRole="header" className="text-xl font-extrabold text-foreground">
                Bài viết liên quan
              </Text>
              {related.map((item) => (
                <ArticleCard key={item.id} article={item} onOpen={onOpen} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NewsNotice({
  title,
  loading,
  onRetry,
}: {
  title: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View className="items-center rounded-3xl border border-border bg-surface px-6 py-10">
      {loading ? (
        <ActivityIndicator className="text-primary" />
      ) : (
        <Icon
          name={onRetry ? 'cloud-offline-outline' : 'newspaper-outline'}
          size={34}
          className="text-subtle"
        />
      )}
      <Text
        accessibilityRole={onRetry ? 'alert' : undefined}
        className="mt-3 text-center font-bold text-foreground">
        {title}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mt-3 rounded-xl bg-brand px-5 py-3">
          <Text className="font-semibold text-on-brand">Thử lại</Text>
        </Pressable>
      ) : !loading ? (
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          Hãy thử từ khóa hoặc danh mục khác.
        </Text>
      ) : null}
    </View>
  );
}

export default function NewsScreen({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const [articles, setArticles] = useState<NewsSummary[]>([]);
  const [overview, setOverview] = useState<PageResponse<NewsSummary> | null>(null);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(CARD_BATCH_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [trail, setTrail] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const requestId = useRef(0);
  const overviewRequestId = useRef(0);
  const list = useRef<FlatList<NewsSummary>>(null);
  const latestOffset = useRef(0);
  const selectedSlug = trail[trail.length - 1];
  const unfiltered = category === 'ALL' && !keyword;
  const featured =
    unfiltered && !search.trim() ? (overview?.result.filter((item) => item.featured) ?? []) : [];

  const load = useCallback(
    async (nextPage = 1, refresh = false) => {
      const id = ++requestId.current;
      const initialOverview = unfiltered && nextPage === 1;
      if (initialOverview) overviewRequestId.current = id;
      setLoading(true);
      setRefreshing(refresh);
      setFailedPage(null);
      if (nextPage === 1 && !refresh) {
        setArticles([]);
        setHasMore(false);
        setVisibleCount(CARD_BATCH_SIZE);
      }
      try {
        const result = await getPublicNews({
          page: nextPage,
          ...(unfiltered ? { size: OVERVIEW_SIZE } : {}),
          ...(category !== 'ALL' ? { category } : {}),
          ...(keyword ? { keyword } : {}),
        });
        if (initialOverview && overviewRequestId.current === id) setOverview(result);
        if (id !== requestId.current) return;
        setArticles((current) => (nextPage === 1 ? result.result : [...current, ...result.result]));
        if (nextPage > 1) setVisibleCount((current) => current + CARD_BATCH_SIZE);
        setPage(nextPage);
        setHasMore(result.hasMore);
      } catch {
        if (id === requestId.current) setFailedPage(nextPage);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [category, keyword, unfiltered]
  );

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void load();
    return () => {
      requestId.current++;
    };
  }, [load]);

  useEffect(
    () => () => {
      overviewRequestId.current = 0;
    },
    []
  );

  const openArticle = useCallback((slug: string) => setTrail((current) => [...current, slug]), []);
  const backFromArticle = useCallback(() => setTrail((current) => current.slice(0, -1)), []);
  const updateViews = useCallback((slug: string, views: number) => {
    const replace = (item: NewsSummary) => (item.slug === slug ? { ...item, views } : item);
    setArticles((current) => current.map(replace));
    setOverview((current) =>
      current ? { ...current, result: current.result.map(replace) } : current
    );
  }, []);

  const more = () => {
    if (failedPage !== null) void load(failedPage, failedPage === 1);
    else if (articles.length > visibleCount) setVisibleCount(visibleCount + CARD_BATCH_SIZE);
    else void load(page + 1);
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className={selectedSlug ? 'hidden' : 'flex-1'} edges={['top', 'bottom']}>
        <ScreenHeader title="Tin tức" onBack={onBack} />
        <FlatList
          ref={list}
          data={articles.slice(0, visibleCount)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="mb-4">
              <ArticleCard article={item} onOpen={openArticle} />
            </View>
          )}
          contentContainerClassName="px-5 pb-6"
          keyboardShouldPersistTaps="handled"
          refreshing={refreshing}
          onRefresh={() => void load(1, true)}
          ListHeaderComponent={
            <View className="pt-5">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text
                  accessibilityRole="header"
                  className="text-2xl font-extrabold text-foreground">
                  Tin tức &amp; Thị trường
                </Text>
                {overview ? (
                  <Text className="overflow-hidden rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                    {overview.totalElements} bài viết
                  </Text>
                ) : null}
              </View>
              <Text className="mt-2 text-sm leading-6 text-muted-foreground">
                Cập nhật xu hướng giá thuê, chính sách pháp lý nhà ở mới nhất, quy hoạch hạ tầng và
                cẩm nang thuê nhà an toàn.
              </Text>
              <View className="mt-4 flex-row items-center rounded-xl border border-border bg-surface px-3">
                <Icon name="search-outline" size={18} className="text-muted-foreground" />
                <TextInput
                  accessibilityLabel="Tìm kiếm bài viết"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Tìm kiếm bài viết..."
                  returnKeyType="search"
                  className="ml-2 min-h-12 flex-1 py-2 text-base text-foreground selection:text-primary placeholder:text-subtle"
                />
                {search ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa tìm kiếm"
                    onPress={() => setSearch('')}
                    className="h-11 w-11 items-center justify-center">
                    <Icon name="close-circle-outline" size={20} className="text-muted-foreground" />
                  </Pressable>
                ) : null}
              </View>
              <View className="my-4 flex-row flex-wrap gap-2">
                {CATEGORIES.map((item) => {
                  const active = item.value === category;
                  const count =
                    item.value === 'ALL'
                      ? overview?.totalElements
                      : overview && !overview.hasMore
                        ? overview.result.filter(
                            (entry) => entry.category.toUpperCase() === item.value
                          ).length
                        : undefined;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setCategory(item.value)}
                      className={`min-h-11 flex-row items-center gap-1.5 rounded-full px-3 py-2 ${active ? 'bg-brand' : 'bg-muted'}`}>
                      <Text
                        className={`text-sm font-semibold ${active ? 'text-on-brand' : 'text-secondary'}`}>
                        {item.label}
                      </Text>
                      {count !== undefined ? (
                        <Text
                          className={`overflow-hidden rounded-full px-1.5 py-0.5 text-xs font-bold ${active ? 'bg-on-brand text-brand' : 'bg-surface text-muted-foreground'}`}>
                          {count}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {featured.length ? (
                <View className="mb-7">
                  <View className="mb-3 flex-row flex-wrap items-center justify-between border-b border-border">
                    <Text
                      accessibilityRole="header"
                      className="text-xl font-extrabold text-foreground">
                      Tin nổi bật
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        list.current?.scrollToOffset({
                          offset: latestOffset.current,
                          animated: true,
                        })
                      }
                      className="min-h-11 flex-row items-center gap-1">
                      <Text className="text-sm font-semibold text-primary">Xem tất cả</Text>
                      <Icon name="arrow-forward" size={14} className="text-primary" />
                    </Pressable>
                  </View>
                  <FlatList
                    horizontal
                    data={featured}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <View
                        className="mr-3"
                        style={{ width: width - (featured.length === 1 ? 40 : 72) }}>
                        <ArticleCard article={item} onOpen={openArticle} />
                      </View>
                    )}
                  />
                </View>
              ) : null}
              <View
                className="mb-4 border-b border-border pb-3"
                onLayout={(event) => {
                  latestOffset.current = event.nativeEvent.layout.y;
                }}>
                <Text accessibilityRole="header" className="text-xl font-extrabold text-foreground">
                  Bản tin mới nhất
                </Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Cập nhật liên tục theo từng khu vực và phân khúc.
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <NewsNotice loading title="Đang tải tin tức..." />
            ) : failedPage !== null ? (
              <NewsNotice title="Không thể tải tin tức" onRetry={() => void load()} />
            ) : (
              <NewsNotice title="Không tìm thấy bài viết phù hợp" />
            )
          }
          ListFooterComponent={
            articles.length > 0 &&
            (failedPage !== null || hasMore || articles.length > visibleCount) ? (
              <Pressable
                accessibilityRole="button"
                disabled={loading}
                onPress={more}
                className="items-center rounded-xl bg-brand px-5 py-3">
                <Text className="font-semibold text-on-brand">
                  {loading ? 'Đang tải...' : failedPage !== null ? 'Thử lại' : 'Xem thêm'}
                </Text>
              </Pressable>
            ) : null
          }
        />
      </SafeAreaView>
      {selectedSlug ? (
        <ArticleDetail
          key={selectedSlug}
          slug={selectedSlug}
          onBack={backFromArticle}
          onOpen={openArticle}
          onRecordView={updateViews}
        />
      ) : null}
    </View>
  );
}
