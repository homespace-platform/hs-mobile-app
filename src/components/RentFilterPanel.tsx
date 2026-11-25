import { useMemo, useState, type ReactNode } from 'react';
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
import Icon from '@/components/Icon';
import { matchesProvince } from '@/lib/location-search';
import {
  ACCESS_OPTIONS,
  AREA_OPTIONS,
  BATHS_OPTIONS,
  BEDS_OPTIONS,
  DIRECTION_OPTIONS,
  FURNISHING_OPTIONS,
  KITCHEN_OPTIONS,
  LEGAL_OPTIONS,
  MAX_PRICE,
  PRICE_PRESETS,
  RESTROOM_OPTIONS,
  activeFilterCount,
  visibleSections,
  type RentFilter,
  type RentOption,
} from '@/lib/rent-filter';
import provinces from '@/data/provinces.json';
import wardsCatalog from '@/data/wards.json';

type Province = (typeof provinces)[number];
const WARDS = Object.values(wardsCatalog) as {
  code: string;
  name_with_type: string;
  parent_code: string;
}[];

export function Chip({
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
      className={`mb-2 mr-2 min-h-10 justify-center rounded-full border px-4 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
      <Text className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-secondary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="mt-5">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase text-foreground">{title}</Text>
        {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Options({
  options,
  value,
  onChange,
}: {
  options: RentOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap">
      {options.map((item) => (
        <Chip
          key={item.id}
          label={item.label}
          selected={value === item.id}
          onPress={() => onChange(item.id)}
        />
      ))}
    </View>
  );
}

function PriceInput({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View className="min-h-16 flex-1 rounded-xl border border-border px-3 py-2">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <View className="flex-row items-center">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          maxLength={3}
          placeholder={placeholder}
          accessibilityLabel={`Giá ${label.toLowerCase()} (triệu)`}
          className="min-h-9 flex-1 text-base font-bold text-primary placeholder:text-subtle"
        />
        <Text className="text-sm font-semibold text-primary">triệu</Text>
      </View>
    </View>
  );
}

function LocationPicker({
  city,
  wardId,
  onChange,
}: {
  city: Province;
  wardId: string;
  onChange: (city: Province, wardId: string) => void;
}) {
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [wardOpen, setWardOpen] = useState(false);
  const [wardQuery, setWardQuery] = useState('');
  const wards = useMemo(() => WARDS.filter((ward) => ward.parent_code === city.code), [city.code]);
  const selectedWard = wards.find((ward) => ward.code === wardId);
  return (
    <View>
      <Pressable
        onPress={() => setCityOpen(!cityOpen)}
        accessibilityRole="button"
        className="min-h-12 flex-row items-center rounded-xl border border-border px-3">
        <Icon name="location-outline" size={20} className="text-primary" />
        <Text className="ml-2 flex-1 font-semibold text-foreground">{city.name}</Text>
        <Icon name={cityOpen ? 'chevron-up' : 'chevron-down'} size={18} className="text-subtle" />
      </Pressable>
      {cityOpen ? (
        <View className="mt-2 rounded-xl border border-border bg-surface p-2">
          <TextInput
            value={cityQuery}
            onChangeText={setCityQuery}
            placeholder="Tìm tỉnh/thành"
            className="min-h-11 rounded-lg bg-muted px-3 text-foreground placeholder:text-subtle"
          />
          <ScrollView nestedScrollEnabled className="max-h-56" keyboardShouldPersistTaps="handled">
            {provinces
              .filter((item) => matchesProvince(item.name, cityQuery))
              .map((item) => (
                <Pressable
                  key={item.code}
                  onPress={() => {
                    if (item.code !== city.code) onChange(item, '');
                    setWardQuery('');
                    setCityOpen(false);
                  }}
                  className="min-h-11 justify-center border-b border-border px-3">
                  <Text className="text-foreground">{item.name}</Text>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      ) : null}
      <Pressable
        onPress={() => setWardOpen(!wardOpen)}
        accessibilityRole="button"
        className="mt-2 min-h-12 flex-row items-center rounded-xl border border-border px-3">
        <Text className="flex-1 text-sm text-foreground">
          {selectedWard?.name_with_type ?? 'Tất cả phường/xã'}
        </Text>
        <Icon name={wardOpen ? 'chevron-up' : 'chevron-down'} size={18} className="text-subtle" />
      </Pressable>
      {wardOpen ? (
        <View className="mt-2 rounded-xl border border-border bg-surface p-2">
          <TextInput
            value={wardQuery}
            onChangeText={setWardQuery}
            placeholder="Tìm phường/xã"
            className="min-h-11 rounded-lg bg-muted px-3 text-foreground placeholder:text-subtle"
          />
          <ScrollView nestedScrollEnabled className="max-h-56" keyboardShouldPersistTaps="handled">
            <Pressable
              onPress={() => {
                onChange(city, '');
                setWardOpen(false);
              }}
              className="min-h-11 justify-center border-b border-border px-3">
              <Text className="text-primary">Tất cả phường/xã</Text>
            </Pressable>
            {wards
              .filter((ward) => matchesProvince(ward.name_with_type, wardQuery))
              .map((ward) => (
                <Pressable
                  key={ward.code}
                  onPress={() => {
                    onChange(city, ward.code);
                    setWardOpen(false);
                  }}
                  className="min-h-11 justify-center border-b border-border px-3">
                  <Text className="text-foreground">{ward.name_with_type}</Text>
                </Pressable>
              ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/** Advanced filters, same groups/labels/order as the web RentFilterSidebar (category chips live outside). */
export default function RentFilterPanel({
  visible,
  onClose,
  draft,
  onChange,
  city,
  wardId,
  onLocationChange,
  onReset,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  draft: RentFilter;
  onChange: (patch: Partial<RentFilter>) => void;
  city: Province;
  wardId: string;
  onLocationChange: (city: Province, wardId: string) => void;
  onReset: () => void;
  onApply: () => void;
}) {
  const insets = useSafeAreaInsets();
  const sections = visibleSections(draft.category);
  const show = (name: (typeof sections)[number]) => sections.includes(name);
  const count = activeFilterCount(draft);
  const setMin = (text: string) => {
    const value = text === '' ? 0 : Number(text);
    if (Number.isInteger(value) && value >= 0 && value <= MAX_PRICE) onChange({ minPrice: value });
  };
  const setMax = (text: string) => {
    const value = text === '' ? MAX_PRICE : Number(text);
    if (Number.isInteger(value) && value >= 0 && value <= MAX_PRICE) onChange({ maxPrice: value });
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-overlay/65">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng bộ lọc"
          className="absolute inset-0"
        />
        <View accessibilityViewIsModal className="h-[88%] rounded-t-3xl bg-surface">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-1">
            <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
              Bộ lọc
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              className="h-11 w-11 items-center justify-center">
              <Icon name="close" size={22} className="text-secondary" />
            </Pressable>
          </View>
          <ScrollView
            className="flex-1 px-4"
            contentContainerClassName="pb-4 pt-3"
            keyboardShouldPersistTaps="handled">
            <Text className="text-xs font-bold uppercase text-foreground">Khu vực</Text>
            <View className="mt-2">
              <LocationPicker city={city} wardId={wardId} onChange={onLocationChange} />
            </View>

            {show('price') ? (
              <Group title="Khoảng giá thuê" hint="(đ/tháng)">
                <View className="flex-row gap-3">
                  <PriceInput
                    label="Tối thiểu"
                    value={draft.minPrice === 0 ? '' : String(draft.minPrice)}
                    placeholder="0"
                    onChangeText={setMin}
                  />
                  <PriceInput
                    label="Tối đa"
                    value={draft.maxPrice >= MAX_PRICE ? '' : String(draft.maxPrice)}
                    placeholder="100+"
                    onChangeText={setMax}
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  className="mt-3">
                  {PRICE_PRESETS.map((preset) => (
                    <Chip
                      key={preset}
                      label={preset === 0 ? '0' : `${preset} tr`}
                      selected={false}
                      // Same rule as the web preset labels: below max sets min, otherwise sets max.
                      onPress={() =>
                        onChange(
                          preset < draft.maxPrice ? { minPrice: preset } : { maxPrice: preset }
                        )
                      }
                    />
                  ))}
                </ScrollView>
              </Group>
            ) : null}

            {show('area') ? (
              <Group title="Diện tích">
                <Options
                  options={AREA_OPTIONS}
                  value={draft.areaRange}
                  onChange={(areaRange) => onChange({ areaRange })}
                />
              </Group>
            ) : null}
            {show('beds') ? (
              <Group title="Số phòng ngủ">
                <Options
                  options={BEDS_OPTIONS}
                  value={draft.beds}
                  onChange={(beds) => onChange({ beds })}
                />
              </Group>
            ) : null}
            {show('baths') ? (
              <Group title="Số phòng tắm / WC">
                <Options
                  options={BATHS_OPTIONS}
                  value={draft.baths}
                  onChange={(baths) => onChange({ baths })}
                />
              </Group>
            ) : null}
            {show('furnishing') ? (
              <Group title="Tình trạng nội thất">
                <Options
                  options={FURNISHING_OPTIONS}
                  value={draft.furnishingStatus}
                  onChange={(furnishingStatus) => onChange({ furnishingStatus })}
                />
              </Group>
            ) : null}
            {show('direction') ? (
              <>
                <Group title="Hướng cửa chính">
                  <Options
                    options={DIRECTION_OPTIONS}
                    value={draft.direction}
                    onChange={(direction) => onChange({ direction })}
                  />
                </Group>
                <Group title="Hướng ban công">
                  <Options
                    options={DIRECTION_OPTIONS}
                    value={draft.balconyDirection}
                    onChange={(balconyDirection) => onChange({ balconyDirection })}
                  />
                </Group>
              </>
            ) : null}
            {show('legal') ? (
              <Group title="Giấy tờ pháp lý">
                <Options
                  options={LEGAL_OPTIONS}
                  value={draft.legalStatus}
                  onChange={(legalStatus) => onChange({ legalStatus })}
                />
              </Group>
            ) : null}
            {show('houseFeatures') ? (
              <Group title="Tiện ích kiến trúc">
                <View className="flex-row flex-wrap">
                  <Chip
                    label="Có sân thượng"
                    selected={draft.hasRooftop}
                    onPress={() => onChange({ hasRooftop: !draft.hasRooftop })}
                  />
                  <Chip
                    label="Có garage để xe"
                    selected={draft.hasGarage}
                    onPress={() => onChange({ hasGarage: !draft.hasGarage })}
                  />
                </View>
                <Text className="mb-2 mt-1 text-xs font-bold uppercase text-muted-foreground">
                  Lối đi
                </Text>
                <Options
                  options={ACCESS_OPTIONS}
                  value={draft.accessType}
                  onChange={(accessType) => onChange({ accessType })}
                />
              </Group>
            ) : null}
            {show('roomFeatures') ? (
              <>
                <Group title="Nhà vệ sinh">
                  <Options
                    options={RESTROOM_OPTIONS}
                    value={draft.restroomType}
                    onChange={(restroomType) => onChange({ restroomType })}
                  />
                </Group>
                <Group title="Khu vực bếp">
                  <Options
                    options={KITCHEN_OPTIONS}
                    value={draft.kitchenType}
                    onChange={(kitchenType) => onChange({ kitchenType })}
                  />
                  <View className="flex-row flex-wrap">
                    <Chip
                      label="Phòng có gác lửng"
                      selected={draft.hasMezzanine}
                      onPress={() => onChange({ hasMezzanine: !draft.hasMezzanine })}
                    />
                  </View>
                </Group>
              </>
            ) : null}
          </ScrollView>
          <View
            className="flex-row gap-2 border-t border-border px-4 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            <Pressable
              onPress={onReset}
              accessibilityRole="button"
              className="min-h-12 flex-row items-center justify-center rounded-xl border border-border px-4">
              <Icon name="refresh" size={16} className="text-secondary" />
              <Text className="ml-1.5 font-semibold text-secondary">Đặt lại</Text>
            </Pressable>
            <Pressable
              onPress={onApply}
              accessibilityRole="button"
              className="min-h-12 flex-1 flex-row items-center justify-center rounded-xl bg-brand px-4">
              <Icon name="search" size={16} className="text-on-brand" />
              <Text className="ml-1.5 font-bold text-on-brand">Áp dụng bộ lọc</Text>
              {count > 0 ? (
                <View className="ml-2 min-w-5 items-center rounded-full bg-on-brand px-1.5">
                  <Text className="text-xs font-extrabold text-brand">{count}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
