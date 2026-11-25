// The ONLY importer of the react-native-pdf-renderer native module. It is required lazily, so an app
// build without the module still starts and only this viewer says it cannot draw the file.
// Covers web ContractPdfViewerModal (+SignedPdfContent) and the PaymentReceiptActions preview.
// Pinch zoom, double tap and scrolling are native.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type PdfRendererViewType from 'react-native-pdf-renderer';

import Icon from '@/components/Icon';
import { Button } from '@/components/Screen';
import { discardRentalFile } from '@/services/rental/cache';
import { sharePdf } from '@/services/rental/files';

const LOADING = 'Đang nạp và kết xuất văn bản hợp đồng (PDF)...';
const LOAD_ERROR = 'Không thể tải nội dung tài liệu.';
const RENDER_ERROR = 'Không thể hiển thị tài liệu trực tiếp';
const MODULE_MISSING =
  'Bản ứng dụng đang cài chưa có trình xem PDF. Hãy cài bản ứng dụng mới nhất, hoặc dùng nút tải/chia sẻ ở góc trên để mở tệp bằng ứng dụng khác.';

function loadRenderer(): typeof PdfRendererViewType | null {
  try {
    // Without the native view, drawing it would crash (old architecture) or show a blank box.
    if (!UIManager.hasViewManagerConfig('RNPdfRendererView')) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-pdf-renderer').default;
  } catch {
    return null;
  }
}

export type PdfViewerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Contract: the file name. Receipt: "Chứng từ thanh toán". */
  title: string;
  documentType?: string;
  subtitle?: string;
  /**
   * A local file:// URI (the caller owns the file), or a loader that downloads into the app cache and
   * returns its URI (the viewer owns that file and deletes it on close).
   */
  source: string | ((signal: AbortSignal) => Promise<string>);
  /** Identity of the loaded document (web `${doc.id}:${doc.revisionId}`): required to switch loaders. */
  documentKey?: string;
  loadingText?: string;
  /** Used when the loader's error has no message. */
  errorText?: string;
  closeLabel?: string;
  shareLabel?: string;
  /** Screen-reader name of the whole viewer. */
  label?: string;
  /** Web "Mở liên kết ngoài" on the error screen: a URL the browser can open by itself. */
  externalUrl?: string;
};

// Android opens the string as a plain path; iOS parses it as a URL and needs it still encoded.
function nativeSource(uri: string) {
  if (Platform.OS !== 'android') return uri;
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

function Viewer({
  onClose,
  title,
  documentType,
  subtitle,
  source,
  loadingText = LOADING,
  errorText = LOAD_ERROR,
  closeLabel = 'Đóng',
  shareLabel = 'Tải về',
  label,
  externalUrl,
}: PdfViewerModalProps) {
  const [PdfRendererView] = useState(loadRenderer);
  const sourceRef = useRef(source);
  const [attempt, setAttempt] = useState(0);
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [page, setPage] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    const request = new AbortController();
    let owned: string | undefined;
    const discard = (file: string) => void discardRentalFile(file);
    const current = sourceRef.current;
    setUri(null);
    setError(null);
    setPage(null);
    if (typeof current === 'string') setUri(current);
    else
      current(request.signal).then(
        (file) => {
          if (request.signal.aborted) return discard(file);
          owned = file;
          setUri(file);
        },
        (cause: unknown) => {
          if (!request.signal.aborted)
            setError((cause instanceof Error && cause.message) || errorText);
        }
      );
    return () => {
      request.abort();
      if (owned) discard(owned);
    };
  }, [attempt, errorText]);

  async function share(file: string) {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      await sharePdf(file);
    } catch (cause) {
      setShareError((cause instanceof Error && cause.message) || errorText);
    } finally {
      setSharing(false);
    }
  }

  return (
    <SafeAreaView
      accessibilityLabel={label}
      accessibilityViewIsModal
      className="flex-1 bg-background"
      edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          className="h-11 w-11 items-center justify-center">
          <Icon name="close" size={24} className="text-foreground" />
        </Pressable>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              numberOfLines={1}
              accessibilityRole="header"
              className="shrink font-bold text-foreground">
              {title}
            </Text>
            {documentType ? (
              <Text className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {documentType}
              </Text>
            ) : null}
          </View>
          {subtitle ? (
            <Text numberOfLines={2} className="text-xs text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {/* As web, the file stays downloadable when only the drawing failed. */}
        {uri ? (
          <Pressable
            onPress={() => void share(uri)}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityLabel={shareLabel}
            accessibilityState={{ disabled: sharing }}
            className="h-11 w-11 items-center justify-center">
            <Icon name="share-outline" size={22} className="text-primary" />
          </Pressable>
        ) : null}
      </View>
      {shareError ? (
        <Text accessibilityRole="alert" className="px-4 py-2 text-sm text-danger">
          {shareError}
        </Text>
      ) : null}
      {error ? (
        <View className="flex-1 justify-center gap-3 px-6">
          <Text accessibilityRole="alert" className="text-center font-bold text-foreground">
            {RENDER_ERROR}
          </Text>
          <Text className="text-center text-sm text-muted-foreground">{error}</Text>
          <Button label="Thử lại" onPress={() => setAttempt((n) => n + 1)} />
          {externalUrl ? (
            <Button
              label="Mở liên kết ngoài"
              onPress={() =>
                void WebBrowser.openBrowserAsync(externalUrl).catch(() => setShareError(errorText))
              }
            />
          ) : null}
          <Button label="Đóng" onPress={onClose} />
        </View>
      ) : uri && !PdfRendererView ? (
        <View className="flex-1 justify-center gap-3 px-6">
          <Text accessibilityRole="alert" className="text-center font-bold text-foreground">
            {RENDER_ERROR}
          </Text>
          <Text className="text-center text-sm leading-6 text-muted-foreground">
            {MODULE_MISSING}
          </Text>
          <Button label="Đóng" onPress={onClose} />
        </View>
      ) : uri && PdfRendererView ? (
        <View className="flex-1">
          <PdfRendererView
            style={{ flex: 1 }}
            source={nativeSource(uri)}
            onPageChange={(position, total) => setPage({ current: position + 1, total })}
            onError={() => setError(errorText)}
          />
          {page && page.total > 0 && page.current > 0 ? (
            <Text className="bg-surface py-2 text-center text-xs text-muted-foreground">
              Trang {page.current} / {page.total}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <ActivityIndicator className="text-primary" />
          <Text accessibilityLiveRegion="polite" className="text-center text-muted-foreground">
            {loadingText}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function PdfViewerModal(props: PdfViewerModalProps) {
  return (
    <Modal visible={props.isOpen} animationType="slide" onRequestClose={props.onClose}>
      {props.isOpen ? (
        <Viewer
          key={props.documentKey ?? (typeof props.source === 'string' ? props.source : 'loader')}
          {...props}
        />
      ) : null}
    </Modal>
  );
}
