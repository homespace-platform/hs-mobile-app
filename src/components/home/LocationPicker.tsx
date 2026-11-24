import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@/components/Icon';
import { matchesProvince } from '@/lib/location-search';
import { wardsOfCity } from '@/lib/wards';
import provinces from '@/data/provinces.json';

export type City = (typeof provinces)[number];

function Row({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`min-h-12 flex-row items-center rounded-xl px-3 py-3 ${selected ? 'bg-primary-soft' : ''}`}>
      <Text className={`flex-1 text-sm ${selected ? 'font-bold text-primary' : 'text-foreground'}`}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={20} className="text-primary" /> : null}
    </Pressable>
  );
}

/** Province -> ward/commune bottom sheet (mobile counterpart of the web header location dropdown). */
export default function LocationPicker({
  visible,
  onClose,
  city,
  wardId,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  city: City;
  wardId: string;
  onChange: (city: City, wardId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'city' | 'ward'>('ward');
  const [query, setQuery] = useState('');
  const wards = useMemo(() => wardsOfCity(city.code), [city.code]);

  useEffect(() => {
    if (visible) {
      setStep('ward');
      setQuery('');
    }
  }, [visible]);

  const visibleCities = provinces.filter((item) => matchesProvince(item.name, query));
  const visibleWards = wards.filter((ward) => matchesProvince(ward.name_with_type, query));
  const shortCityName = city.name.replace('Thành phố ', '').replace('Tỉnh ', '');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-overlay/65">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng bảng chọn khu vực"
          className="absolute inset-0"
        />
        <View
          accessibilityViewIsModal
          className="h-[75%] rounded-t-3xl bg-surface px-4 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <View className="flex-row items-center justify-between">
            <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
              {step === 'city' ? 'Chọn tỉnh/thành phố' : 'Chọn khu vực'}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              className="h-11 w-11 items-center justify-center">
              <Ionicons name="close" size={22} className="text-secondary" />
            </Pressable>
          </View>

          {step === 'ward' ? (
            <Pressable
              onPress={() => {
                setStep('city');
                setQuery('');
              }}
              accessibilityRole="button"
              accessibilityLabel={`Đổi tỉnh, đang chọn ${city.name}`}
              className="mt-1 min-h-11 flex-row items-center rounded-xl bg-muted px-3">
              <Ionicons name="chevron-back" size={16} className="text-muted-foreground" />
              <Text className="ml-1 flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                {city.name}
              </Text>
              <Text className="text-sm font-bold text-primary">Đổi tỉnh</Text>
            </Pressable>
          ) : null}

          <View className="mt-3 flex-row items-center rounded-xl bg-muted px-3">
            <Ionicons name="search-outline" size={18} className="text-subtle" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={step === 'city' ? 'Tìm tỉnh thành...' : 'Tìm phường/xã...'}
              autoCorrect={false}
              className="ml-2 min-h-11 flex-1 text-sm text-foreground selection:text-primary placeholder:text-subtle"
            />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            className="mt-2">
            {step === 'city' ? (
              visibleCities.length ? (
                visibleCities.map((item) => (
                  <Row
                    key={item.code}
                    label={item.name}
                    selected={item.code === city.code}
                    onPress={() => {
                      onChange(item, item.code === city.code ? wardId : '');
                      setStep('ward');
                      setQuery('');
                    }}
                  />
                ))
              ) : (
                <Text className="px-4 py-5 text-center text-sm text-muted-foreground">
                  Không tìm thấy tỉnh/thành phù hợp.
                </Text>
              )
            ) : (
              <>
                <Row
                  label={`Toàn ${shortCityName}`}
                  selected={!wardId}
                  onPress={() => {
                    onChange(city, '');
                    onClose();
                  }}
                />
                {visibleWards.map((ward) => (
                  <Row
                    key={ward.code}
                    label={ward.name_with_type}
                    selected={ward.code === wardId}
                    onPress={() => {
                      onChange(city, ward.code);
                      onClose();
                    }}
                  />
                ))}
                {!visibleWards.length ? (
                  <Text className="px-4 py-5 text-center text-sm text-muted-foreground">
                    Không tìm thấy phường/xã phù hợp.
                  </Text>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
