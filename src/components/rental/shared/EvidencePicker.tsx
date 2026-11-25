// Evidence / proof files: web <input type="file">. Uploading stays with @/services/rental/storage.service.
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { discardPickedCopy } from '@/services/rental/cache';
import type { LocalFile } from '@/services/storageApi';

import ActionButton from './ActionButton';
import FieldFrame from './FieldFrame';
import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_TYPES,
  fileSelectionError,
  fileSizeLabel,
  normalizeFile,
  type FileMessages,
} from './logic';

type Picked = Parameters<typeof normalizeFile>[0];
type Source = 'camera' | 'library' | 'document';

// Quality must stay below 1: at 1 Android copies the original bytes, so HEIC would stay HEIC.
// "Compatible" makes iOS hand over JPEG instead of HEIC.
const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.9,
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

const fromImage = (asset: ImagePicker.ImagePickerAsset): Picked => ({
  uri: asset.uri,
  fileName: asset.fileName,
  mimeType: asset.mimeType,
});

/** The picker's reported size can describe the original, so the size is read from the file. */
async function localFile(asset: Picked) {
  const info = await FileSystem.getInfoAsync(asset.uri);
  return normalizeFile({
    ...asset,
    sizeBytes: info.exists && !info.isDirectory ? info.size : 0,
  });
}

export default function EvidencePicker({
  label,
  ariaLabel,
  value,
  onChange,
  messages,
  types = EVIDENCE_TYPES,
  namePattern,
  maxBytes = EVIDENCE_MAX_BYTES,
  maxCount = 1,
  existingCount = 0,
  replace = false,
  onError,
  onPickingChange,
  camera = false,
  libraryLabel = 'Chọn ảnh',
  documentLabel = 'Chọn tệp',
  cameraLabel = 'Chụp ảnh',
  disabled,
  hint,
  error,
  className,
}: {
  label?: string;
  ariaLabel?: string;
  value: LocalFile[];
  onChange: (files: LocalFile[]) => void;
  /** The web's rejection wording for this screen. */
  messages: FileMessages;
  /** Accepted MIME types. */
  types?: readonly string[];
  /** Also require the file name to match. */
  namePattern?: RegExp;
  maxBytes?: number;
  /** 1 replaces the file on each pick; more appends unless `replace`. */
  maxCount?: number;
  /** Files already stored that count towards maxCount. */
  existingCount?: number;
  /** Each pick replaces the whole list (web `<input type="file" multiple>`). */
  replace?: boolean;
  /** A refused or failed pick (the web's toast). The message is also shown under the field. */
  onError?: (message: string) => void;
  /** True from opening a picker until its selection is handled: lock submit meanwhile. */
  onPickingChange?: (picking: boolean) => void;
  camera?: boolean;
  libraryLabel?: string;
  documentLabel?: string;
  cameraLabel?: string;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
}) {
  const showDialog = useDialog();
  const [pickError, setPickError] = useState('');
  const [picking, setPicking] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  // Ends the running pick for the caller, once: when it finishes or when the field goes away.
  const release = useRef<(() => void) | null>(null);
  const endPick = () => {
    release.current?.();
    release.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      release.current?.();
      release.current = null;
    };
  }, []);
  const multiple = maxCount > 1;
  const appends = multiple && !replace;
  // A list that gets replaced does not count towards the limit.
  const kept = existingCount + (appends ? value.length : 0);
  const room = maxCount - kept;
  const off = Boolean(disabled || picking || room <= 0);
  const images = types.some((type) => type.startsWith('image/'));

  const fail = (message: string) => {
    setPickError(message);
    onError?.(message);
  };

  async function assetsFrom(source: Source): Promise<Picked[]> {
    if (source === 'document') {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...types],
        multiple,
        copyToCacheDirectory: true,
      });
      return result.canceled
        ? []
        : result.assets.map((a) => ({ uri: a.uri, fileName: a.name, mimeType: a.mimeType }));
    }
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!alive.current) return [];
      if (!permission.granted) {
        showDialog('Thông báo', 'Cần cấp quyền camera để chụp ảnh.', [
          { text: 'Đóng', style: 'cancel' },
          { text: 'Mở cài đặt', onPress: () => void Linking.openSettings() },
        ]);
        return [];
      }
      const shot = await ImagePicker.launchCameraAsync(IMAGE_OPTIONS);
      return shot.canceled ? [] : shot.assets.map(fromImage);
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_OPTIONS,
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
    });
    return result.canceled ? [] : result.assets.map(fromImage);
  }

  async function pick(source: Source) {
    if (lock.current) return;
    lock.current = true;
    setPicking(true);
    onPickingChange?.(true);
    release.current = () => onPickingChange?.(false);
    let assets: Picked[] = [];
    let handedOver = false;
    try {
      assets = await assetsFrom(source);
      if (!assets.length) return;
      const files = await Promise.all(assets.map(localFile));
      // A field that is gone must not hand over a late selection (the caller may upload it).
      if (!alive.current) return;
      const rules = { types, namePattern, maxBytes, maxCount };
      const refused = fileSelectionError(files, kept, rules, messages);
      if (refused) return fail(refused);
      setPickError('');
      onChange(appends ? [...value, ...files] : files);
      handedOver = true;
    } catch (cause) {
      if (!alive.current) return;
      fail(cause instanceof Error && cause.message ? cause.message : 'Không thể chọn tệp.');
    } finally {
      // Refused, unreadable or late: nobody holds these copies.
      if (!handedOver) assets.forEach((asset) => void discardPickedCopy(asset.uri));
      lock.current = false;
      endPick();
      if (alive.current) setPicking(false);
    }
  }

  return (
    <FieldFrame label={label} hint={hint} error={error || pickError} className={className}>
      <View accessibilityLabel={ariaLabel ?? label} className="gap-2">
        {value.map((file) => (
          <View
            key={file.uri}
            className="flex-row items-center gap-3 rounded-xl border border-border bg-surface py-2 pl-2">
            {file.contentType.startsWith('image/') ? (
              <Image
                source={{ uri: file.uri }}
                accessibilityIgnoresInvertColors
                className="h-12 w-12 rounded-lg bg-muted"
              />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Icon name="document-text-outline" size={22} className="text-muted-foreground" />
              </View>
            )}
            <View className="flex-1">
              <Text numberOfLines={2} className="text-sm font-semibold text-foreground">
                {file.fileName}
              </Text>
              <Text className="text-xs text-muted-foreground">{fileSizeLabel(file.sizeBytes)}</Text>
            </View>
            <Pressable
              onPress={() => {
                setPickError('');
                onChange(value.filter((item) => item.uri !== file.uri));
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Gỡ tệp ${file.fileName}`}
              className={`h-11 w-11 items-center justify-center ${disabled ? 'opacity-40' : ''}`}>
              <Icon name="close-circle" size={22} className="text-muted-foreground" />
            </Pressable>
          </View>
        ))}
        <View className="flex-row flex-wrap gap-2">
          {images ? (
            <ActionButton
              label={libraryLabel}
              icon="images-outline"
              variant="secondary"
              disabled={off}
              onClick={() => void pick('library')}
              className="grow"
            />
          ) : null}
          {images && camera ? (
            <ActionButton
              label={cameraLabel}
              icon="camera-outline"
              variant="secondary"
              disabled={off}
              onClick={() => void pick('camera')}
              className="grow"
            />
          ) : null}
          <ActionButton
            label={documentLabel}
            icon="attach-outline"
            variant="secondary"
            disabled={off}
            busy={picking}
            onClick={() => void pick('document')}
            className="grow"
          />
        </View>
      </View>
    </FieldFrame>
  );
}
