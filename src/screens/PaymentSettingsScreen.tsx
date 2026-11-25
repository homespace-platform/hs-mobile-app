import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { useDialog } from '@/components/AppDialog';
import BankAccountCard from '@/components/bank/BankAccountCard';
import BankLogo from '@/components/bank/BankLogo';
import BankPicker from '@/components/bank/BankPicker';
import { PolicyNotice } from '@/components/PolicyDialog';
import { ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import {
  bankFormError,
  cleanAccountNumber,
  cleanHolderName,
  withExtraBank,
} from '@/lib/bank-account';
import {
  createBankAccount,
  deleteBankAccount,
  getBankAccount,
  getBankAccounts,
  getBanks,
  setBankAccountDefaults,
  updateBankAccount,
  type Bank,
  type BankAccount,
  type BankAccountInput,
} from '@/services/bankAccountApi';
import { refreshOnboarding } from '@/lib/onboarding-store';

// Full account number stays in memory only this long (same as web).
const REVEAL_MS = 30000;

/** Bank catalog: `banks` is empty until loaded; `error` is set on failure until `retry`. */
function useBanks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getBanks().then(
      (list) => {
        if (active) setBanks(list);
      },
      () => {
        if (active) setError(true);
      }
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setError(false);
    setAttempt((n) => n + 1);
  }, []);
  return { banks, loading: !error && banks.length === 0, error, retry };
}

type Editing = { id: string; lockIncoming: boolean; lockRefund: boolean };

