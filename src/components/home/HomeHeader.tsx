import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Avatar from '@/components/Avatar';
import { useDialog } from '@/components/AppDialog';
import Ionicons from '@/components/Icon';
import LocationPicker, { type City } from './LocationPicker';

export default function HomeHeader({
  city,
  wardId,
  locationLabel,
  onChangeLocation,
  avatarUri,
  userName,
  onOpenFavorites,
  onOpenMenu,
}: {
  city: City;
  wardId: string;
  locationLabel: string;
  onChangeLocation: (city: City, wardId: string) => void;
  avatarUri?: string | null;
  userName: string;
  onOpenFavorites: () => void;
  onOpenMenu: () => void;
}) {
  const showDialog = useDialog();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View className="border-b border-border bg-surface px-5 pb-3 pt-2">
      <View className="flex-row items-center justify-between gap-2">
        <Image
          source={require('../../../assets/homespace-horizontal-logo.png')}
          resizeMode="contain"
          accessibilityLabel="HomeSpace"
          className="h-10 w-36 shrink"
        />
        <View className="shrink-0 flex-row items-center gap-2">
          <Pressable
            onPress={onOpenFavorites}
            accessibilityRole="button"
            accessibilityLabel="Tin đã yêu thích"
            className="h-12 w-12 items-center justify-center">
            <Ionicons name="heart-outline" size={24} className="text-foreground" />
          </Pressable>
          <Pressable
            onPress={() => showDialog('Thông báo', 'Thông báo chưa hỗ trợ trên ứng dụng')}
            accessibilityRole="button"
            accessibilityLabel="Thông báo"
            className="h-12 w-12 items-center justify-center">
            <Ionicons name="notifications-outline" size={24} className="text-foreground" />
          </Pressable>
          <Pressable
            onPress={onOpenMenu}
            accessibilityRole="button"
            accessibilityLabel="Mở menu tài khoản"
            className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-primary-border bg-brand">
            <Avatar uri={avatarUri} name={userName} size={40} />
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Khu vực: ${locationLabel}. Chạm để đổi`}
        className="mt-2 min-h-12 max-w-full flex-row items-center self-start rounded-full border border-primary-border bg-muted px-3.5">
        <Ionicons name="location" size={16} className="text-primary" />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="mx-1.5 shrink text-left text-sm font-semibold text-foreground">
          {locationLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} className="text-muted-foreground" />
      </Pressable>

      <LocationPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        city={city}
        wardId={wardId}
        onChange={onChangeLocation}
      />
    </View>
  );
}
