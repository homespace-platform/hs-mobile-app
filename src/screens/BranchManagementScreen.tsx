import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from '@/components/Icon';
import { useDialog } from '@/components/AppDialog';
import { Button, ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import { apiError } from '@/lib/api-error';
import {
  BRANCH_CATEGORIES,
  CHARGE_FIELDS,
  branchForm,
  buildBranchInput,
  type BranchFormState,
  type ChargeKey,
} from '@/lib/branch-form';
import {
  deleteBranch,
  getBranch,
  getBranches,
  saveBranch,
  searchBranchAddress,
  type AddressSuggestion,
  type Branch,
  type BranchCategory,
} from '@/services/branchApi';
import { uploadFile, type LocalFile } from '@/services/storageApi';

const STEPS = ['Thông tin', 'Biểu phí', 'Nội quy & kiểm tra'] as const;
const CATEGORY_NAMES: Record<BranchCategory, string> = {
  APARTMENT: 'Căn hộ',
  HOUSE: 'Nhà nguyên căn',
  ROOM: 'Phòng trọ',
};
const paidMethods = new Set([
  'PER_KWH',
  'PER_M3',
  'PER_PERSON_MONTH',
  'PER_MONTH',
  'PER_M2_MONTH',
  'PER_VEHICLE_MONTH',
]);

function Options({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm font-semibold text-secondary">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map(([key, title]) => (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === key }}
            className={`min-h-11 justify-center rounded-xl border px-3 py-2 ${value === key ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
            <Text
              className={`text-sm font-semibold ${value === key ? 'text-primary' : 'text-secondary'}`}>
              {title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function BranchManagementScreen({ onBack }: { onBack: () => void }) {
  const showDialog = useDialog();
  const scrollRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<'list' | 'detail' | 'form'>('list');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchFormState>(() => branchForm());
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [coverFile, setCoverFile] = useState<LocalFile | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const missingFees = [
    form.category === 'APARTMENT' &&
      form.charges.MANAGEMENT.method === 'NOT_APPLICABLE' &&
      'phí quản lý',
    form.charges.INTERNET.method === 'NOT_APPLICABLE' && 'Internet / WiFi',
    form.charges.SERVICE_OR_GARBAGE.method === 'NOT_APPLICABLE' && 'phí rác & vệ sinh',
  ].filter(Boolean);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBranches(await getBranches());
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'form' || addressQuery.trim().length < 3 || addressQuery === form.display) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      void searchBranchAddress(addressQuery.trim(), controller.signal)
        .then(setSuggestions)
        .catch((cause) => {
          if (!controller.signal.aborted) setError(apiError(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, addressQuery, form.display]);

  function change(patch: Partial<BranchFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
    setError(null);
  }
  function changeCharge(key: ChargeKey, patch: Partial<BranchFormState['charges'][ChargeKey]>) {
    setForm((current) => ({
      ...current,
      charges: { ...current.charges, [key]: { ...current.charges[key], ...patch } },
    }));
    setDirty(true);
    setError(null);
  }
  function goTo(next: number) {
    Keyboard.dismiss();
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }
  function beginForm(branch?: Branch) {
    const next = branchForm(branch);
    setForm(next);
    setSelected(branch ?? null);
    setAddressQuery(next.display);
    setSuggestions([]);
    setCoverFile(null);
    setCoverUri(branch?.coverImageUrl ?? null);
    setStep(0);
    setDirty(false);
    setError(null);
    setMode('form');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function leaveForm() {
    if (busy) return;
    const close = () => {
      setMode(selected ? 'detail' : 'list');
      setError(null);
    };
    if (!dirty) return close();
    showDialog('Bỏ thay đổi?', 'Thông tin chưa lưu sẽ mất khi rời biểu mẫu.', [
      { text: 'Tiếp tục sửa', style: 'cancel' },
      { text: 'Bỏ thay đổi', style: 'destructive', onPress: close },
    ]);
  }
  function back() {
    if (busy) return;
    if (mode === 'form') {
      if (step > 0) {
        goTo(step - 1);
        return;
      }
      leaveForm();
    } else if (mode === 'detail') {
      setMode('list');
      setSelected(null);
      setError(null);
    } else onBack();
  }
  async function openBranch(branch: Branch) {
    setBusy(true);
    setError(null);
    try {
      setSelected(await getBranch(branch.id));
      setMode('detail');
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } catch (cause) {
      setError(apiError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function pickCover() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Cần cấp quyền thư viện ảnh.');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.fileSize || asset.fileSize > 15 * 1024 * 1024)
        throw new Error('Ảnh bìa cần có dung lượng tối đa 15 MB.');
      const contentType = asset.mimeType || 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType))
        throw new Error('Ảnh bìa phải là JPG, PNG hoặc WebP.');
      setCoverFile({
        uri: asset.uri,
        fileName: asset.fileName || 'branch-cover.jpg',
        contentType,
        sizeBytes: asset.fileSize,
      });
      setCoverUri(asset.uri);
      setDirty(true);
    } catch (cause) {
      showDialog('Không thể chọn ảnh', apiError(cause));
    }
  }
  async function submit() {
    if (busy) return;
    setError(null);
    let input;
    try {
      input = buildBranchInput(form);
    } catch (cause) {
      setError(apiError(cause));
      const message = cause instanceof Error ? cause.message : '';
      goTo(/tên chi nhánh|địa chỉ/.test(message) ? 0 : 1);
      return;
    }
    const save = async () => {
      setBusy(true);
      setError(null);
      try {
        if (coverFile) {
          const stored = await uploadFile(coverFile, {
            purpose: 'BRANCH_COVER_IMAGE',
            visibility: 'PUBLIC',
            referenceType: 'BRANCH',
            referenceId: selected?.id ?? 'branch',
          });
          input.coverImageId = stored.id;
          setForm((current) => ({ ...current, coverImageId: stored.id }));
          setCoverFile(null);
        }
        const saved = await saveBranch(input, selected?.id);
        setSelected(saved);
        setDirty(false);
        setMode('detail');
        await load();
        showDialog(
          'Đã lưu chi nhánh',
          'Thông tin chi nhánh đã được cập nhật.',
          undefined,
          'success'
        );
      } catch (cause) {
        setError(apiError(cause));
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } finally {
        setBusy(false);
      }
    };
    if (selected && (selected.activeListingsCount ?? 0) > 0) {
      showDialog(
        'Đồng bộ biểu phí?',
        `Chi nhánh có ${selected.activeListingsCount} tin đang hoạt động. Lưu thay đổi sẽ cập nhật biểu phí của các tin này.`,
        [
          { text: 'Quay lại', style: 'cancel' },
          { text: 'Lưu & đồng bộ', onPress: () => void save() },
        ]
      );
    } else void save();
  }
  function removeBranch() {
    if (!selected || busy) return;
    if ((selected.totalUnits ?? 0) > 0) {
      showDialog(
        'Chưa thể xóa',
        `Chi nhánh đang có ${selected.totalUnits} phòng/căn hộ. Hãy chuyển hoặc xóa các tin thuộc chi nhánh trước.`
      );
      return;
    }
    const target = selected;
    showDialog('Xóa chi nhánh?', `Bạn có chắc muốn xóa “${target.name}”?`, [
      { text: 'Quay lại', style: 'cancel' },
      {
        text: 'Xóa chi nhánh',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void deleteBranch(target.id)
            .then(() => {
              setSelected(null);
              setMode('list');
              return load();
            })
            .then(() =>
              showDialog('Đã xóa chi nhánh', 'Chi nhánh đã được xóa.', undefined, 'success')
            )
            .catch((cause) => showDialog('Không thể xóa chi nhánh', apiError(cause)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader
        title={
          mode === 'list'
            ? 'Chi nhánh / Tòa nhà'
            : mode === 'detail'
              ? 'Chi tiết chi nhánh'
              : selected
                ? 'Sửa chi nhánh'
                : 'Thêm chi nhánh'
        }
        onBack={back}
      />
      {mode === 'form' ? (
        <View className="border-b border-border bg-surface px-5 pb-4 pt-3">
          <Text className="text-xs font-bold uppercase tracking-widest text-primary">
            Bước {step + 1}/3
          </Text>
          <Text className="mt-1 text-xl font-bold text-foreground">{STEPS[step]}</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {step < 2 ? `Tiếp theo: ${STEPS[step + 1]}` : 'Xem lại thông tin trước khi lưu.'}
          </Text>
          <View className="mt-3 flex-row gap-1.5">
            {STEPS.map((label, index) => (
              <View
                key={label}
                className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-muted'}`}
              />
            ))}
          </View>
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-10 pt-5"
        refreshControl={
          mode === 'list' ? (
            <RefreshControl refreshing={loading} onRefresh={() => void load()} />
          ) : undefined
        }>
        <ErrorNotice message={error} />
        {mode === 'list' ? (
          <>
            <Text className="mb-4 text-sm leading-5 text-muted-foreground">
              Quản lý địa chỉ, biểu phí dịch vụ và nội quy dùng chung cho các tin đăng trong chi
              nhánh.
            </Text>
            <Pressable
              onPress={() => beginForm()}
              accessibilityRole="button"
              className="mb-5 min-h-14 flex-row items-center justify-center rounded-2xl bg-brand px-4">
              <Icon name="add-circle-outline" size={22} className="text-on-brand" />
              <Text className="ml-2 font-bold text-on-brand">Thêm chi nhánh</Text>
            </Pressable>
            {loading ? (
              <ActivityIndicator className="mt-8 text-primary" />
            ) : !error && branches.length === 0 ? (
              <View className="items-center rounded-2xl border border-dashed border-border bg-surface p-6">
                <Icon name="business-outline" size={38} className="text-subtle" />
                <Text className="mt-3 font-bold text-foreground">Chưa có chi nhánh nào</Text>
                <Text className="mt-1 text-center text-sm text-muted-foreground">
                  Tạo chi nhánh để dùng chung địa chỉ và biểu phí cho nhiều tin đăng.
                </Text>
              </View>
            ) : (
              branches.map((branch) => (
                <Pressable
                  key={branch.id}
                  onPress={() => void openBranch(branch)}
                  disabled={busy}
                  accessibilityRole="button"
                  className="mb-3 overflow-hidden rounded-2xl border border-border bg-surface">
                  {branch.coverImageUrl ? (
                    <Image
                      source={{ uri: branch.coverImageUrl }}
                      className="h-28 w-full bg-muted"
                    />
                  ) : null}
                  <View className="p-4">
                    <View className="flex-row items-start">
                      <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-primary-soft">
                        <Icon name="business-outline" size={22} className="text-primary" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-bold text-foreground">{branch.name}</Text>
                        <Text className="mt-1 text-xs text-muted-foreground">
                          {CATEGORY_NAMES[branch.category]}
                          {branch.code ? ` · ${branch.code}` : ''}
                        </Text>
                      </View>
                      <Icon name="chevron-forward" size={19} className="text-subtle" />
                    </View>
                    <Text className="mt-3 text-sm text-secondary">
                      {branch.display || 'Chưa có địa chỉ'}
                    </Text>
                    <View className="mt-3 flex-row gap-2">
                      <Text className="rounded-full bg-muted px-3 py-1 text-xs text-secondary">
                        {branch.totalUnits ?? 0} phòng/căn
                      </Text>
                      <Text
                        className={`rounded-full px-3 py-1 text-xs ${branch.isComplete === false ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>
                        {branch.isComplete === false ? 'Thiếu biểu phí' : 'Biểu phí đầy đủ'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </>
        ) : null}

        {mode === 'detail' && selected ? (
          <>
            {selected.coverImageUrl ? (
              <Image
                source={{ uri: selected.coverImageUrl }}
                className="mb-4 h-44 w-full rounded-2xl bg-muted"
              />
            ) : null}
            <Text className="text-2xl font-bold text-foreground">{selected.name}</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {CATEGORY_NAMES[selected.category]}
              {selected.code ? ` · ${selected.code}` : ''}
            </Text>
            <Text className="mt-3 text-sm text-secondary">{selected.display}</Text>
            {selected.addressNote ? (
              <Text className="mt-1 text-xs text-muted-foreground">{selected.addressNote}</Text>
            ) : null}
            {selected.isComplete === false ? (
              <Text className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">
                Thiếu biểu phí: {selected.missingCharges?.join(', ') || 'Cần kiểm tra lại'}
              </Text>
            ) : null}
            <View className="mt-5 flex-row gap-3">
              <Text className="rounded-xl bg-muted p-3 text-sm text-secondary">
                {selected.totalUnits ?? 0} phòng/căn
              </Text>
              <Text className="rounded-xl bg-muted p-3 text-sm text-secondary">
                {selected.activeListingsCount ?? 0} tin hoạt động
              </Text>
            </View>
            <Text className="mt-7 text-lg font-bold text-foreground">Biểu phí mặc định</Text>
            {(selected.defaultCharges ?? []).map((charge, index) => (
              <View
                key={`${charge.chargeType}-${index}`}
                className="mt-2 flex-row justify-between rounded-xl border border-border bg-surface p-3">
                <Text className="flex-1 text-sm text-secondary">
                  {charge.chargeType === 'OTHER'
                    ? charge.customName
                    : CHARGE_FIELDS.find((field) => field.key === charge.chargeType)?.label ||
                      charge.chargeType}
                </Text>
                <Text className="text-right text-sm font-semibold text-foreground">
                  {charge.amount != null
                    ? `${charge.amount.toLocaleString('vi-VN')} đ/${charge.unit || 'tháng'}`
                    : charge.billingMethod === 'NOT_APPLICABLE'
                      ? 'Không áp dụng'
                      : charge.billingMethod === 'FREE'
                        ? 'Miễn phí'
                        : 'Đã bao gồm'}
                </Text>
              </View>
            ))}
            {selected.description ? (
              <>
                <Text className="mt-7 text-lg font-bold text-foreground">Mô tả</Text>
                <Text className="mt-2 text-sm leading-6 text-secondary">
                  {selected.description}
                </Text>
              </>
            ) : null}
            {selected.buildingRules ? (
              <>
                <Text className="mt-7 text-lg font-bold text-foreground">Nội quy</Text>
                <Text className="mt-2 text-sm leading-6 text-secondary">
                  {selected.buildingRules}
                </Text>
              </>
            ) : null}
            <Button
              label="Chỉnh sửa chi nhánh"
              onPress={() => beginForm(selected)}
              disabled={busy}
            />
            <Pressable
              onPress={removeBranch}
              disabled={busy}
              accessibilityRole="button"
              className="mt-4 min-h-12 items-center justify-center rounded-xl border border-danger bg-danger-soft">
              <Text className="font-bold text-danger">Xóa chi nhánh</Text>
            </Pressable>
          </>
        ) : null}

        {mode === 'form' && step === 0 ? (
          <>
            <Text className="text-lg font-bold text-foreground">Thông tin cơ bản</Text>
            <Field
              label="Tên chi nhánh / tòa nhà *"
              value={form.name}
              onChangeText={(name) => change({ name })}
              placeholder="Ví dụ: Dãy trọ Văn Lang"
            />
            <Field
              label="Mã chi nhánh (tự tạo nếu bỏ trống)"
              value={form.code}
              onChangeText={(code) => change({ code })}
              autoCapitalize="characters"
              placeholder="Ví dụ: CN-VL01"
            />
            <Options
              label="Loại bất động sản *"
              options={BRANCH_CATEGORIES.map((item) => [item.value, item.label])}
              value={form.category}
              onChange={(value) => change({ category: value as BranchCategory })}
            />
            <Text className="mt-7 text-lg font-bold text-foreground">Địa chỉ Vietmap *</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Nhập địa chỉ rồi chọn một kết quả để lấy vị trí chính xác.
            </Text>
            <TextInput
              value={addressQuery}
              onChangeText={(text) => {
                setAddressQuery(text);
                change({ refId: '', display: '' });
                setError(null);
              }}
              placeholder="Tìm số nhà, đường, phường..."
              className="mt-3 min-h-12 rounded-xl border border-border bg-surface px-4 text-foreground placeholder:text-subtle"
            />
            {searching ? <ActivityIndicator className="mt-3 text-primary" /> : null}
            {suggestions.length ? (
              <View className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
                {suggestions.map((item) => (
                  <Pressable
                    key={item.refId}
                    onPress={() => {
                      change({ refId: item.refId, display: item.display });
                      setAddressQuery(item.display);
                      setSuggestions([]);
                      Keyboard.dismiss();
                    }}
                    className="min-h-12 justify-center border-t border-border px-4 py-2">
                    <Text className="text-sm text-foreground">{item.display}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {form.refId ? (
              <Text className="mt-2 text-xs font-semibold text-success">
                Đã chọn vị trí: {form.display}
              </Text>
            ) : null}
            <Field
              label="Ghi chú địa chỉ"
              value={form.addressNote}
              onChangeText={(addressNote) => change({ addressNote })}
              placeholder="Ví dụ: Cổng sau, hẻm bên trái"
            />
            <Text className="mt-7 text-lg font-bold text-foreground">Ảnh bìa</Text>
            {coverUri ? (
              <Image source={{ uri: coverUri }} className="mt-3 h-40 w-full rounded-xl bg-muted" />
            ) : null}
            <Pressable
              onPress={() => void pickCover()}
              accessibilityRole="button"
              className="mt-3 min-h-12 flex-row items-center justify-center rounded-xl border border-primary-border bg-primary-soft">
              <Icon name="image-outline" size={19} className="text-primary" />
              <Text className="ml-2 font-semibold text-primary">
                {coverUri ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa'}
              </Text>
            </Pressable>
            {coverUri ? (
              <Pressable
                onPress={() => {
                  setCoverUri(null);
                  setCoverFile(null);
                  change({ coverImageId: null });
                }}
                className="mt-2 min-h-10 items-center justify-center">
                <Text className="text-sm font-semibold text-danger">Bỏ ảnh bìa</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {mode === 'form' && step === 1 ? (
          <>
            <Text className="text-lg font-bold text-foreground">Biểu phí dịch vụ</Text>
            <Text className="mt-1 text-sm leading-5 text-muted-foreground">
              Các khoản này dùng chung cho mọi tin đăng trong chi nhánh. Chọn cách tính rồi nhập đơn
              giá nếu có thu phí.
            </Text>
            {CHARGE_FIELDS.map((field) => {
              const charge = form.charges[field.key];
              return (
                <View
                  key={field.key}
                  className="mt-4 rounded-2xl border border-border bg-surface p-4">
                  <Options
                    label={field.label}
                    options={field.methods}
                    value={charge.method}
                    onChange={(method) => changeCharge(field.key, { method })}
                  />
                  {paidMethods.has(charge.method) ? (
                    <Field
                      label="Đơn giá (VNĐ) *"
                      value={charge.amount}
                      keyboardType="number-pad"
                      onChangeText={(amount) =>
                        changeCharge(field.key, { amount: amount.replace(/\D/g, '') })
                      }
                      placeholder="Nhập số tiền"
                    />
                  ) : null}
                  {field.key === 'MOTORBIKE_PARKING' && charge.method !== 'NOT_APPLICABLE' ? (
                    <Field
                      label="Sức chứa xe máy *"
                      value={form.motorbikeCapacity}
                      keyboardType="number-pad"
                      onChangeText={(motorbikeCapacity) =>
                        change({ motorbikeCapacity: motorbikeCapacity.replace(/\D/g, '') })
                      }
                    />
                  ) : null}
                  {field.key === 'CAR_PARKING' && charge.method !== 'NOT_APPLICABLE' ? (
                    <Field
                      label="Sức chứa ô tô *"
                      value={form.carCapacity}
                      keyboardType="number-pad"
                      onChangeText={(carCapacity) =>
                        change({ carCapacity: carCapacity.replace(/\D/g, '') })
                      }
                    />
                  ) : null}
                </View>
              );
            })}
            <Text className="mt-7 text-lg font-bold text-foreground">Khoản phí khác</Text>
            {form.customFees.map((fee, index) => (
              <View key={index} className="mt-3 rounded-2xl border border-border bg-surface p-4">
                <Field
                  label="Tên khoản phí"
                  value={fee.name}
                  onChangeText={(name) =>
                    change({
                      customFees: form.customFees.map((row, i) =>
                        i === index ? { ...row, name } : row
                      ),
                    })
                  }
                />
                <Field
                  label="Số tiền (VNĐ)"
                  value={fee.amount}
                  keyboardType="number-pad"
                  onChangeText={(amount) =>
                    change({
                      customFees: form.customFees.map((row, i) =>
                        i === index ? { ...row, amount: amount.replace(/\D/g, '') } : row
                      ),
                    })
                  }
                />
                <Field
                  label="Đơn vị"
                  value={fee.unit}
                  onChangeText={(unit) =>
                    change({
                      customFees: form.customFees.map((row, i) =>
                        i === index ? { ...row, unit } : row
                      ),
                    })
                  }
                />
                <Pressable
                  onPress={() =>
                    change({ customFees: form.customFees.filter((_, i) => i !== index) })
                  }
                  className="mt-2 min-h-10 items-end justify-center">
                  <Text className="font-semibold text-danger">Xóa khoản phí</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() =>
                change({
                  customFees: [...form.customFees, { name: '', amount: '', unit: 'tháng' }],
                })
              }
              className="mt-3 min-h-12 items-center justify-center rounded-xl border border-primary-border bg-primary-soft">
              <Text className="font-bold text-primary">+ Thêm khoản phí</Text>
            </Pressable>
          </>
        ) : null}

        {mode === 'form' && step === 2 ? (
          <>
            <Text className="text-lg font-bold text-foreground">Mô tả & nội quy</Text>
            <Field
              label="Mô tả chi nhánh"
              value={form.description}
              onChangeText={(description) => change({ description })}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder="Giới thiệu tòa nhà, dãy phòng..."
            />
            <Field
              label="Nội quy chung"
              value={form.buildingRules}
              onChangeText={(buildingRules) => change({ buildingRules })}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="Giờ giấc, giữ xe, khu vực chung..."
            />
            <View className="mt-7 rounded-2xl border border-primary-border bg-primary-soft p-4">
              <Text className="font-bold text-foreground">Kiểm tra trước khi lưu</Text>
              <Text className="mt-2 text-sm leading-6 text-secondary">
                {form.name || 'Chưa có tên'} · {CATEGORY_NAMES[form.category]}
              </Text>
              <Text className="text-sm leading-6 text-secondary">
                {form.display || 'Chưa chọn địa chỉ Vietmap'}
              </Text>
              <Text className="text-sm leading-6 text-secondary">
                {CHARGE_FIELDS.length} nhóm phí · {form.customFees.length} phí khác ·{' '}
                {form.motorbikeCapacity || 0} chỗ xe máy · {form.carCapacity || 0} chỗ ô tô
              </Text>
            </View>
            {missingFees.length ? (
              <Text className="mt-4 rounded-xl bg-warning-soft p-3 text-sm leading-5 text-warning">
                Biểu phí còn thiếu: {missingFees.join(', ')}. Bạn vẫn có thể lưu, nhưng chưa thể
                dùng chi nhánh này để đăng tin cho đến khi bổ sung.
              </Text>
            ) : null}
            {selected && (selected.activeListingsCount ?? 0) > 0 ? (
              <Text className="mt-4 rounded-xl bg-warning-soft p-3 text-sm leading-5 text-warning">
                Thay đổi biểu phí sẽ được đồng bộ sang {selected.activeListingsCount} tin đang hoạt
                động.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      {mode === 'form' ? (
        <View className="flex-row gap-3 border-t border-border bg-surface px-5 pb-3 pt-3">
          <Pressable
            onPress={() => (step ? goTo(step - 1) : leaveForm())}
            className="min-h-12 flex-1 items-center justify-center rounded-xl border border-border">
            <Text className="font-bold text-secondary">{step ? 'Quay lại' : 'Hủy'}</Text>
          </Pressable>
          <Pressable
            onPress={() => (step < 2 ? goTo(step + 1) : void submit())}
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            className={`min-h-12 flex-[2] items-center justify-center rounded-xl ${busy ? 'bg-disabled' : 'bg-brand'}`}>
            <Text className={`font-bold ${busy ? 'text-on-disabled' : 'text-on-brand'}`}>
              {busy
                ? 'Đang lưu...'
                : step < 2
                  ? 'Tiếp tục'
                  : selected
                    ? 'Lưu thay đổi'
                    : 'Tạo chi nhánh'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