export default function PaymentSettingsScreen({ onBack }: { onBack: () => void }) {
  const showDialog = useDialog();
  const scrollRef = useRef<ScrollView>(null);
  const scrollToForm = useRef(false);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { banks, loading: banksLoading, error: banksError, retry: retryBanks } = useBanks();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [extraBank, setExtraBank] = useState<Bank | null>(null);
  const [selectedBin, setSelectedBin] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [defaultIncoming, setDefaultIncoming] = useState(true);
  const [defaultRefund, setDefaultRefund] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const editReq = useRef(0);

  const [revealed, setRevealed] = useState<{ id: string; number: string } | null>(null);
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emptyState = !loading && !loadError && accounts.length === 0 && !formOpen;
  const bankList = withExtraBank(banks, extraBank);
  const selectedBank = bankList.find((bank) => bank.bin === selectedBin) ?? bankList[0];

  const hideNumber = useCallback(() => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = null;
    setRevealed(null);
  }, []);
  // Re-mask on unmount and whenever the app leaves the foreground.
  useEffect(() => hideNumber, [hideNumber]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') hideNumber();
    });
    return () => sub.remove();
  }, [hideNumber]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      setAccounts(await getBankAccounts());
    } catch (cause) {
      setLoadError(apiError(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setSelectedBin('');
    setExtraBank(null);
    setAccountNumber('');
    setHolder('');
    setDefaultIncoming(true);
    setDefaultRefund(true);
    setFormError(null);
  }

  function closeForm() {
    editReq.current++;
    setFormOpen(false);
    setEditing(null);
    setLoadingEdit(false);
    resetForm();
  }

  function openAdd() {
    editReq.current++;
    resetForm();
    setEditing(null);
    setLoadingEdit(false);
    scrollToForm.current = true;
    setFormOpen(true);
  }

  async function openEdit(account: BankAccount) {
    const token = ++editReq.current;
    resetForm();
    setNotice(null);
    setEditing({
      id: account.id,
      lockIncoming: account.defaultForIncomingPayments,
      lockRefund: account.defaultForRefunds,
    });
    setLoadingEdit(true);
    scrollToForm.current = true;
    setFormOpen(true);
    try {
      const full = await getBankAccount(account.id);
      if (token !== editReq.current) return;
      setExtraBank({
        bin: full.bankBin,
        code: full.bankCode,
        name: full.bankName,
        shortName: full.bankCode,
        logo: null,
      });
      setSelectedBin(full.bankBin);
      setAccountNumber(full.accountNumber);
      setHolder(full.accountHolderName);
      setDefaultIncoming(full.defaultForIncomingPayments);
      setDefaultRefund(full.defaultForRefunds);
      setLoadingEdit(false);
    } catch (cause) {
      if (token !== editReq.current) return;
      closeForm();
      setNotice(apiError(cause));
    }
  }

  async function toggleReveal(id: string) {
    if (revealed?.id === id) {
      hideNumber();
      return;
    }
    setRevealingId(id);
    setNotice(null);
    try {
      const full = await getBankAccount(id);
      hideNumber();
      setRevealed({ id, number: full.accountNumber });
      revealTimer.current = setTimeout(hideNumber, REVEAL_MS);
    } catch (cause) {
      setNotice(apiError(cause));
    } finally {
      setRevealingId(null);
    }
  }

  async function save() {
    const message = bankFormError(accountNumber, holder, !!selectedBank);
    if (message || !selectedBank) {
      setFormError(message);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const input: BankAccountInput = {
        bankBin: selectedBank.bin,
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
        accountNumber: accountNumber.trim(),
        accountHolderName: holder.trim().toUpperCase(),
        defaultForIncomingPayments: defaultIncoming,
        defaultForRefunds: defaultRefund,
      };
      if (editing) {
        await updateBankAccount(editing.id, input);
        hideNumber();
      } else {
        await createBankAccount(input);
      }
      const wasEditing = !!editing;
      closeForm();
      showDialog(
        wasEditing ? 'Đã cập nhật tài khoản' : 'Đã thêm tài khoản',
        wasEditing ? 'Đã cập nhật tài khoản ngân hàng.' : 'Thêm tài khoản ngân hàng thành công.',
        undefined,
        'success'
      );
      void refreshOnboarding();
      await load(true);
    } catch (cause) {
      setFormError(apiError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    setNotice(null);
    try {
      await action();
      showDialog('Thành công', success, undefined, 'success');
      void refreshOnboarding();
      await load(true);
    } catch (cause) {
      setNotice(apiError(cause));
    } finally {
      setBusyId(null);
    }
  }

  function setDefault(id: string, kind: 'incoming' | 'refund') {
    const incoming = kind === 'incoming';
    void runAction(
      id,
      () =>
        setBankAccountDefaults(
          id,
          incoming ? { defaultForIncomingPayments: true } : { defaultForRefunds: true }
        ),
      incoming
        ? 'Đã đặt làm tài khoản mặc định nhận thanh toán.'
        : 'Đã đặt làm tài khoản mặc định nhận hoàn tiền.'
    );
  }

  function confirmRemove(account: BankAccount) {
    showDialog('Xóa tài khoản?', 'Bạn có chắc chắn muốn xóa/vô hiệu hóa tài khoản ngân hàng này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          if (revealed?.id === account.id) hideNumber();
          void runAction(
            account.id,
            () => deleteBankAccount(account.id),
            'Đã xóa tài khoản thành công.'
          );
        },
      },
    ]);
  }

  const addButton = (
    <Pressable
      onPress={openAdd}
      accessibilityRole="button"
      className="min-h-10 flex-row items-center rounded-xl bg-brand px-3">
      <Icon name="add" size={18} className="text-on-brand" />
      <Text className="ml-1 font-semibold text-on-brand">Thêm tài khoản</Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Tài khoản ngân hàng" onBack={onBack} />
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-10 pt-5">
        <View className="flex-row items-start justify-between">
          <Text className="min-w-0 flex-1 text-sm text-muted-foreground">
            Quản lý tài khoản nhận thanh toán tiền thuê hoặc nhận tiền hoàn cọc trực tiếp.
          </Text>
          {!formOpen && !emptyState ? <View className="ml-3">{addButton}</View> : null}
        </View>
        <PolicyNotice
          className="mt-4"
          title="Nguyên tắc thanh toán trực tiếp"
          actionLabel="Xem nguyên tắc"
          summary="HomeSpace không giữ tiền: cọc và tiền thuê chuyển trực tiếp giữa người thuê và chủ nhà."
          icon="shield-checkmark-outline">
          <Text className="text-sm leading-6 text-secondary">
            HomeSpace <Text className="font-bold">KHÔNG</Text> phải ví điện tử hay cổng trung gian
            thanh toán, <Text className="font-bold">KHÔNG</Text> thu nhận hay giữ tiền của người
            dùng. Mọi khoản tiền cọc và tiền thuê được chuyển khoản{' '}
            <Text className="font-bold">trực tiếp</Text> giữa tài khoản ngân hàng của người thuê và
            chủ nhà thông qua VietQR / Mobile Banking.
          </Text>
        </PolicyNotice>
        <ErrorNotice message={notice} />

        {loading ? (
          <View className="mt-4 min-h-40 flex-row items-center justify-center rounded-2xl border border-border bg-surface">
            <ActivityIndicator className="text-primary" />
            <Text className="ml-2 text-sm text-muted-foreground">
              Đang tải danh sách tài khoản...
            </Text>
          </View>
        ) : loadError ? (
          <View
            accessibilityRole="alert"
            className="mt-4 rounded-2xl border border-danger bg-danger-soft p-4">
            <Text className="text-sm text-danger">{loadError}</Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              className="mt-3 min-h-10 items-center justify-center self-start rounded-xl bg-danger-solid px-4">
              <Text className="text-xs font-semibold text-on-danger-solid">Thử lại</Text>
            </Pressable>
          </View>
        ) : accounts.length === 0 ? (
          emptyState ? (
            <View className="mt-4 items-center rounded-2xl border border-dashed border-border bg-muted px-6 py-10">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
                <Icon name="business-outline" size={28} className="text-primary" />
              </View>
              <Text className="text-sm font-semibold text-foreground">
                Chưa có tài khoản ngân hàng
              </Text>
              <Text className="mt-1 text-center text-xs text-muted-foreground">
                Thêm ít nhất một tài khoản để nhận thanh toán tiền thuê và tiền hoàn cọc.
              </Text>
              <View className="mt-4">{addButton}</View>
            </View>
          ) : null
        ) : (
          accounts.map((account) => (
            <BankAccountCard
              key={account.id}
              account={account}
              bank={banks.find((bank) => bank.bin === account.bankBin)}
              revealedNumber={revealed?.id === account.id ? revealed.number : null}
              revealing={revealingId === account.id}
              busy={busyId === account.id}
              onToggleReveal={() => void toggleReveal(account.id)}
              onEdit={() => void openEdit(account)}
              onSetIncoming={() => setDefault(account.id, 'incoming')}
              onSetRefund={() => setDefault(account.id, 'refund')}
              onDelete={() => confirmRemove(account)}
            />
          ))
        )}

        {formOpen ? (
          <View
            onLayout={(event) => {
              if (!scrollToForm.current) return;
              scrollToForm.current = false;
              scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: true });
            }}
            className="mt-5 rounded-2xl border border-border bg-surface p-4">
            <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
              {editing ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}
            </Text>
            <Text className="text-xs text-muted-foreground">
              Hỗ trợ tạo mã VietQR chuyển khoản nhanh trực tiếp 24/7.
            </Text>
            {loadingEdit ? (
              <View className="min-h-40 flex-row items-center justify-center">
                <ActivityIndicator className="text-primary" />
                <Text className="ml-2 text-sm text-muted-foreground">
                  Đang tải thông tin tài khoản...
                </Text>
              </View>
            ) : (
              <>
                <Text className="mb-2 mt-4 text-sm font-semibold text-secondary">
                  Ngân hàng thụ hưởng *
                </Text>
                <BankPicker
                  banks={bankList}
                  value={selectedBin}
                  onChange={setSelectedBin}
                  loading={banksLoading}
                  error={banksError}
                  onRetry={retryBanks}
                />
                <Field
                  label="Số tài khoản ngân hàng *"
                  value={accountNumber}
                  onChangeText={(value) => setAccountNumber(cleanAccountNumber(value))}
                  keyboardType="number-pad"
                  placeholder="Ví dụ: 0987654321"
                  maxLength={30}
                />
                <Field
                  label="Tên chủ tài khoản (viết hoa không dấu) *"
                  value={holder}
                  onChangeText={(value) => setHolder(cleanHolderName(value))}
                  autoCapitalize="characters"
                  placeholder="Ví dụ: NGUYEN VAN A"
                  maxLength={120}
                />
                <View className="mt-4 gap-2">
                  <DefaultToggle
                    checked={defaultIncoming}
                    onChange={setDefaultIncoming}
                    title="Nhận thanh toán tiền thuê"
                    help="Đặt làm tài khoản mặc định nhận thanh toán tiền thuê."
                    locked={!!editing?.lockIncoming}
                  />
                  <DefaultToggle
                    checked={defaultRefund}
                    onChange={setDefaultRefund}
                    title="Nhận hoàn tiền cọc"
                    help="Đặt làm tài khoản mặc định nhận hoàn tiền cọc."
                    locked={!!editing?.lockRefund}
                  />
                </View>
                <View
                  accessibilityLabel="Xem trước"
                  className="mt-4 flex-row items-center rounded-2xl border border-dashed border-border bg-muted p-3">
                  <BankLogo logo={selectedBank?.logo} code={selectedBank?.code ?? ''} />
                  <View className="ml-3 min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-sm font-bold text-foreground">
                      {selectedBank?.shortName ?? 'Ngân hàng'}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className={`font-mono text-sm tracking-wider ${accountNumber ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {accountNumber || 'Số tài khoản'}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="text-xs font-semibold uppercase text-muted-foreground">
                      {holder || 'Tên chủ tài khoản'}
                    </Text>
                  </View>
                </View>
              </>
            )}
            <Text className="mt-3 text-xs leading-5 text-muted-foreground">
              Thông tin được mã hóa khi lưu và chỉ dùng cho các khoản thanh toán, hoàn cọc.
            </Text>
            <ErrorNotice message={formError} />
            <View className="mt-4 flex-row gap-2">
              <Pressable
                disabled={submitting}
                onPress={closeForm}
                accessibilityRole="button"
                className="min-h-12 flex-1 items-center justify-center rounded-xl border border-border">
                <Text className="font-semibold text-secondary">Hủy</Text>
              </Pressable>
              <Pressable
                disabled={submitting || loadingEdit || !selectedBank}
                onPress={() => void save()}
                accessibilityRole="button"
                className={`min-h-12 flex-1 flex-row items-center justify-center rounded-xl bg-brand ${submitting || loadingEdit || !selectedBank ? 'opacity-60' : ''}`}>
                {submitting ? <ActivityIndicator className="mr-2 text-on-brand" /> : null}
                <Text className="font-bold text-on-brand">
                  {submitting ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Lưu tài khoản'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Checkbox row; `locked` = already the default (the backend can only set a default to true). */
function DefaultToggle({
  checked,
  onChange,
  title,
  help,
  locked,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  help: string;
  locked: boolean;
}) {
  return (
    <Pressable
      disabled={locked}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: locked }}
      className={`min-h-14 flex-row items-start rounded-xl border p-3 ${checked ? 'border-primary-border bg-primary-soft' : 'border-border'} ${locked ? 'opacity-70' : ''}`}>
      <Icon
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        className={checked ? 'text-primary' : 'text-muted-foreground'}
      />
      <View className="ml-3 min-w-0 flex-1">
        <Text className="text-sm font-semibold text-foreground">{title}</Text>
        <Text className="text-xs text-muted-foreground">
          {locked ? 'Đang là mặc định — chọn tài khoản khác làm mặc định để thay đổi' : help}
        </Text>
      </View>
    </Pressable>
  );
}
