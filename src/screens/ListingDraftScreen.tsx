import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from '@/components/Icon';
import { useDialog } from '@/components/AppDialog';
import { ErrorNotice, Field, ScreenHeader } from '@/components/Screen';
import BookingDatePicker from '@/components/BookingDatePicker';
import { dateKey } from '@/lib/appointment-calendar';
import { apiError } from '@/lib/api-error';
import { buildListingPayload, type ListingMedia } from '@/lib/listing-create';
import {
  DETAIL_FIELDS,
  LISTING_CATEGORIES,
  LISTING_STEPS,
  type DetailField,
  type ListingCategory,
} from '@/lib/listing-draft';
import {
  getBranches,
  searchBranchAddress,
  type Branch,
  type AddressSuggestion,
} from '@/services/branchApi';
import {
  getListingCatalog,
  upsertListing,
  type ListingCatalog,
  type ListingSubmissionAction,
} from '@/services/listingCreateApi';
import { uploadFile } from '@/services/storageApi';
import { getUserProfileApi } from '@/services/userApi';

const DAYS = [
  ['MONDAY', 'T2'],
  ['TUESDAY', 'T3'],
  ['WEDNESDAY', 'T4'],
  ['THURSDAY', 'T5'],
  ['FRIDAY', 'T6'],
  ['SATURDAY', 'T7'],
  ['SUNDAY', 'CN'],
] as const;
const SLOTS = [
  ['MORNING', 'Buổi sáng', '08:00–12:00'],
  ['AFTERNOON', 'Buổi chiều', '13:00–17:00'],
  ['EVENING', 'Buổi tối', '18:00–21:00'],
] as const;

