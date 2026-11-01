import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { useDialog } from '@/components/AppDialog';
import { ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import { VIETNAMESE_BANKS } from '@/data/banks';
import {
  createBankAccount,
  deleteBankAccount,
  getBankAccount,
  getBankAccounts,
  setBankAccountDefaults,
  updateBankAccount,
  type BankAccountInput,
  type BankAccount,
} from '@/services/bankAccountApi';

export default function PaymentSettingsScreen({ onBack }: { onBack: () => void }) {
  const showDialog = useDialog();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDefaults, setEditingDefaults] = useState<{
    defaultForIncomingPayments: boolean;
    defaultForRefunds: boolean;
  } | null>(null);
  const [bankQuery, setBankQuery] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [bank, setBank] = useState(VIETNAMESE_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState('');
  const [holder, setHolder] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await getBankAccounts());
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setEditingDefaults(null);
    setAccountNumber('');
    setHolder('');
    setBank(VIETNAMESE_BANKS[0]);
    setBankQuery('');
    setBankOpen(false);
  }

  async function save() {
    if (!accountNumber.trim() || !holder.trim()) {
      setError('Vui lòng nhập số tài khoản và tên chủ tài khoản.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input: BankAccountInput = {
        bankBin: bank.bin,
        bankCode: bank.code,
        bankName: bank.name,
        accountNumber: accountNumber.trim(),
        accountHolderName: holder.trim().toUpperCase(),
        defaultForIncomingPayments: editingDefaults?.defaultForIncomingPayments ?? true,
        defaultForRefunds: editingDefaults?.defaultForRefunds ?? true,
      };
      if (editingId) await updateBankAccount(editingId, input);
      else await createBankAccount(input);
      closeForm();
      await load();
      showDialog(
        editingId ? 'Đã cập nhật tài khoản' : 'Đã thêm tài khoản',
        'Tài khoản sẽ được dùng để nhận tiền thuê và hoàn cọc.',
        undefined,
        'success'
      );
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function viewAccount(item: BankAccount) {
    try {
      const account = await getBankAccount(item.id);
      showDialog(
        'Thông tin tài khoản',
        `${account.bankName}\n${account.accountHolderName}\n${account.accountNumber}`
      );
    } catch (cause) {
      setError(apiError(cause));
    }
  }

  async function editAccount(item: BankAccount) {
    setBusy(true);
    setError(null);
    try {
      const account = await getBankAccount(item.id);
      setEditingId(account.id);
      setEditingDefaults({
        defaultForIncomingPayments: account.defaultForIncomingPayments,
        defaultForRefunds: account.defaultForRefunds,
      });
      setBank(
        VIETNAMESE_BANKS.find((entry) => entry.bin === account.bankBin) ?? {
          bin: account.bankBin,
          code: account.bankCode,
          name: account.bankName,
          shortName: account.bankCode,
        }
      );
      setAccountNumber(account.accountNumber);
      setHolder(account.accountHolderName);
      setFormOpen(true);
      setBankOpen(false);
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(item: BankAccount) {
    setBusy(true);
    setError(null);
    try {
      await deleteBankAccount(item.id);
      await load();
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(item: BankAccount) {
    showDialog('Xóa tài khoản?', `Xóa tài khoản ${item.bankCode} • ${item.accountNumber}?`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => void removeAccount(item) },
    ]);
  }

  function showAccountActions(item: BankAccount) {
    showDialog(`Tài khoản ${item.bankCode}`, 'Chọn thao tác với tài khoản ngân hàng này.', [
      { text: 'Xem số tài khoản', onPress: () => void viewAccount(item) },
      { text: 'Chỉnh sửa', onPress: () => void editAccount(item) },
      {
        text: 'Xóa tài khoản',
        style: 'destructive',
        onPress: () => confirmRemove(item),
      },
      { text: 'Đóng', style: 'cancel' },
    ]);
  }

  async function setDefault(id: string, kind: 'incoming' | 'refund') {
    setBusy(true);
    setError(null);
    try {
      await setBankAccountDefaults(
        id,
        kind === 'incoming' ? { defaultForIncomingPayments: true } : { defaultForRefunds: true }
      );
      await load();
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Cài đặt thanh toán" onBack={onBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-5 pb-10 pt-5">
        <View className="rounded-2xl border border-primary-border bg-primary-soft p-4">
          <View className="flex-row items-start">
            <Icon name="information-circle-outline" size={21} className="mt-0.5 text-primary" />
            <Text className="ml-2 flex-1 text-sm leading-5 text-secondary">
              HomeSpace dùng số tài khoản để người thuê chuyển tiền trực tiếp cho chủ nhà và hoàn
              cọc. HomeSpace không giữ tiền.
            </Text>
          </View>
        </View>
        <View className="mt-6 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground">Tài khoản ngân hàng</Text>
          {!formOpen ? (
            <Pressable
              onPress={() => setFormOpen(true)}
              className="min-h-10 flex-row items-center rounded-xl bg-brand px-3">
              <Icon name="add" size={18} className="text-on-brand" />
              <Text className="ml-1 font-semibold text-on-brand">Thêm</Text>
            </Pressable>
          ) : null}
        </View>
        <ErrorNotice message={error} />
        {loading ? (
          <ActivityIndicator className="my-8 text-primary" />
        ) : accounts.length ? (
          accounts.map((item) => (
            <SwipeAccountCard
              key={item.id}
              busy={busy}
              onDelete={() => confirmRemove(item)}
              onLongPress={() => showAccountActions(item)}>
              <View className="flex-row items-center">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                  <Text className="text-xs font-black text-primary">{item.bankCode}</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-bold text-foreground">{item.bankName}</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">
                    {item.accountHolderName}
                  </Text>
                </View>
                <Icon name="card-outline" size={20} className="text-primary" />
              </View>
              <Text className="mt-3 font-mono text-base font-bold tracking-widest text-foreground">
                {item.accountNumber}
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {item.defaultForIncomingPayments ? (
                  <View className="min-h-8 justify-center rounded-full bg-success-soft px-3">
                    <Text className="text-xs font-semibold text-success">
                      Nhận thanh toán mặc định
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    disabled={busy}
                    onPress={() => void setDefault(item.id, 'incoming')}
                    className="min-h-8 justify-center rounded-full bg-muted px-3">
                    <Text className="text-xs font-semibold text-secondary">
                      Đặt nhận tiền mặc định
                    </Text>
                  </Pressable>
                )}
                {item.defaultForRefunds ? (
                  <View className="min-h-8 justify-center rounded-full bg-primary-soft px-3">
                    <Text className="text-xs font-semibold text-primary">Hoàn cọc mặc định</Text>
                  </View>
                ) : (
                  <Pressable
                    disabled={busy}
                    onPress={() => void setDefault(item.id, 'refund')}
                    className="min-h-8 justify-center rounded-full bg-muted px-3">
                    <Text className="text-xs font-semibold text-secondary">
                      Đặt hoàn cọc mặc định
                    </Text>
                  </Pressable>
                )}
              </View>
            </SwipeAccountCard>
          ))
        ) : !error ? (
          <View className="mt-3 rounded-2xl border border-dashed border-border p-6">
            <Text className="text-center font-semibold text-foreground">
              Chưa có tài khoản ngân hàng
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              Thêm tài khoản để nhận tiền thuê hoặc tiền hoàn cọc trực tiếp.
            </Text>
          </View>
        ) : null}
        {formOpen ? (
          <View className="mt-5 rounded-2xl border border-border bg-surface p-4">
            <Text className="text-base font-bold text-foreground">
              {editingId ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản'}
            </Text>
            <Pressable
              onPress={() => setBankOpen((value) => !value)}
              className="mt-4 min-h-12 flex-row items-center rounded-xl border border-border px-3">
              <Text className="flex-1 text-sm font-semibold text-foreground">
                {bank.shortName} · {bank.name}
              </Text>
              <Icon
                name={bankOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                className="text-subtle"
              />
            </Pressable>
            {bankOpen ? (
              <View className="mt-2 rounded-xl border border-border p-2">
                <TextInput
                  value={bankQuery}
                  onChangeText={setBankQuery}
                  placeholder="Tìm ngân hàng"
                  className="min-h-11 rounded-lg bg-muted px-3 text-foreground placeholder:text-subtle"
                />
                <ScrollView className="max-h-48" nestedScrollEnabled>
                  {VIETNAMESE_BANKS.filter((item) =>
                    `${item.name} ${item.shortName} ${item.code}`
                      .toLowerCase()
                      .includes(bankQuery.toLowerCase())
                  ).map((item) => (
                    <Pressable
                      key={item.bin}
                      onPress={() => {
                        setBank(item);
                        setBankOpen(false);
                      }}
                      className="min-h-11 justify-center border-b border-border px-2">
                      <Text className="text-sm text-foreground">
                        {item.shortName} · {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <Field
              label="Số tài khoản"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              placeholder="Nhập số tài khoản"
              maxLength={30}
            />
            <Field
              label="Tên chủ tài khoản"
              value={holder}
              onChangeText={setHolder}
              autoCapitalize="characters"
              placeholder="Nhập đúng tên trên tài khoản"
              maxLength={120}
            />
            <Text className="mt-3 text-xs leading-5 text-muted-foreground">
              Thông tin được mã hóa khi lưu và chỉ dùng cho các khoản thanh toán, hoàn cọc.
            </Text>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                disabled={busy}
                onPress={closeForm}
                className="min-h-12 flex-1 items-center justify-center rounded-xl border border-border">
                <Text className="font-semibold text-secondary">Hủy</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => void save()}
                className="min-h-12 flex-1 items-center justify-center rounded-xl bg-brand">
                <Text className="font-bold text-on-brand">
                  {busy ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Lưu tài khoản'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SwipeAccountCard({
  children,
  busy,
  onDelete,
  onLongPress,
}: {
  children: React.ReactNode;
  busy: boolean;
  onDelete: () => void;
  onLongPress: () => void;
}) {
  const offset = useRef(new Animated.Value(0)).current;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderMove: (_, gesture) => offset.setValue(Math.max(-88, Math.min(0, gesture.dx))),
        onPanResponderRelease: (_, gesture) => {
          Animated.spring(offset, {
            toValue: gesture.dx < -38 ? -88 : 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [offset]
  );

  return (
    <View className="mt-3 overflow-hidden rounded-2xl bg-danger-soft">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xóa tài khoản ngân hàng"
        disabled={busy}
        onPress={onDelete}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 88,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="bg-danger-soft">
        <Icon name="trash-outline" size={22} className="text-danger" />
        <Text className="mt-1 text-xs font-bold text-danger">Xóa</Text>
      </Pressable>
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateX: offset }], paddingBottom: 24 }}
        className="rounded-2xl border border-border bg-surface p-4">
        <Pressable onLongPress={onLongPress} delayLongPress={400}>
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
