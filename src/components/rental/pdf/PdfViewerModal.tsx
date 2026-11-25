// The ONLY importer of the react-native-pdf-renderer native module. Nothing imports this file yet:
// importing it needs a dev build that contains the module (see docs/yeu-cau-thue/phase1-nav.md).
// Covers web ContractPdfViewerModal (+SignedPdfContent) and the PaymentReceiptActions preview.
// Pinch zoom, double tap and scrolling are native.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import PdfRendererView from 'react-native-pdf-renderer';

import Icon from '@/components/Icon';
import { Button } from '@/components/Screen';
import { sharePdf } from '@/services/rental/files';

const LOADING = 'Đang nạp và kết xuất văn bản hợp đồng (PDF)...';
const LOAD_ERROR = 'Không thể tải nội dung tài liệu.';
const RENDER_ERROR = 'Không thể hiển thị tài liệu trực tiếp';

export type PdfViewerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Contract: the file name. Receipt: "Chứng từ thanh toán". */
  title: string;
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
  subtitle,
  source,
  loadingText = LOADING,
  errorText = LOAD_ERROR,
  closeLabel = 'Đóng',
  shareLabel = 'Tải về',
}: PdfViewerModalProps) {
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
    const discard = (file: string) =>
      void FileSystem.deleteAsync(file, { idempotent: true }).catch(() => {});
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
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          className="h-11 w-11 items-center justify-center">
          <Icon name="close" size={24} className="text-foreground" />
        </Pressable>
        <View className="flex-1">
          <Text numberOfLines={1} accessibilityRole="header" className="font-bold text-foreground">
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={2} className="text-xs text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {uri && !error ? (
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
          <Button label="Đóng" onPress={onClose} />
        </View>
      ) : uri ? (
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