function Choice({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <View className="mt-5">
      <Text className="mb-2 text-sm font-semibold text-secondary">
        {label}
        {required ? ' *' : ''}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === option }}
            className={`min-h-11 justify-center rounded-xl border px-3 py-2 ${value === option ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
            <Text
              className={`text-sm font-semibold ${value === option ? 'text-primary' : 'text-secondary'}`}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <View className="mb-2">
      <Text className="text-lg font-bold text-foreground">{title}</Text>
      {note ? <Text className="mt-1 text-sm leading-5 text-muted-foreground">{note}</Text> : null}
    </View>
  );
}

type PickedMedia = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageObjectId?: string;
};

export default function ListingDraftScreen({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved: () => void;
}) {
  const showDialog = useDialog();
  const scrollRef = useRef<ScrollView>(null);
  const submitLock = useRef(false);
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<ListingCategory>('apartment');
  const [basic, setBasic] = useState({
    title: '',
    branchId: '',
    availableDate: dateKey(new Date()),
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [location, setLocation] = useState({ refId: '', display: '', note: '' });
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [images, setImages] = useState<PickedMedia[]>([]);
  const [videos, setVideos] = useState<PickedMedia[]>([]);
  const [catalog, setCatalog] = useState<ListingCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const [policyValues, setPolicyValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<ListingCategory, Record<string, string>>>(() => ({
    apartment: {},
    house: {},
    room: {},
  }));
  const [moreOpen, setMoreOpen] = useState(false);
  const [amenities, setAmenities] = useState<Record<ListingCategory, string[]>>(() => ({
    apartment: [],
    house: [],
    room: [],
  }));
  const [assets, setAssets] = useState<{ name: string; quantity: string; condition: string }[]>([]);
  const [pricing, setPricing] = useState<Record<string, string>>({
    priceUnit: 'VNĐ / tháng',
    depositType: 'Không cọc',
    paymentCycle: 'Hằng tháng',
  });
  const [customFees, setCustomFees] = useState<{ name: string; amount: string; unit: string }[]>(
    []
  );
  const [days, setDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  useEffect(() => {
    getBranches()
      .then(setBranches)
      .catch((cause) => setError(apiError(cause)));
  }, []);
  useEffect(() => {
    let active = true;
    setCatalog(null);
    setCatalogError('');
    void getListingCatalog(category)
      .then((result) => {
        if (active) setCatalog(result);
      })
      .catch((cause) => {
        if (active) setCatalogError(apiError(cause));
      });
    return () => {
      active = false;
    };
  }, [category, catalogRefresh]);
  useEffect(() => {
    if (basic.branchId || addressQuery.trim().length < 3 || addressQuery === location.display) {
      setSuggestions([]);
      setAddressLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setAddressLoading(true);
      void searchBranchAddress(addressQuery.trim(), controller.signal)
        .then(setSuggestions)
        .catch((cause) => {
          if (!controller.signal.aborted) setError(apiError(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted) setAddressLoading(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [basic.branchId, addressQuery, location.display]);

  const categoryLabel = LISTING_CATEGORIES.find((item) => item.key === category)!.label;
  const selectedBranch = branches.find((item) => item.id === basic.branchId);
  const requiredDetails = DETAIL_FIELDS[category].main.filter((field) => field.required);
  const missing = [
    [basic.title.trim().length < 15 && 'Tiêu đề (ít nhất 15 ký tự)'],
    [!basic.branchId && !location.refId && 'Địa chỉ Vietmap', !images.length && 'Ít nhất 1 ảnh'],
    [
      ...requiredDetails.map(
        (field) =>
          (!details[category][field.key]?.trim() ||
            (field.number &&
              !(Number(details[category][field.key]) >= (field.key === 'floor' ? 0 : 1)))) &&
          field.label
      ),
      details[category].furnishing &&
        details[category].furnishing !== 'Bàn giao thô' &&
        !assets.length &&
        'Trang thiết bị bàn giao',
      assets.some(
        (row) => !row.name.trim() || !(Number(row.quantity) >= 1) || Number(row.quantity) > 999
      ) && 'Kiểm tra danh sách tài sản',
    ],
    [
      (!pricing.priceMonthly?.trim() || !(Number(pricing.priceMonthly) > 0)) && 'Giá thuê',
      (!pricing.minimumLeaseMonths?.trim() || Number(pricing.minimumLeaseMonths) < 1) &&
        'Thời hạn thuê tối thiểu',
      pricing.depositType !== 'Không cọc' && !(Number(pricing.depositValue) > 0) && 'Tiền cọc',
      !basic.branchId && (!pricing.electricityType || !pricing.waterType) && 'Cách tính điện, nước',
      !basic.branchId &&
        ['electricity', 'water', 'management', 'internet', 'garbage', 'motorbike', 'car'].some(
          (key) =>
            pricing[`${key}Type`] &&
            !['Đã bao gồm', 'Không có', 'Tự trả'].includes(pricing[`${key}Type`]) &&
            !(Number(pricing[`${key}Price`]) > 0)
        ) &&
        'Đơn giá dịch vụ',
      !basic.branchId &&
        customFees.some((row) => !row.name.trim() || !row.amount.trim()) &&
        'Kiểm tra khoản phí khác',
    ],
    [
      !days.length && 'Ngày xem nhà',
      !slots.length && 'Buổi xem nhà',
      description.trim().length < 30 && 'Mô tả (ít nhất 30 ký tự)',
    ],
  ].map((items) => items.filter(Boolean) as string[]);
  const missingPolicies = (catalog?.policies ?? []).filter(
    (item) => item.required && !policyValues[item.code]?.trim()
  );
  if (missingPolicies.length) missing[3].push(`${missingPolicies.length} chính sách bắt buộc`);

  function goTo(next: number) {
    if (submitLock.current) return;
    Keyboard.dismiss();
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }
  function exit() {
    if (submitLock.current) return;
    const touched = Boolean(
      category !== 'apartment' ||
      basic.title ||
      basic.branchId ||
      location.refId ||
      addressQuery ||
      location.note ||
      images.length ||
      videos.length ||
      Object.values(details).some((fields) => Object.keys(fields).length) ||
      Object.values(amenities).some((items) => items.length) ||
      assets.length ||
      pricing.priceMonthly ||
      customFees.length ||
      days.length ||
      slots.length ||
      description ||
      Object.keys(policyValues).length
    );
    if (!touched) return onBack();
    showDialog('Rời biểu mẫu?', 'Thông tin chưa lưu sẽ mất khi thoát.', [
      { text: 'Tiếp tục chỉnh sửa', style: 'cancel' },
      { text: 'Rời biểu mẫu', style: 'destructive', onPress: onBack },
    ]);
  }
  function setDetail(key: string, value: string) {
    setDetails((current) => ({ ...current, [category]: { ...current[category], [key]: value } }));
  }
  function setPrice(key: string, value: string) {
    setPricing((current) => ({ ...current, [key]: value }));
  }
  function chooseCategory(next: ListingCategory) {
    if (next === category) return;
    setCategory(next);
    setPolicyValues({});
    setMoreOpen(false);
    setPricing((current) => ({
      ...current,
      priceUnit: next === 'room' ? 'VNĐ / phòng / tháng' : 'VNĐ / tháng',
    }));
  }
  function toggleValue(values: string[], value: string, setter: (values: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }
  function renderDetail(field: DetailField) {
    const value = details[category][field.key] ?? '';
    return field.options ? (
      <Choice
        key={field.key}
        label={field.label}
        required={field.required}
        options={field.options}
        value={value}
        onChange={(next) => setDetail(field.key, next)}
      />
    ) : (
      <Field
        key={field.key}
        label={`${field.label}${field.required ? ' *' : ''}`}
        value={value}
        onChangeText={(next) => setDetail(field.key, next)}
        keyboardType={field.number ? 'decimal-pad' : 'default'}
        placeholder={field.number ? 'Nhập số' : 'Nhập thông tin'}
      />
    );
  }
  async function pickMedia(kind: 'images' | 'videos') {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Cần cấp quyền thư viện ảnh để chọn tệp.');
      const current = kind === 'images' ? images : videos;
      const limit = kind === 'images' ? 6 : 3;
      if (current.length >= limit) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'images' ? ['images'] : ['videos'],
        allowsMultipleSelection: kind === 'images',
        selectionLimit: limit - current.length,
        quality: 0.85,
      });
      if (result.canceled) return;
      const picked = result.assets.slice(0, limit - current.length).map((asset) => {
        if (!asset.fileSize) throw new Error('Không đọc được dung lượng tệp. Vui lòng chọn lại.');
        const mimeType = asset.mimeType || (kind === 'images' ? 'image/jpeg' : 'video/mp4');
        if (
          kind === 'images' &&
          (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ||
            asset.fileSize > 25 * 1024 * 1024)
        )
          throw new Error('Ảnh phải là JPG/PNG/WebP và tối đa 25 MB.');
        if (
          kind === 'videos' &&
          (!['video/mp4', 'video/webm', 'video/quicktime'].includes(mimeType) ||
            asset.fileSize > 500 * 1024 * 1024)
        )
          throw new Error('Video phải là MP4/WebM/MOV và tối đa 500 MB.');
        return {
          uri: asset.uri,
          name: asset.fileName || (kind === 'images' ? 'Ảnh.jpg' : 'Video.mp4'),
          mimeType,
          sizeBytes: asset.fileSize,
        };
      });
      if (kind === 'images') setImages((items) => [...items, ...picked]);
      else setVideos((items) => [...items, ...picked]);
    } catch (error) {
      showDialog(
        'Không thể chọn tệp',
        error instanceof Error ? error.message : 'Vui lòng thử lại.'
      );
    }
  }

  function formData(media: ListingMedia[]) {
    return {
      category,
      title: basic.title,
      branchId: basic.branchId,
      availableDate: basic.availableDate,
      addressRefId: selectedBranch?.refId || location.refId,
      addressNote: location.note,
      details: details[category],
      amenities: amenities[category],
      assets,
      pricing,
      customFees,
      days,
      slots,
      description,
      policyValues,
      catalog,
      media,
    };
  }
  async function submit(action: ListingSubmissionAction) {
    if (submitLock.current) return;
    setError(null);
    if (selectedBranch?.isComplete === false) {
      setError(
        `Biểu phí chi nhánh còn thiếu: ${selectedBranch.missingCharges?.join(', ') || 'vui lòng cập nhật chi nhánh'}.`
      );
      return;
    }
    const stagedMedia: ListingMedia[] = [
      ...images.map((item) => ({
        storageObjectId: item.storageObjectId || 'pending',
        mediaType: 'IMAGE' as const,
      })),
      ...videos.map((item) => ({
        storageObjectId: item.storageObjectId || 'pending',
        mediaType: 'VIDEO' as const,
      })),
    ];
    try {
      buildListingPayload(formData(stagedMedia), action);
    } catch (cause) {
      setError(apiError(cause));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    submitLock.current = true;
    setBusy(true);
    try {
      const profile = await getUserProfileApi();
      if (!profile.kycVerified)
        throw new Error('Bạn cần xác minh danh tính trong Hồ sơ trước khi đăng tin.');
      const uploadedMedia: ListingMedia[] = [];
      for (const [kind, items] of [
        ['IMAGE', images],
        ['VIDEO', videos],
      ] as const) {
        for (const item of items) {
          let storageObjectId = item.storageObjectId;
          if (!storageObjectId) {
            const stored = await uploadFile(
              {
                uri: item.uri,
                fileName: item.name,
                contentType: item.mimeType,
                sizeBytes: item.sizeBytes,
              },
              {
                purpose: kind === 'IMAGE' ? 'LISTING_IMAGE' : 'LISTING_VIDEO',
                visibility: 'PUBLIC',
                referenceType: 'LISTING',
                referenceId: 'listing',
              }
            );
            storageObjectId = stored.id;
            const setter = kind === 'IMAGE' ? setImages : setVideos;
            setter((current) =>
              current.map((row) => (row.uri === item.uri ? { ...row, storageObjectId } : row))
            );
          }
          uploadedMedia.push({ storageObjectId, mediaType: kind });
        }
      }
      await upsertListing(buildListingPayload(formData(uploadedMedia), action));
      onSaved();
      showDialog(
        action === 'SAVE_DRAFT' ? 'Đã lưu tin nháp' : 'Đã gửi tin chờ duyệt',
        action === 'SAVE_DRAFT'
          ? 'Bạn có thể tiếp tục quản lý tin trong danh sách.'
          : 'Tin đăng đang chờ quản trị viên duyệt.',
        undefined,
        'success'
      );
    } catch (cause) {
      setError(apiError(cause));
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScreenHeader title="Đăng tin cho thuê" onBack={() => (step ? goTo(step - 1) : exit())} />
      <View className="border-b border-border bg-surface px-5 pb-4 pt-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase tracking-widest text-primary">
            Bước {step + 1}/6
          </Text>
          <Pressable
            onPress={exit}
            accessibilityRole="button"
            className="min-h-9 justify-center px-2">
            <Text className="text-xs font-semibold text-muted-foreground">Đóng</Text>
          </Pressable>
        </View>
        <Text className="mt-1 text-xl font-bold text-foreground">{LISTING_STEPS[step]}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {step < 5
            ? `Tiếp theo: ${LISTING_STEPS[step + 1]}`
            : 'Xem lại toàn bộ thông tin trước khi gửi duyệt.'}
        </Text>
        <View
          className="mt-4 flex-row gap-1.5"
          accessibilityLabel={`Đang ở bước ${step + 1} trên 6`}>
          {LISTING_STEPS.map((label, index) => (
            <View
              key={label}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-brand' : 'bg-muted'}`}
            />
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          {LISTING_STEPS.map((label, index) => (
            <Pressable
              key={label}
              onPress={() => goTo(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: step === index }}
              className={`mr-2 min-h-9 flex-row items-center rounded-full px-3 ${step === index ? 'bg-primary-soft' : 'bg-muted'}`}>
              <Text
                className={`text-xs font-semibold ${step === index ? 'text-primary' : 'text-secondary'}`}>
                {index + 1}. {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-10 pt-5">
        <View className="mb-5 rounded-2xl border border-warning bg-warning-soft p-3">
          <Text className="text-xs leading-5 text-warning">
            Kiểm tra kỹ thông tin trước khi lưu. Ảnh và video sẽ được tải lên khi bạn gửi biểu mẫu.
          </Text>
        </View>
        <ErrorNotice message={error} />

        {step === 0 ? (
          <>
            <SectionTitle
              title="Bạn muốn đăng loại bất động sản nào?"
              note="Chọn loại tin để hiện đúng các trường chi tiết ở bước 3."
            />
            {LISTING_CATEGORIES.map((item) => (
              <Pressable
                key={item.key}
                disabled={Boolean(selectedBranch)}
                onPress={() => chooseCategory(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item.key }}
                className={`mt-2 min-h-16 flex-row items-center rounded-2xl border p-4 ${category === item.key ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                <Icon
                  name={item.icon}
                  size={24}
                  className={category === item.key ? 'text-primary' : 'text-secondary'}
                />
                <Text
                  className={`ml-3 flex-1 font-bold ${category === item.key ? 'text-primary' : 'text-foreground'}`}>
                  {item.label}
                </Text>
                {category === item.key ? (
                  <Icon name="checkmark-circle" size={21} className="text-primary" />
                ) : null}
              </Pressable>
            ))}
            {selectedBranch ? (
              <Text className="mt-3 text-xs text-muted-foreground">
                Loại tin được chọn theo chi nhánh. Bỏ chi nhánh để đổi loại.
              </Text>
            ) : null}
            <View className="mt-7">
              <SectionTitle
                title="Thông tin cơ bản"
                note="Các trường có dấu * cần có trước khi gửi duyệt."
              />
            </View>
            <Field
              label="Tiêu đề tin đăng *"
              value={basic.title}
              onChangeText={(title) => setBasic((current) => ({ ...current, title }))}
              placeholder="Ví dụ: Phòng trọ có cửa sổ gần đại học"
              maxLength={150}
            />
            <Text className="mt-2 text-right text-xs text-muted-foreground">
              {basic.title.length}/150
            </Text>
            <Text className="mt-5 text-sm font-semibold text-secondary">
              Chi nhánh / Tòa nhà (nếu có)
            </Text>
            <Pressable
              onPress={() => setBranchOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: branchOpen }}
              className="mt-2 min-h-12 flex-row items-center rounded-xl border border-border bg-surface px-4">
              <Text className="flex-1 text-sm text-foreground">
                {selectedBranch?.name || 'Bất động sản độc lập'}
              </Text>
              <Icon
                name={branchOpen ? 'chevron-up' : 'chevron-down'}
                size={19}
                className="text-secondary"
              />
            </Pressable>
            {branchOpen ? (
              <View className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
                <Pressable
                  onPress={() => {
                    setBasic((current) => ({ ...current, branchId: '' }));
                    setLocation({ refId: '', display: '', note: '' });
                    setAddressQuery('');
                    setBranchOpen(false);
                  }}
                  className="min-h-11 justify-center px-4">
                  <Text className="text-sm text-foreground">Bất động sản độc lập</Text>
                </Pressable>
                {branches.map((branch) => (
                  <Pressable
                    key={branch.id}
                    onPress={() => {
                      setBasic((current) => ({ ...current, branchId: branch.id }));
                      setLocation({
                        refId: branch.refId,
                        display: branch.display,
                        note: branch.addressNote || '',
                      });
                      setAddressQuery(branch.display);
                      const branchCategory = branch.category.toLowerCase();
                      if (
                        branchCategory === 'apartment' ||
                        branchCategory === 'house' ||
                        branchCategory === 'room'
                      )
                        chooseCategory(branchCategory);
                      setBranchOpen(false);
                    }}
                    className="min-h-11 justify-center border-t border-border px-4">
                    <Text className="text-sm text-foreground">
                      {branch.name} · {branch.display}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {selectedBranch?.isComplete === false ? (
              <Text className="mt-2 text-xs text-warning">
                Biểu phí chi nhánh chưa hoàn thiện. Cần cập nhật trước khi đăng tin.
              </Text>
            ) : null}
            <Text className="mt-5 text-sm font-semibold text-secondary">
              Có thể vào ở từ ngày *
            </Text>
            <Pressable
              onPress={() => setDateOpen((current) => !current)}
              accessibilityRole="button"
              className="mt-2 min-h-12 flex-row items-center rounded-xl border border-border bg-surface px-4">
              <Icon name="calendar-outline" size={20} className="text-primary" />
              <Text className="ml-3 flex-1 text-sm font-semibold text-foreground">
                {basic.availableDate.split('-').reverse().join('/')}
              </Text>
              <Icon
                name={dateOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                className="text-secondary"
              />
            </Pressable>
            {dateOpen ? (
              <View className="mt-3">
                <BookingDatePicker
                  value={basic.availableDate}
                  minDate={dateKey(new Date())}
                  disabled={false}
                  hint="Ngày căn nhà có thể bàn giao"
                  onChange={(availableDate) => {
                    setBasic((current) => ({ ...current, availableDate }));
                    setDateOpen(false);
                  }}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <SectionTitle
              title="Địa chỉ căn nhà"
              note="Vị trí chính xác giúp người thuê tìm thấy tin đăng dễ hơn."
            />
            {selectedBranch ? (
              <View className="mt-3 rounded-xl border border-primary-border bg-primary-soft p-4">
                <Text className="font-semibold text-foreground">Địa chỉ theo chi nhánh</Text>
                <Text className="mt-1 text-sm text-secondary">{selectedBranch.display}</Text>
              </View>
            ) : (
              <>
                <Text className="mt-3 text-sm font-semibold text-secondary">
                  Tìm địa chỉ Vietmap *
                </Text>
                <TextInput
                  value={addressQuery}
                  onChangeText={(text) => {
                    setAddressQuery(text);
                    setLocation((current) => ({ ...current, refId: '', display: '' }));
                    setError(null);
                  }}
                  placeholder="Nhập số nhà, đường, phường..."
                  className="mt-2 min-h-12 rounded-xl border border-border bg-surface px-4 text-foreground placeholder:text-subtle"
                />
                {addressLoading ? <ActivityIndicator className="mt-3 text-primary" /> : null}
                {suggestions.length ? (
                  <View className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
                    {suggestions.map((item) => (
                      <Pressable
                        key={item.refId}
                        onPress={() => {
                          setLocation((current) => ({
                            ...current,
                            refId: item.refId,
                            display: item.display,
                          }));
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
                {location.refId ? (
                  <Text className="mt-2 text-xs font-semibold text-success">
                    Đã chọn: {location.display}
                  </Text>
                ) : null}
              </>
            )}
            {!selectedBranch ? (
              <Field
                label="Ghi chú vị trí"
                value={location.note}
                onChangeText={(note) => setLocation((current) => ({ ...current, note }))}
                placeholder="Tầng, lối vào hoặc mốc gần nhà"
              />
            ) : null}
            <View className="mt-7">
              <SectionTitle
                title={`Hình ảnh (${images.length}/6)`}
                note="Ảnh đầu tiên là ảnh bìa. Cần ít nhất 1 ảnh khi gửi duyệt."
              />
            </View>
            <Pressable
              onPress={() => void pickMedia('images')}
              accessibilityRole="button"
              className="mt-3 min-h-14 flex-row items-center justify-center rounded-2xl border border-dashed border-primary bg-primary-soft px-4">
              <Icon name="images-outline" size={21} className="text-primary" />
              <Text className="ml-2 font-bold text-primary">Thêm ảnh</Text>
            </Pressable>
            <View className="mt-3 flex-row flex-wrap gap-3">
              {images.map((image, index) => (
                <View
                  key={`${image.uri}-${index}`}
                  className="w-[47%] overflow-hidden rounded-xl border border-border bg-surface">
                  <Image source={{ uri: image.uri }} className="h-28 w-full bg-muted" />
                  <View className="flex-row items-center px-2 py-2">
                    <Text numberOfLines={1} className="flex-1 text-xs text-secondary">
                      {index === 0 ? 'Ảnh bìa · ' : ''}
                      {image.name}
                    </Text>
                    <Pressable
                      onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa ảnh ${index + 1}`}
                      className="p-2">
                      <Icon name="close" size={18} className="text-danger" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <View className="mt-7">
              <SectionTitle
                title={`Video (${videos.length}/3)`}
                note="Có thể thêm tối đa 3 video giới thiệu căn nhà."
              />
            </View>
            <Pressable
              onPress={() => void pickMedia('videos')}
              accessibilityRole="button"
              className="mt-3 min-h-12 flex-row items-center justify-center rounded-xl border border-border bg-surface px-4">
              <Icon name="videocam-outline" size={19} className="text-primary" />
              <Text className="ml-2 font-semibold text-primary">Chọn video</Text>
            </Pressable>
            {videos.map((video, index) => (
              <View
                key={`${video.uri}-${index}`}
                className="mt-2 flex-row items-center rounded-xl bg-muted px-3 py-2">
                <Text numberOfLines={1} className="flex-1 text-sm text-foreground">
                  {video.name}
                </Text>
                <Pressable
                  onPress={() => setVideos((current) => current.filter((_, i) => i !== index))}
                  accessibilityRole="button"
                  accessibilityLabel={`Xóa video ${index + 1}`}
                  className="p-2">
                  <Icon name="close" size={18} className="text-danger" />
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <SectionTitle
              title={`Chi tiết ${categoryLabel.toLowerCase()}`}
              note="Các trường bên dưới thay đổi theo loại bất động sản ở bước 1."
            />
            {DETAIL_FIELDS[category].main.map(renderDetail)}
            <Pressable
              onPress={() => setMoreOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityState={{ expanded: moreOpen }}
              className="mt-5 min-h-12 flex-row items-center rounded-xl border border-border bg-surface px-4">
              <Text className="flex-1 font-semibold text-primary">
                Thông tin chi tiết thêm ({DETAIL_FIELDS[category].more.length})
              </Text>
              <Icon
                name={moreOpen ? 'chevron-up' : 'chevron-down'}
                size={19}
                className="text-primary"
              />
            </Pressable>
            {moreOpen ? DETAIL_FIELDS[category].more.map(renderDetail) : null}
            <View className="mt-7">
              <SectionTitle title="Tiện ích" note="Chọn những tiện ích có thật tại bất động sản." />
            </View>
            <View className="flex-row flex-wrap gap-2">
              {(catalog?.amenities ?? []).map((item) => {
                const selected = amenities[category].includes(item.code);
                return (
                  <Pressable
                    key={item.code}
                    onPress={() =>
                      setAmenities((current) => ({
                        ...current,
                        [category]: selected
                          ? current[category].filter((x) => x !== item.code)
                          : [...current[category], item.code],
                      }))
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`min-h-11 justify-center rounded-full border px-3 ${selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                    <Text
                      className={`text-sm ${selected ? 'font-bold text-primary' : 'text-secondary'}`}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!catalog && !catalogError ? <ActivityIndicator className="mt-3 text-primary" /> : null}
            {catalogError ? (
              <ErrorNotice message={`Không tải được tiện ích: ${catalogError}`} />
            ) : null}
            {catalogError ? (
              <Pressable
                onPress={() => setCatalogRefresh((current) => current + 1)}
                accessibilityRole="button"
                className="mt-2 min-h-11 items-center justify-center rounded-xl border border-primary-border bg-primary-soft">
                <Text className="font-semibold text-primary">Tải lại danh mục</Text>
              </Pressable>
            ) : null}
            <View className="mt-7">
              <SectionTitle
                title="Trang thiết bị bàn giao"
                note="Liệt kê nội thất hoặc tài sản đi kèm, nếu có."
              />
            </View>
            {assets.map((asset, index) => (
              <View key={index} className="mt-3 rounded-2xl border border-border bg-surface p-3">
                <Field
                  label="Tên tài sản"
                  value={asset.name}
                  onChangeText={(name) =>
                    setAssets((current) =>
                      current.map((row, i) => (i === index ? { ...row, name } : row))
                    )
                  }
                  placeholder="Ví dụ: Máy lạnh"
                />
                <Field
                  label="Số lượng"
                  value={asset.quantity}
                  keyboardType="number-pad"
                  onChangeText={(quantity) =>
                    setAssets((current) =>
                      current.map((row, i) => (i === index ? { ...row, quantity } : row))
                    )
                  }
                  placeholder="1"
                />
                <Choice
                  label="Tình trạng"
                  options={['Mới', 'Tốt', 'Đã sử dụng']}
                  value={asset.condition}
                  onChange={(condition) =>
                    setAssets((current) =>
                      current.map((row, i) => (i === index ? { ...row, condition } : row))
                    )
                  }
                />
                <Pressable
                  onPress={() => setAssets((current) => current.filter((_, i) => i !== index))}
                  className="mt-3 min-h-10 justify-center self-end px-2">
                  <Text className="font-semibold text-danger">Xóa tài sản</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() =>
                setAssets((current) => [...current, { name: '', quantity: '1', condition: 'Tốt' }])
              }
              accessibilityRole="button"
              className="mt-3 min-h-12 flex-row items-center justify-center rounded-xl border border-primary-border bg-primary-soft">
              <Icon name="add" size={19} className="text-primary" />
              <Text className="ml-1 font-semibold text-primary">Thêm tài sản</Text>
            </Pressable>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <SectionTitle
              title="Giá thuê & điều kiện"
              note="Người thuê sẽ nhìn thấy các khoản phải trả trước khi gửi yêu cầu."
            />
            <Field
              label="Giá thuê *"
              value={pricing.priceMonthly ?? ''}
              keyboardType="number-pad"
              onChangeText={(value) => setPrice('priceMonthly', value.replace(/\D/g, ''))}
              placeholder="Ví dụ: 5000000"
            />
            <Choice
              label="Đơn vị giá"
              options={
                category === 'room'
                  ? ['VNĐ / phòng / tháng', 'VNĐ / người / tháng', 'VNĐ / tháng']
                  : ['VNĐ / tháng']
              }
              value={pricing.priceUnit}
              onChange={(value) => setPrice('priceUnit', value)}
            />
            <Choice
              label="Có thể thương lượng"
              options={['Có', 'Không']}
              value={pricing.negotiable ?? ''}
              onChange={(value) => setPrice('negotiable', value)}
            />
            <Choice
              label="Tiền cọc"
              options={['Không cọc', 'Số tiền', 'Số tháng']}
              value={pricing.depositType}
              onChange={(value) => setPrice('depositType', value)}
            />
            {pricing.depositType !== 'Không cọc' ? (
              <Field
                label={pricing.depositType === 'Số tháng' ? 'Số tháng cọc' : 'Số tiền cọc (VNĐ)'}
                value={pricing.depositValue ?? ''}
                keyboardType="number-pad"
                onChangeText={(value) => setPrice('depositValue', value.replace(/\D/g, ''))}
              />
            ) : null}
            <Field
              label="Thời hạn thuê tối thiểu (tháng) *"
              value={pricing.minimumLeaseMonths ?? ''}
              keyboardType="number-pad"
              onChangeText={(value) => setPrice('minimumLeaseMonths', value.replace(/\D/g, ''))}
              placeholder="Ví dụ: 6"
            />
            <Choice
              label="Chu kỳ thanh toán"
              options={['Hằng tháng']}
              value={pricing.paymentCycle}
              onChange={(value) => setPrice('paymentCycle', value)}
            />
            {selectedBranch ? (
              <View className="mt-8 rounded-2xl border border-primary-border bg-primary-soft p-4">
                <Text className="font-bold text-foreground">Biểu phí theo chi nhánh</Text>
                <Text className="mt-1 text-sm leading-5 text-secondary">
                  Các khoản phí của “{selectedBranch.name}” sẽ được dùng cho tin này. Bạn có thể sửa
                  biểu phí trong Quản lý chi nhánh.
                </Text>
              </View>
            ) : (
              <>
                <View className="mt-8">
                  <SectionTitle
                    title="Chi phí hàng tháng"
                    note="Chỉ nhập giá riêng cho khoản không bao gồm trong tiền thuê."
                  />
                </View>
                {[
                  ['electricity', 'Điện *', ['Theo kWh', 'Đã bao gồm']],
                  ['water', 'Nước *', ['Theo m³', 'Theo người', 'Theo phòng', 'Đã bao gồm']],
                  ...(category === 'apartment'
                    ? [
                        [
                          'management',
                          'Phí quản lý',
                          ['Theo tháng', 'Theo m²', 'Đã bao gồm', 'Không có'],
                        ],
                      ]
                    : []),
                  ['internet', 'Internet', ['Theo tháng', 'Đã bao gồm', 'Tự trả']],
                  ['garbage', 'Rác', ['Theo tháng', 'Đã bao gồm', 'Không có']],
                  ['motorbike', 'Gửi xe máy', ['Theo xe', 'Đã bao gồm', 'Không có']],
                  ['car', 'Gửi ô tô', ['Theo xe', 'Đã bao gồm', 'Không có']],
                ].map(([key, label, options]) => (
                  <View
                    key={key as string}
                    className="mt-2 rounded-2xl border border-border bg-surface p-3">
                    <Choice
                      label={label as string}
                      options={options as string[]}
                      value={pricing[`${key}Type`] ?? ''}
                      onChange={(value) => setPrice(`${key}Type`, value)}
                    />
                    {pricing[`${key}Type`] &&
                    !['Đã bao gồm', 'Không có', 'Tự trả'].includes(pricing[`${key}Type`]) ? (
                      <Field
                        label={`Đơn giá ${String(label).toLowerCase()}`}
                        value={pricing[`${key}Price`] ?? ''}
                        keyboardType="number-pad"
                        onChangeText={(value) => setPrice(`${key}Price`, value.replace(/\D/g, ''))}
                        placeholder="Nhập số tiền"
                      />
                    ) : null}
                  </View>
                ))}
                <View className="mt-7">
                  <SectionTitle
                    title="Khoản phí khác"
                    note="Có thể thêm các khoản thu riêng không nằm trong danh sách trên."
                  />
                </View>
                {customFees.map((fee, index) => (
                  <View
                    key={index}
                    className="mt-3 rounded-2xl border border-border bg-surface p-3">
                    <Field
                      label="Tên khoản phí"
                      value={fee.name}
                      onChangeText={(name) =>
                        setCustomFees((current) =>
                          current.map((row, i) => (i === index ? { ...row, name } : row))
                        )
                      }
                      placeholder="Ví dụ: Phí vệ sinh"
                    />
                    <Field
                      label="Số tiền (VNĐ)"
                      value={fee.amount}
                      keyboardType="number-pad"
                      onChangeText={(amount) =>
                        setCustomFees((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, amount: amount.replace(/\D/g, '') } : row
                          )
                        )
                      }
                    />
                    <Field
                      label="Đơn vị"
                      value={fee.unit}
                      onChangeText={(unit) =>
                        setCustomFees((current) =>
                          current.map((row, i) => (i === index ? { ...row, unit } : row))
                        )
                      }
                      placeholder="Ví dụ: tháng"
                    />
                    <Pressable
                      onPress={() =>
                        setCustomFees((current) => current.filter((_, i) => i !== index))
                      }
                      className="mt-3 min-h-10 justify-center self-end px-2">
                      <Text className="font-semibold text-danger">Xóa khoản phí</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={() =>
                    setCustomFees((current) => [
                      ...current,
                      { name: '', amount: '', unit: 'tháng' },
                    ])
                  }
                  accessibilityRole="button"
                  className="mt-3 min-h-12 flex-row items-center justify-center rounded-xl border border-primary-border bg-primary-soft">
                  <Icon name="add" size={19} className="text-primary" />
                  <Text className="ml-1 font-semibold text-primary">Thêm khoản phí</Text>
                </Pressable>
              </>
            )}
            <View className="mt-7">
              <SectionTitle
                title="Chính sách & nội quy thuê"
                note="Các mục bắt buộc cần được điền trước khi gửi duyệt."
              />
            </View>
            {catalogError ? (
              <ErrorNotice message={`Không tải được danh mục chính sách: ${catalogError}`} />
            ) : null}
            {catalogError ? (
              <Pressable
                onPress={() => setCatalogRefresh((current) => current + 1)}
                accessibilityRole="button"
                className="mt-2 min-h-11 items-center justify-center rounded-xl border border-primary-border bg-primary-soft">
                <Text className="font-semibold text-primary">Tải lại danh mục</Text>
              </Pressable>
            ) : null}
            {!catalog && !catalogError ? <ActivityIndicator className="mt-3 text-primary" /> : null}
            {catalog?.policies.map((definition) => (
              <View
                key={definition.code}
                className="mt-3 rounded-2xl border border-border bg-surface p-3">
                {definition.valueType === 'PERMISSION' ? (
                  <View>
                    <Text className="text-sm font-semibold text-secondary">
                      {definition.label}
                      {definition.required ? ' *' : ''}
                    </Text>
                    <View className="mt-2 flex-row flex-wrap gap-2">
                      {(definition.choices?.length
                        ? definition.choices
                        : [
                            { value: 'ALLOWED', label: 'Cho phép' },
                            { value: 'NOT_ALLOWED', label: 'Không cho phép' },
                            { value: 'APPROVAL_REQUIRED', label: 'Cần chấp thuận' },
                          ]
                      ).map((choice) => (
                        <Pressable
                          key={choice.value}
                          onPress={() =>
                            setPolicyValues((current) => ({
                              ...current,
                              [definition.code]: choice.value,
                            }))
                          }
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: policyValues[definition.code] === choice.value,
                          }}
                          className={`min-h-11 justify-center rounded-xl border px-3 py-2 ${policyValues[definition.code] === choice.value ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                          <Text
                            className={`text-sm ${policyValues[definition.code] === choice.value ? 'font-bold text-primary' : 'text-secondary'}`}>
                            {choice.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : (
                  <Field
                    label={`${definition.label}${definition.required ? ' *' : ''}${definition.unitLabel ? ` (${definition.unitLabel})` : ''}`}
                    value={policyValues[definition.code] ?? ''}
                    onChangeText={(value) =>
                      setPolicyValues((current) => ({ ...current, [definition.code]: value }))
                    }
                    keyboardType={definition.valueType === 'INTEGER' ? 'number-pad' : 'default'}
                    placeholder={definition.helpText || 'Nhập thông tin'}
                  />
                )}
                {definition.helpText && definition.valueType === 'PERMISSION' ? (
                  <Text className="mt-2 text-xs text-muted-foreground">{definition.helpText}</Text>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <SectionTitle
              title="Lịch xem nhà"
              note="Chọn những ngày và buổi bạn có thể tiếp khách."
            />
            <Text className="mt-4 text-sm font-semibold text-secondary">Ngày trong tuần *</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {DAYS.map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => toggleValue(days, value, setDays)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: days.includes(value) }}
                  className={`h-11 min-w-11 items-center justify-center rounded-xl border px-3 ${days.includes(value) ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                  <Text
                    className={`font-semibold ${days.includes(value) ? 'text-primary' : 'text-secondary'}`}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="mt-6 text-sm font-semibold text-secondary">Buổi xem *</Text>
            {SLOTS.map(([value, label, time]) => (
              <Pressable
                key={value}
                onPress={() => toggleValue(slots, value, setSlots)}
                accessibilityRole="button"
                accessibilityState={{ selected: slots.includes(value) }}
                className={`mt-2 min-h-14 flex-row items-center rounded-xl border px-4 ${slots.includes(value) ? 'border-primary bg-primary-soft' : 'border-border bg-surface'}`}>
                <Text
                  className={`flex-1 font-semibold ${slots.includes(value) ? 'text-primary' : 'text-foreground'}`}>
                  {label}
                </Text>
                <Text className="text-xs text-muted-foreground">{time}</Text>
              </Pressable>
            ))}
            <View className="mt-8">
              <SectionTitle
                title="Mô tả chi tiết"
                note="Giúp người thuê hình dung căn nhà và các điểm nổi bật."
              />
            </View>
            <Field
              label="Nội dung mô tả *"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={7}
              textAlignVertical="top"
              placeholder="Mô tả không gian sống, tiện nghi, giao thông..."
            />
            <Text className="mt-2 text-right text-xs text-muted-foreground">
              {description.length} ký tự
            </Text>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <SectionTitle
              title="Kiểm tra trước khi gửi"
              note="Chạm vào một mục để quay lại bước đó và chỉnh sửa."
            />
            {LISTING_STEPS.slice(0, 5).map((label, index) => {
              const summary = [
                `${categoryLabel} · ${basic.title || 'Chưa có tiêu đề'}`,
                `${selectedBranch?.display || location.display || 'Chưa chọn địa chỉ'} · ${images.length} ảnh · ${videos.length} video`,
                `${requiredDetails.filter((field) => details[category][field.key]?.trim()).length}/${requiredDetails.length} trường bắt buộc · ${amenities[category].length} tiện ích`,
                `${pricing.priceMonthly ? Number(pricing.priceMonthly).toLocaleString('vi-VN') + ' đ' : 'Chưa có giá thuê'} · ${pricing.depositType}`,
                `${days.length} ngày · ${slots.length} buổi · ${description ? 'Đã có mô tả' : 'Chưa có mô tả'}`,
              ][index];
              return (
                <Pressable
                  key={label}
                  onPress={() => goTo(index)}
                  accessibilityRole="button"
                  className="mt-3 flex-row items-center rounded-2xl border border-border bg-surface p-4">
                  <View
                    className={`h-10 w-10 items-center justify-center rounded-xl ${missing[index].length ? 'bg-warning-soft' : 'bg-success-soft'}`}>
                    <Icon
                      name={
                        missing[index].length ? 'alert-circle-outline' : 'checkmark-circle-outline'
                      }
                      size={21}
                      className={missing[index].length ? 'text-warning' : 'text-success'}
                    />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="font-bold text-foreground">
                      {index + 1}. {label}
                    </Text>
                    <Text numberOfLines={2} className="mt-1 text-xs text-muted-foreground">
                      {summary}
                    </Text>
                    {missing[index].length ? (
                      <Text className="mt-1 text-xs font-semibold text-warning">
                        Còn thiếu: {missing[index].join(', ')}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name="chevron-forward" size={18} className="text-subtle" />
                </Pressable>
              );
            })}
            <View className="mt-6 rounded-2xl border border-primary-border bg-primary-soft p-4">
              <Text className="font-bold text-foreground">Hoàn tất tin đăng</Text>
              <Text className="mt-2 text-sm leading-5 text-secondary">
                Cả lưu nháp và gửi duyệt đều cần đủ thông tin cơ bản, địa chỉ, ảnh, giá và mô tả.
                Gửi duyệt cần thêm các chính sách bắt buộc.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View className="border-t border-border bg-surface px-5 pb-3 pt-3">
        {step === 5 ? (
          <View className="gap-2">
            <Pressable
              onPress={() => goTo(4)}
              disabled={busy}
              accessibilityRole="button"
              className="min-h-10 items-center justify-center">
              <Text className="font-semibold text-secondary">Quay lại chỉnh sửa</Text>
            </Pressable>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => void submit('SAVE_DRAFT')}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                className="min-h-12 flex-1 items-center justify-center rounded-xl border border-primary bg-primary-soft">
                <Text className="font-bold text-primary">Lưu nháp</Text>
              </Pressable>
              <Pressable
                onPress={() => void submit('SUBMIT_FOR_REVIEW')}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                className={`min-h-12 flex-1 items-center justify-center rounded-xl ${busy ? 'bg-disabled' : 'bg-brand'}`}>
                <Text className={`font-bold ${busy ? 'text-on-disabled' : 'text-on-brand'}`}>
                  {busy ? 'Đang xử lý...' : 'Gửi duyệt'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => (step ? goTo(step - 1) : exit())}
              accessibilityRole="button"
              className="min-h-12 flex-1 items-center justify-center rounded-xl border border-border bg-surface">
              <Text className="font-bold text-secondary">{step ? 'Quay lại' : 'Thoát'}</Text>
            </Pressable>
            <Pressable
              onPress={() => goTo(step + 1)}
              accessibilityRole="button"
              className="min-h-12 flex-[2] items-center justify-center rounded-xl bg-brand">
              <Text className="font-bold text-on-brand">Tiếp tục</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
