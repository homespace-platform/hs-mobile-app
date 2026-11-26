// Web BasicInfoSection media pickers, plus the per-file upload state of a running save.
import * as ImagePicker from 'expo-image-picker';
import { useRef } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { Anchor } from '@/components/rental/contract/anchors';
import ActionButton from '@/components/rental/shared/ActionButton';
import type { ListingMediaItem } from '@/lib/listing-form';
import {
  addPickedMedia,
  MAX_IMAGES,
  MAX_VIDEOS,
  mediaSlotsLeft,
  removeMedia,
  type ListingMediaKind,
} from '@/lib/listing-media';
import { listingImage } from '@/services/listingApi';

import { ErrorText, FieldLabel, RemoveButton, type SectionProps } from './ui';

export default function MediaField({
  state,
  update,
  errors,
  saving,
}: SectionProps & { saving: boolean }) {
  const showDialog = useDialog();
  const picking = useRef(false);
  const { images, videos } = state.basicInfo;
  // Files upload one by one, images first: the first one still without an id is the current one.
  const current = [...images, ...videos].find((item) => item.file && !item.storageObjectId);

  async function pick(kind: ListingMediaKind) {
    if (picking.current) return;
    picking.current = true;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Cần cấp quyền thư viện ảnh để chọn tệp.');
      const left = mediaSlotsLeft(state.basicInfo, kind);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'IMAGE' ? ['images'] : ['videos'],
        allowsMultipleSelection: true,
        selectionLimit: left,
        quality: 0.85,
      });
      if (result.canceled) return;
      const rejected = addPickedMedia(state.basicInfo, kind, result.assets).errors;
      update((s) => ({
        ...s,
        basicInfo: addPickedMedia(s.basicInfo, kind, result.assets).basicInfo,
      }));
      if (rejected.length) showDialog('Không thể thêm tệp', rejected.join('\n'));
    } catch (error) {
      showDialog(
        'Không thể chọn tệp',
        error instanceof Error ? error.message : 'Vui lòng thử lại.'
      );
    } finally {
      picking.current = false;
    }
  }

  const remove = (kind: ListingMediaKind, index: number) =>
    update((s) => ({ ...s, basicInfo: removeMedia(s.basicInfo, kind, index) }));

  function status(item: ListingMediaItem) {
    if (!item.file) return null;
    if (item.storageObjectId)
      return <Text className="text-xs font-semibold text-success">Đã tải lên</Text>;
    if (!saving) return <Text className="text-xs text-muted-foreground">Chưa tải lên</Text>;
    return item === current ? (
      <View className="flex-row items-center gap-1">
        <ActivityIndicator size="small" className="text-primary" />
        <Text className="text-xs font-semibold text-primary">Đang tải lên</Text>
      </View>
    ) : (
      <Text className="text-xs text-muted-foreground">Chờ tải lên</Text>
    );
  }

  return (
    <>
      <Anchor id="images" className="gap-2">
        <FieldLabel text={`Hình ảnh (${images.length}/${MAX_IMAGES}) *`} />
        <ActionButton
          label={images.length ? 'Thêm ảnh khác' : 'Chọn tải ảnh lên'}
          icon="images-outline"
          disabled={images.length >= MAX_IMAGES}
          onClick={() => void pick('IMAGE')}
        />
        {images.length ? (
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {images.map((image, index) => (
              <View
                key={`${image.uri}-${index}`}
                className="w-[48%] overflow-hidden rounded-xl border border-border bg-surface">
                <Image
                  source={{ uri: image.file ? image.uri : listingImage(image.uri) }}
                  accessibilityLabel={`Ảnh ${index + 1}`}
                  resizeMode="cover"
                  className="h-28 w-full bg-muted"
                />
                <View className="flex-row items-center gap-2 py-1.5 pl-2 pr-1.5">
                  <View className="flex-1">
                    <Text numberOfLines={1} className="text-xs font-bold text-foreground">
                      {index === 0 ? 'Ảnh bìa' : `Ảnh ${index + 1}`}
                    </Text>
                    {status(image)}
                  </View>
                  <RemoveButton
                    label={`Xóa ảnh ${index + 1}`}
                    onPress={() => remove('IMAGE', index)}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <ErrorText message={errors.images} />
        <Text className="text-xs leading-5 text-muted-foreground">
          Tối thiểu 1, tối đa {MAX_IMAGES} ảnh. Ảnh đầu là ảnh bìa. Hỗ trợ JPG, PNG, WEBP (tối đa
          25MB/ảnh).
        </Text>
      </Anchor>

      <View className="gap-2">
        <FieldLabel text={`Video (${videos.length}/${MAX_VIDEOS})`} />
        <ActionButton
          label={videos.length ? 'Thêm video khác' : 'Chọn tải video'}
          icon="videocam-outline"
          variant="secondary"
          disabled={videos.length >= MAX_VIDEOS}
          onClick={() => void pick('VIDEO')}
        />
        {videos.map((video, index) => (
          <View
            key={`${video.uri}-${index}`}
            className="flex-row items-center gap-2 rounded-xl border border-border bg-surface py-1.5 pl-3 pr-1.5">
            <Icon name="videocam-outline" size={20} className="text-primary" />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-sm font-semibold text-foreground">
                {video.file ? video.name : `Video ${index + 1} (đã có trên tin)`}
              </Text>
              {status(video)}
            </View>
            <RemoveButton label={`Xóa video ${index + 1}`} onPress={() => remove('VIDEO', index)} />
          </View>
        ))}
        <Text className="text-xs leading-5 text-muted-foreground">
          Không bắt buộc, tối đa {MAX_VIDEOS} video. Hỗ trợ MP4, WebM, MOV (tối đa 500MB và 2
          phút/video).
        </Text>
      </View>
    </>
  );
}
