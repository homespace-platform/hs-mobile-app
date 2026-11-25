import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { fetch } from 'expo/fetch';
import { Buffer } from 'buffer';

import Icon from '@/components/Icon';
import type { ChatAttachment } from '@/services/chatApi';
import { getChatAttachmentViewUrl } from '@/services/chatMediaApi';

const viewerAsset = require('../../../assets/generated-chat-document-preview.html');
const chunkSize = 64 * 1024;
const previewErrors = {
  asset: 'Không tải được trình xem tài liệu.',
  download: 'Không tải được tệp đính kèm.',
  renderer: 'Không thể hiển thị nội dung tệp.',
  timeout: 'Mở tài liệu mất quá nhiều thời gian.',
};

export default function ChatDocumentViewer({
  conversationId,
  document,
  format,
  downloading,
  onDownload,
  onClose,
}: {
  conversationId: string;
  document: ChatAttachment;
  format: 'pdf' | 'docx' | 'doc';
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  const [localUri, setLocalUri] = useState<string>();
  const [failed, setFailed] = useState<keyof typeof previewErrors>();
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [rendered, setRendered] = useState(false);
  const native = useRef<WebView>(null);
  const web = useRef<HTMLIFrameElement>(null);
  const fileBytes = useRef<ArrayBuffer>(undefined);
  const { storageId, fileName } = document;

  const send = useCallback((value: object) => {
    const message = JSON.stringify(value);
    if (Platform.OS === 'web') web.current?.contentWindow?.postMessage(message, '*');
    else native.current?.postMessage(message);
  }, []);

  const onPreviewMessage = useCallback(
    (message: unknown) => {
      if (message === 'ready') setReady(true);
      else if (message === 'rendered') {
        fileBytes.current = undefined;
        setRendered(true);
      } else if (message === 'failed') {
        setFailed('renderer');
      } else if (typeof message === 'string' && message.startsWith('read:')) {
        const offset = Number(message.slice(5));
        const bytes = fileBytes.current;
        if (!bytes || !Number.isSafeInteger(offset) || offset < 0 || offset >= bytes.byteLength)
          return;
        const length = Math.min(chunkSize, bytes.byteLength - offset);
        send({
          type: 'chunk',
          offset,
          data: Buffer.from(bytes, offset, length).toString('base64'),
        });
      }
    },
    [send]
  );

  useEffect(() => {
    let active = true;
    if (Platform.OS !== 'web') {
      void Asset.fromModule(viewerAsset)
        .downloadAsync()
        .then((asset) => {
          if (!asset.localUri) throw new Error('Preview asset missing');
          if (active) setLocalUri(asset.localUri);
        })
        .catch(() => {
          if (active) setFailed('asset');
        });
    }
    return () => {
      active = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const receive = (event: MessageEvent) => {
      if (event.source !== web.current?.contentWindow) return;
      onPreviewMessage(event.data);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onPreviewMessage]);

  useEffect(() => {
    if (rendered || failed) return;
    const timer = setTimeout(() => setFailed('timeout'), 35_000);
    return () => clearTimeout(timer);
  }, [attempt, rendered, failed]);

  useEffect(() => {
    if (!ready || failed) return;
    const request = new AbortController();
    void (async () => {
      const source = await getChatAttachmentViewUrl(conversationId, storageId);
      const response = await fetch(source, { signal: request.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Attachment fetch failed');
      const bytes = await response.arrayBuffer();
      if (request.signal.aborted) return;
      fileBytes.current = bytes;
      send({ type: 'begin', format, size: bytes.byteLength });
    })().catch(() => {
      if (!request.signal.aborted) setFailed('download');
    });
    return () => {
      request.abort();
      fileBytes.current = undefined;
    };
  }, [conversationId, failed, format, ready, send, storageId]);

  return (
    <Modal animationType="fade" onRequestClose={onClose}>
      <SafeAreaView accessibilityViewIsModal className="flex-1 bg-background">
        <View className="flex-row items-center gap-2 border-b border-border px-3">
          <Text numberOfLines={1} className="flex-1 font-semibold text-foreground">
            {fileName}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải xuống"
            accessibilityState={{ busy: downloading, disabled: downloading }}
            onPress={onDownload}
            disabled={downloading}
            className="h-12 w-12 items-center justify-center">
            {downloading ? (
              <ActivityIndicator className="text-primary" />
            ) : (
              <Icon name="download-outline" size={22} className="text-primary" />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng tài liệu"
            onPress={onClose}
            className="h-12 w-12 items-center justify-center">
            <Icon name="close" size={24} className="text-foreground" />
          </Pressable>
        </View>
        {failed ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text accessibilityRole="alert" className="text-center text-foreground">
              {previewErrors[failed]}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLocalUri(undefined);
                setReady(false);
                setRendered(false);
                setFailed(undefined);
                setAttempt((value) => value + 1);
              }}
              className="min-h-12 justify-center px-4">
              <Text className="font-semibold text-primary">Thử lại</Text>
            </Pressable>
          </View>
        ) : Platform.OS === 'web' ? (
          createElement('iframe', {
            key: attempt,
            ref: web,
            src: Asset.fromModule(viewerAsset).uri,
            sandbox: 'allow-scripts',
            title: fileName,
            referrerPolicy: 'no-referrer',
            style: { flex: 1, width: '100%', border: 0 },
          })
        ) : localUri ? (
          <WebView
            key={attempt}
            ref={native}
            source={{ uri: localUri }}
            allowFileAccess
            allowingReadAccessToURL={localUri}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={({ url }) =>
              url === localUri || url === 'about:blank' || url === 'about:srcdoc'
            }
            onMessage={({ nativeEvent }) => onPreviewMessage(nativeEvent.data)}
            onError={() => setFailed('asset')}
            onContentProcessDidTerminate={() => setFailed('renderer')}
            startInLoadingState
            renderLoading={() => (
              <ActivityIndicator
                accessibilityLabel="Đang tải bản xem trước"
                className="bg-background p-4 text-primary"
              />
            )}
            accessibilityLabel={fileName}
            incognito
            style={{ flex: 1 }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator
              accessibilityLabel="Đang tải bản xem trước"
              className="text-primary"
            />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
