import { useState } from 'react';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import ChatDocumentViewer from '@/components/chat/ChatDocumentViewer';
import type { ChatAttachment } from '@/services/chatApi';
import { chatAttachmentIcon, chatDocumentFormat, getChatAttachmentViewUrl } from '@/services/chatMediaApi';

export default function ChatDocument({
  conversationId,
  document,
  mine,
}: {
  conversationId: string;
  document: ChatAttachment;
  mine: boolean;
}) {
  const showDialog = useDialog();
  const [opening, setOpening] = useState(false);
  const [preview, setPreview] = useState(false);
  const format = chatDocumentFormat(document);
  const color = mine ? 'text-on-brand' : 'text-primary';
  const size =
    document.sizeBytes >= 1024 * 1024
      ? `${(document.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB`;

  async function open() {
    if (opening) return;
    setOpening(true);
    try {
      const url = await getChatAttachmentViewUrl(conversationId, document.storageId);
      if (
        Platform.OS === 'web' ||
        !FileSystem.cacheDirectory ||
        !(await Sharing.isAvailableAsync())
      ) {
        await Linking.openURL(url);
        return;
      }
      const directory = `${FileSystem.cacheDirectory}chat-${randomUUID()}/`;
      const name = document.fileName.split(/[/\\]/).pop()?.trim();
      const fileName = name && name !== '.' && name !== '..' ? name : 'Tai-lieu';
      await FileSystem.makeDirectoryAsync(directory);
      const file = await FileSystem.downloadAsync(
        url,
        `${directory}${encodeURIComponent(fileName)}`
      );
      if (file.status < 200 || file.status >= 300) throw new Error('Download failed');
      await Sharing.shareAsync(file.uri, {
        mimeType: document.contentType,
        dialogTitle: 'Mở hoặc lưu tài liệu',
      });
    } catch {
      showDialog('Không mở được tệp', 'Vui lòng thử lại.');
    } finally {
      setOpening(false);
    }
  }

  return (<>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${format ? 'Xem' : 'Mở hoặc lưu'} ${document.fileName}`}
      accessibilityState={{ busy: opening, disabled: opening }}
      disabled={opening}
      onPress={() => { if (format) setPreview(true); else void open(); }}
      className={`min-h-12 flex-row items-center gap-2 rounded-xl px-2 py-1 active:opacity-80 ${mine ? 'bg-on-brand/15' : 'bg-primary-soft'}`}>
      <Icon name={chatAttachmentIcon(document)} size={20} className={color} />
      <View className="max-w-[180px] shrink">
        <Text className={`text-xs ${mine ? 'text-on-brand' : 'text-foreground'}`} numberOfLines={2}>
          {document.fileName}
        </Text>
        {document.sizeBytes > 0 ? (
          <Text className={`text-xs ${mine ? 'text-on-brand' : 'text-muted-foreground'}`}>
            {size}
          </Text>
        ) : null}
      </View>
      {opening ? (
        <ActivityIndicator className={color} />
      ) : (
        <Icon name={format ? 'eye-outline' : 'download-outline'} size={16} className={color} />
      )}
    </Pressable>
    {preview && format && <ChatDocumentViewer conversationId={conversationId} document={document} format={format} downloading={opening} onDownload={() => void open()} onClose={() => setPreview(false)} />}
  </>);
}
