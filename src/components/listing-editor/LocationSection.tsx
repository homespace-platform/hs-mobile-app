// Web LocationSection + VietmapAddressPicker: profile address, new Vietmap address or branch.
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, View } from 'react-native';

import { Anchor } from '@/components/rental/contract/anchors';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { chooseAddress, type AddressMode, type ListingAddress } from '@/lib/listing-form';
import type { SavedAddress } from '@/lib/listing-editor';
import {
  ADDRESS_DEBOUNCE_MS,
  ADDRESS_ERROR_MESSAGE,
  ADDRESS_MIN_QUERY,
  createLatest,
} from '@/lib/listing-latest';
import { searchBranchAddress, type AddressSuggestion } from '@/services/branchApi';
import { getLocationPlace } from '@/services/userApi';

import { Chip, ErrorText, Section, TextField, type SectionProps } from './ui';

const failure = (error: unknown) =>
  (isAxiosError<{ message?: string }>(error) && error.response?.data?.message) ||
  ADDRESS_ERROR_MESSAGE;

function AddressSearch({
  value,
  disabled,
  onChange,
}: {
  value: ListingAddress | null;
  disabled: boolean;
  onChange: (value: ListingAddress | null) => void;
}) {
  const [query, setQuery] = useState(value?.display ?? '');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [busy, setBusy] = useState<'' | 'search' | 'select'>('');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const latest = useRef(createLatest());
  const selected = value?.display;

  useEffect(() => {
    const requests = latest.current;
    return () => requests.abort();
  }, []);
  useEffect(() => {
    if (!value) return;
    setQuery(value.display ?? '');
    setSuggestions([]);
    setError('');
  }, [value]);
  useEffect(() => {
    const text = query.trim();
    if (disabled || text.length < ADDRESS_MIN_QUERY || query === selected) return;
    const timer = setTimeout(async () => {
      const request = latest.current.next();
      setBusy('search');
      setError('');
      try {
        const result = await searchBranchAddress(text, request.signal);
        if (!request.isLatest()) return;
        setSuggestions(result);
        setSearched(true);
        setBusy('');
      } catch (cause) {
        if (!request.isLatest()) return;
        setError(failure(cause));
        setBusy('');
      }
    }, ADDRESS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, disabled, selected]);

  function edit(text: string) {
    latest.current.abort();
    setQuery(text);
    setSuggestions([]);
    setBusy('');
    setSearched(false);
    setError('');
    onChange(null);
  }

  async function select(suggestion: AddressSuggestion) {
    Keyboard.dismiss();
    const request = latest.current.next();
    setBusy('select');
    setError('');
    try {
      const result = await getLocationPlace(suggestion.refId, request.signal);
      if (!request.isLatest()) return;
      setQuery(result.display);
      setSuggestions([]);
      setBusy('');
      onChange(result);
    } catch (cause) {
      if (!request.isLatest()) return;
      setError(failure(cause));
      setBusy('');
    }
  }

  return (
    <View className="gap-2">
      <TextField
        label="Địa chỉ"
        value={query}
        onChangeText={edit}
        editable={!disabled}
        maxLength={255}
        autoCorrect={false}
        multiline={disabled}
        placeholder="Nhập tên đường hoặc số nhà…"
      />
      {!disabled && !value ? (
        <Text className="text-xs leading-5 text-muted-foreground">
          Nhập tên đường rồi chọn địa chỉ của bạn trong danh sách gợi ý.
        </Text>
      ) : null}
      {busy ? (
        <View accessibilityRole="progressbar" className="flex-row items-center gap-2">
          <ActivityIndicator size="small" className="text-primary" />
          <Text className="text-xs text-muted-foreground">
            {busy === 'select' ? 'Đang chọn địa chỉ…' : 'Đang tìm gợi ý…'}
          </Text>
        </View>
      ) : null}
      {error ? <ErrorText message={error} /> : null}
      {!disabled && suggestions.length ? (
        <View
          accessibilityLabel="Địa chỉ gợi ý"
          className="overflow-hidden rounded-xl border border-border">
          {suggestions.map((item, index) => (
            <Pressable
              key={`${item.refId}-${index}`}
              disabled={busy === 'select'}
              onPress={() => void select(item)}
              accessibilityRole="button"
              className={`min-h-12 justify-center bg-surface px-3 py-2 ${index ? 'border-t border-border' : ''} ${busy === 'select' ? 'opacity-50' : ''}`}>
              <Text className="text-sm text-foreground">{item.display}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!disabled && searched && !busy && !error && !value && !suggestions.length ? (
        <Text className="text-xs text-muted-foreground">
          Chưa tìm thấy địa chỉ. Thử thêm số nhà hoặc tên khu vực.
        </Text>
      ) : null}
      {value && !disabled ? (
        <Text className="text-xs text-primary">Đã chọn địa chỉ. Bạn có thể lưu thay đổi.</Text>
      ) : null}
    </View>
  );
}

export default function LocationSection({
  state,
  update,
  errors,
  savedAddress,
}: SectionProps & { savedAddress: SavedAddress }) {
  const branch = Boolean(state.basicInfo.branchId);
  const mode = (addressMode: AddressMode) => update((s) => ({ ...s, addressMode }));

  return (
    <Section title="Vị trí" description="Chọn địa chỉ từ Vietmap.">
      <Anchor id="streetLine" className="gap-3">
        {!branch ? (
          <View className="flex-row flex-wrap gap-2">
            {savedAddress ? (
              <Chip
                label="Dùng địa chỉ hồ sơ"
                selected={state.addressMode === 'saved'}
                onPress={() => mode('saved')}
              />
            ) : null}
            <Chip
              label="Chọn địa chỉ mới"
              selected={state.addressMode === 'new'}
              onPress={() => mode('new')}
            />
          </View>
        ) : null}
        {state.addressMode === 'saved' && savedAddress && !branch ? (
          <View className="gap-3 rounded-xl border border-border bg-background p-3">
            <Text className="text-sm leading-5 text-foreground">{savedAddress.display}</Text>
            <PolicyNotice
              title="Địa chỉ của tin đăng"
              summary="Địa chỉ được sao chép riêng cho tin đăng."
              text="Địa chỉ được sao chép riêng cho tin đăng, không liên kết thay đổi với địa chỉ hồ sơ."
            />
          </View>
        ) : (
          <AddressSearch
            value={state.selectedAddress?.refId ? state.selectedAddress : null}
            disabled={branch}
            onChange={(address) =>
              update((s) => ({ ...s, selectedAddress: chooseAddress(s.selectedAddress, address) }))
            }
          />
        )}
        {state.addressMode === 'new' && !branch && state.selectedAddress?.refId ? (
          <TextField
            label="Ghi chú vị trí"
            value={state.selectedAddress.addressNote ?? ''}
            onChangeText={(addressNote) =>
              update((s) => ({ ...s, selectedAddress: { ...s.selectedAddress, addressNote } }))
            }
            maxLength={255}
            placeholder="Tầng, lối vào hoặc mốc gần nhà"
          />
        ) : null}
        {branch ? (
          <Text className="text-sm text-muted-foreground">Địa chỉ theo chi nhánh đã chọn.</Text>
        ) : null}
        <ErrorText message={errors.streetLine} />
      </Anchor>
    </Section>
  );
}
