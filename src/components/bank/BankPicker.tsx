import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Icon from '@/components/Icon';
import BankLogo from '@/components/bank/BankLogo';
import { filterBanks } from '@/lib/bank-account';
import type { Bank } from '@/services/bankAccountApi';

/** Searchable bank dropdown: loading / error+retry states, search by name, short name, code or BIN. */
export default function BankPicker({
  banks,
  value,
  onChange,
  loading = false,
  error = false,
  onRetry,
}: {
  banks: Bank[];
  value: string;
  onChange: (bin: string) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = banks.find((bank) => bank.bin === value) ?? banks[0];
  const list = useMemo(() => filterBanks(banks, query), [banks, query]);

  if (!selected) {
    return error ? (
      <View
        accessibilityRole="alert"
        className="flex-row items-center rounded-xl border border-danger bg-danger-soft px-3 py-2">
        <Text className="flex-1 text-sm text-danger">Không thể tải danh sách ngân hàng.</Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="min-h-9 justify-center px-3">
          <Text className="text-sm font-bold text-danger">Thử lại</Text>
        </Pressable>
      </View>
    ) : (
      <View
        accessibilityLabel="Ngân hàng thụ hưởng"
        accessibilityState={{ busy: loading }}
        className="min-h-12 flex-row items-center rounded-xl border border-border bg-muted px-3">
        <ActivityIndicator size="small" className="text-primary" />
        <Text className="ml-3 text-sm text-muted-foreground">Đang tải danh sách ngân hàng...</Text>
      </View>
    );
  }

  return (
    <View>
      <Pressable
        onPress={() => {
          setQuery('');
          setOpen((isOpen) => !isOpen);
        }}
        accessibilityRole="button"
        accessibilityLabel="Ngân hàng thụ hưởng"
        accessibilityState={{ expanded: open }}
        className="min-h-12 flex-row items-center rounded-xl border border-border bg-background px-3 py-1.5">
        <BankLogo logo={selected.logo} code={selected.code} className="h-8 w-12" />
        <View className="ml-3 min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-bold text-foreground">
            {selected.shortName}
          </Text>
          <Text numberOfLines={1} className="text-xs text-muted-foreground">
            {selected.name}
          </Text>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} className="text-subtle" />
      </Pressable>
      {open ? (
        <View className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
          <View className="flex-row items-center border-b border-border px-3">
            <Icon name="search-outline" size={18} className="text-muted-foreground" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Tìm ngân hàng"
              placeholder="Tìm theo tên, mã ngân hàng..."
              className="min-h-11 flex-1 px-2 text-foreground placeholder:text-subtle"
            />
          </View>
          <ScrollView
            className="max-h-56"
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="p-1">
            {list.length === 0 ? (
              <Text className="px-3 py-6 text-center text-sm text-muted-foreground">
                Không tìm thấy ngân hàng phù hợp.
              </Text>
            ) : null}
            {list.map((bank) => {
              const isSelected = bank.bin === selected.bin;
              return (
                <Pressable
                  key={bank.bin}
                  onPress={() => {
                    onChange(bank.bin);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  className={`min-h-11 flex-row items-center rounded-lg px-2 py-1.5 ${isSelected ? 'bg-muted' : ''}`}>
                  <BankLogo logo={bank.logo} code={bank.code} className="h-8 w-12" />
                  <View className="ml-3 min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm font-bold text-foreground">
                      {bank.shortName}
                    </Text>
                    <Text numberOfLines={1} className="text-xs text-muted-foreground">
                      {bank.name}
                    </Text>
                  </View>
                  {isSelected ? <Icon name="checkmark" size={18} className="text-primary" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
