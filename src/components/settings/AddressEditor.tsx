import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { isAxiosError } from 'axios';
import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { Button, Field } from '@/components/Screen';
import { refreshOnboarding } from '@/lib/onboarding-store';
import { mapUrl } from '@/lib/profile-form';
import { searchBranchAddress, type AddressSuggestion } from '@/services/branchApi';
import { getLocationPlace, saveUserAddress } from '@/services/userApi';
import type { UserAddress, VietmapAddress } from '@/types/api';

function failure(error: unknown, fallback: string) {
  const message = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : null;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

// Counterpart of web AddressEditor + VietmapAddressPicker (Vietmap autocomplete -> place -> PUT address).
export default function AddressEditor({
  initialAddress,
  onSaved,
}: {
  initialAddress?: UserAddress | null;
  onSaved: () => Promise<void> | void;
}) {
  const showDialog = useDialog();
  const [selected, setSelected] = useState<VietmapAddress | null>(initialAddress ?? null);
  const [query, setQuery] = useState(initialAddress?.display ?? '');
  const [note, setNote] = useState(initialAddress?.addressNote ?? '');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sequence = useRef(0);
  const selectedDisplay = selected?.display;

  const latest = useRef(initialAddress);
  latest.current = initialAddress;
  // Reset only when the saved address really changes, not on every profile refresh.
  useEffect(() => {
    const address = latest.current;
    sequence.current++;
    setSelected(address ?? null);
    setQuery(address?.display ?? '');
    setNote(address?.addressNote ?? '');
    setSuggestions([]);
    setDirty(false);
  }, [initialAddress?.refId, initialAddress?.display, initialAddress?.addressNote]);

  useEffect(() => {
    const text = query.trim();
    if (saving || text.length < 2 || query === selectedDisplay) return;
    const controller = new AbortController();
    const id = ++sequence.current;
    const live = () => !controller.signal.aborted && id === sequence.current;
    const timer = setTimeout(async () => {
      if (!live()) return;
      setBusy(true);
      setError('');
      try {
        const result = await searchBranchAddress(text, controller.signal);
        if (live()) {
          setSuggestions(result);
          setSearched(true);
        }
      } catch (e) {
        if (live()) setError(failure(e, 'Không thể tìm địa chỉ. Vui lòng thử lại.'));
      } finally {
        if (live()) setBusy(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, saving, selectedDisplay, attempt]);

  function edit(text: string) {
    sequence.current++;
    setQuery(text);
    setSuggestions([]);
    setBusy(false);
    setResolving(false);
    setSearched(false);
    setError('');
    setSelected(null);
    setDirty(true);
  }

  async function select(suggestion: AddressSuggestion) {
    if (resolving) return;
    const id = ++sequence.current;
    setBusy(true);
    setResolving(true);
    setError('');
    try {
      const result = await getLocationPlace(suggestion.refId);
      if (id === sequence.current) {
        setSelected(result);
        setQuery(result.display);
        setSuggestions([]);
        setDirty(true);
      }
    } catch (e) {
      if (id === sequence.current) setError(failure(e, 'Không thể tìm địa chỉ. Vui lòng thử lại.'));
    } finally {
      if (id === sequence.current) {
        setBusy(false);
        setResolving(false);
      }
    }
  }

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = await saveUserAddress(selected.refId, note.trim() || undefined);
      setSelected(saved);
      setQuery(saved.display);
      setNote(saved.addressNote ?? '');
      setDirty(false);
      showDialog('Thành công', 'Đã lưu địa chỉ.', undefined, 'success');
      void refreshOnboarding();
      await onSaved();
    } catch (e) {
      setError(failure(e, 'Không thể lưu địa chỉ. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  }

  const map = mapUrl(selected?.latitude, selected?.longitude);
  return (
    <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
      <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
        Địa chỉ hiện tại
      </Text>
      <Field
        label="Địa chỉ"
        value={query}
        onChangeText={edit}
        editable={!saving}
        maxLength={255}
        autoCorrect={false}
        placeholder="Nhập tên đường hoặc số nhà…"
      />
      {!saving && !selected ? (
        <Text className="mt-2 text-xs text-muted-foreground">
          Nhập tên đường rồi chọn địa chỉ của bạn trong danh sách gợi ý.
        </Text>
      ) : null}
      {busy ? (
        <View accessibilityRole="progressbar" className="mt-2 flex-row items-center">
          <ActivityIndicator size="small" className="text-primary" />
          <Text className="ml-2 text-xs text-muted-foreground">
            {resolving ? 'Đang chọn địa chỉ…' : 'Đang tìm gợi ý…'}
          </Text>
        </View>
      ) : null}
      {error ? (
        <View className="mt-2 flex-row items-center">
          <Text accessibilityRole="alert" className="flex-1 text-sm text-danger">
            {error}
          </Text>
          {query.trim().length >= 2 && !selected ? (
            <Pressable onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button">
              <Text className="px-2 text-xs font-bold text-primary">Thử lại</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!saving && suggestions.length > 0 ? (
        <View
          accessibilityLabel="Địa chỉ gợi ý"
          className="mt-2 overflow-hidden rounded-xl border border-border">
          {suggestions.map((item, index) => (
            <Pressable
              key={`${item.refId}-${index}`}
              disabled={resolving}
              onPress={() => void select(item)}
              accessibilityRole="button"
              className={`bg-surface p-3 ${index > 0 ? 'border-t border-border' : ''} ${resolving ? 'opacity-50' : ''}`}>
              <Text className="text-sm text-foreground">{item.display}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!saving && searched && !busy && !error && !selected && suggestions.length === 0 ? (
        <Text className="mt-2 text-xs text-muted-foreground">
          Chưa tìm thấy địa chỉ. Thử thêm số nhà hoặc tên khu vực.
        </Text>
      ) : null}
      {selected ? (
        <Text className="mt-2 text-xs text-primary">Đã chọn địa chỉ. Bạn có thể lưu thay đổi.</Text>
      ) : null}
      <Field
        label="Thông tin bổ sung (căn/phòng, tầng…)"
        value={note}
        onChangeText={(value) => {
          setNote(value);
          setDirty(true);
        }}
        editable={!saving}
        maxLength={255}
      />
      <Button
        label={saving ? 'Đang lưu…' : 'Lưu địa chỉ'}
        onPress={() => void save()}
        busy={saving}
        disabled={!selected || (!dirty && Boolean(initialAddress))}
      />
      {map ? (
        <Pressable
          onPress={() => void Linking.openURL(map)}
          accessibilityRole="link"
          className="mt-3 flex-row items-center self-start">
          <Icon name="map-outline" size={16} className="text-primary" />
          <Text className="ml-1.5 text-sm font-semibold text-primary">
            Xem vị trí trên Google Maps
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
