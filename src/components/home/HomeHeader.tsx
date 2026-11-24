import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Avatar from '@/components/Avatar';
import { useDialog } from '@/components/AppDialog';
import Ionicons from '@/components/Icon';
import LocationPicker, { type City } from './LocationPicker';

/** Home-only header: logo alone on top; below it the area chip (opens the picker sheet) and favorites/notifications/avatar. */
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
      <Image
        source={require('../../../assets/homespace-horizontal-logo.png')}
        resizeMode="contain"
        accessibilityLabel="HomeSpace"
        className="h-10 w-36"
      />

      <View className="mt-2 flex-row items-center">
        {/* Half-width chip; long names are cut with an ellipsis instead of widening it. */}
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Khu vực: ${locationLabel}. Chạm để đổi`}
          style={{ width: '50%' }}
          className="min-h-11 flex-row items-center rounded-full border border-primary-border bg-muted px-3.5">
          <Ionicons name="location" size={16} className="text-primary" />
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="mx-1.5 flex-1 text-left text-sm font-semibold text-foreground">
            {locationLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} className="text-muted-foreground" />
        </Pressable>
        <View className="flex-1" />
        <Pressable
          onPress={onOpenFavorites}
          accessibilityRole="button"
          accessibilityLabel="Tin đã yêu thích"
          className="h-11 w-11 items-center justify-center">
          <Ionicons name="heart-outline" size={24} className="text-foreground" />
        </Pressable>
        <Pressable
          onPress={() => showDialog('Thông báo', 'Thông báo chưa hỗ trợ trên ứng dụng')}
          accessibilityRole="button"
          accessibilityLabel="Thông báo"
          className="h-11 w-11 items-center justify-center">
          <Ionicons name="notifications-outline" size={24} className="text-foreground" />
        </Pressable>
        <Pressable
          onPress={onOpenMenu}
          accessibilityRole="button"
          accessibilityLabel="Mở menu tài khoản"
          className="ml-1 h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-primary-border bg-brand">
          <Avatar uri={avatarUri} name={userName} size={40} />
        </Pressable>
      </View>

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
