// Field and option metadata of the web editor components (labels, enum values, order).
// `key` indexes the matching state object; `errorKey` defaults to `key` (see listing-validation).
import type { PropertyCategoryKey, MonthlyExpensesData } from '@/lib/listing-form';

export type ListingOption = { value: string; label: string };
export type ListingField = {
  key: string;
  label: string;
  /** `furnishing-assets` marks where the handover table goes. `checkbox` stores a boolean. */
  type: 'text' | 'number' | 'select' | 'checkbox' | 'furnishing-assets';
  required?: boolean;
  options?: ListingOption[];
  placeholder?: string;
  hint?: string;
  maxLength?: number;
};

const options = (...pairs: [string, string][]): ListingOption[] =>
  pairs.map(([value, label]) => ({ value, label }));

export const ORIENTATIONS = options(
  ['EAST', 'Đông'],
  ['WEST', 'Tây'],
  ['SOUTH', 'Nam'],
  ['NORTH', 'Bắc'],
  ['SOUTH_EAST', 'Đông Nam'],
  ['NORTH_EAST', 'Đông Bắc'],
  ['SOUTH_WEST', 'Tây Nam'],
  ['NORTH_WEST', 'Tây Bắc']
);
export const FURNISHING_OPTIONS = options(
  ['RAW', 'Bàn giao thô / Chưa có nội thất'],
  ['BASIC', 'Nội thất cơ bản'],
  ['PARTIAL', 'Nội thất một phần'],
  ['FULL', 'Đầy đủ nội thất'],
  ['LUXURY', 'Nội thất cao cấp']
);
export const HANDOVER_CONDITIONS = options(
  ['BRAND_NEW', 'Mới 100%'],
  ['GOOD', 'Còn tốt'],
  ['NORMAL', 'Bình thường'],
  ['USED_ACCEPTABLE', 'Cũ, còn dùng được'],
  ['MINOR_DAMAGE', 'Hư hỏng nhẹ']
);
export const LEGAL_STATUS_OPTIONS = options(
  ['PENDING', 'Đang chờ sổ'],
  ['PINK_BOOK', 'Sổ hồng / Sổ đỏ'],
  ['CONTRACT', 'Hợp đồng mua bán'],
  ['OTHER', 'Giấy tờ hợp lệ khác']
);

const text = (key: string, label: string, extra: Partial<ListingField> = {}): ListingField => ({
  key,
  label,
  type: 'text',
  ...extra,
});
const num = (key: string, label: string, extra: Partial<ListingField> = {}) =>
  text(key, label, { type: 'number', ...extra });
const select = (
  key: string,
  label: string,
  list: ListingOption[],
  extra: Partial<ListingField> = {}
) => text(key, label, { type: 'select', options: list, ...extra });
const checkbox = (key: string, label: string) => text(key, label, { type: 'checkbox' });

const furnishing = select('furnishing', 'Tình trạng nội thất', FURNISHING_OPTIONS, {
  required: true,
});
const assets = text('furnishingAssets', 'Nội thất & trang thiết bị bàn giao', {
  type: 'furnishing-assets',
});
const legal = select('legalStatus', 'Giấy tờ pháp lý', LEGAL_STATUS_OPTIONS);

/** apartment -> state.apartmentDetails, house -> houseDetails, room -> roomDetails. */
export const DETAIL_SECTIONS: Record<
  PropertyCategoryKey,
  { title: string; description: string; fields: ListingField[] }
> = {
  apartment: {
    title: 'Thông tin chi tiết — Căn hộ chung cư',
    description: 'Chi tiết về diện tích, số phòng, tầng và hiện trạng căn hộ',
    fields: [
      text('projectName', 'Tên dự án / Chung cư', {
        required: true,
        placeholder: 'Ví dụ: Vinhomes Central Park, Masteri Thảo Điền...',
      }),
      text('buildingBlock', 'Tòa / Block', { placeholder: 'Ví dụ: Landmark 81, Tòa A2' }),
      text('unitNumber', 'Mã căn', {
        hint: 'Mã số căn hộ (tùy chọn)',
        placeholder: 'Ví dụ: L81-12.04',
      }),
      num('areaM2', 'Diện tích (mét vuông)', { required: true, placeholder: 'Ví dụ: 75' }),
      num('floor', 'Tầng căn hộ', { required: true, placeholder: 'Ví dụ: 12' }),
      num('totalFloors', 'Tổng số tầng tòa nhà', { placeholder: 'Ví dụ: 35' }),
      num('bedrooms', 'Số phòng ngủ', { required: true, placeholder: 'Ví dụ: 2' }),
      num('bathrooms', 'Số phòng tắm / WC', { required: true, placeholder: 'Ví dụ: 2' }),
      num('livingRooms', 'Số phòng khách', { placeholder: 'Ví dụ: 1' }),
      num('kitchens', 'Số phòng bếp', { placeholder: 'Ví dụ: 1' }),
      furnishing,
      assets,
      select('doorOrientation', 'Hướng cửa chính', [
        { value: '', label: '-- Không xác định --' },
        ...ORIENTATIONS,
      ]),
      select('balconyOrientation', 'Hướng ban công', [
        { value: '', label: '-- Không xác định / Không có ban công --' },
        ...ORIENTATIONS,
      ]),
      text('view', 'View căn hộ', {
        placeholder: 'Ví dụ: View sông Sài Gòn, View công viên, View hồ bơi...',
      }),
      num('maxOccupants', 'Số người ở tối đa', { placeholder: 'Ví dụ: 4 người' }),
      legal,
    ],
  },
  house: {
    title: 'Thông tin chi tiết — Nhà nguyên căn',
    description: 'Chi tiết về kết cấu, diện tích sử dụng, số tầng và tiện nghi của ngôi nhà',
    fields: [
      num('totalUsableAreaM2', 'Tổng diện tích sử dụng (mét vuông)', {
        required: true,
        hint: 'Tổng diện tích sàn tất cả các tầng cộng lại',
        placeholder: 'Ví dụ: 180',
      }),
      num('landAreaM2', 'Diện tích đất (mét vuông)', {
        hint: 'Diện tích khuôn viên đất',
        placeholder: 'Ví dụ: 60',
      }),
      num('facadeWidthM', 'Chiều ngang mặt tiền (m)', { placeholder: 'Ví dụ: 4.5' }),
      num('lengthM', 'Chiều dài (m)', { placeholder: 'Ví dụ: 15' }),
      num('streetWidthM', 'Độ rộng đường/hẻm phía trước (m)', {
        hint: 'Độ rộng mặt đường/hẻm xe hơi ra vào',
        placeholder: 'Ví dụ: 6 (xe hơi vào tận cửa)',
      }),
      select(
        'frontageCount',
        'Số mặt tiền',
        options(['1', '1 mặt tiền'], ['2', '2 mặt tiền (Căn góc)'], ['3', '3 mặt tiền'])
      ),
      num('totalFloors', 'Tổng số tầng', {
        required: true,
        hint: 'Ví dụ: 1 trệt 2 lầu = 3 tầng',
        placeholder: 'Ví dụ: 3',
      }),
      furnishing,
      assets,
      num('bedrooms', 'Số phòng ngủ', { required: true, placeholder: 'Ví dụ: 3' }),
      num('bathrooms', 'Số phòng tắm / WC', { required: true, placeholder: 'Ví dụ: 3' }),
      num('livingRooms', 'Số phòng khách', { placeholder: 'Ví dụ: 1' }),
      num('kitchens', 'Số phòng bếp', { placeholder: 'Ví dụ: 1' }),
      checkbox('hasRooftopTerrace', 'Có sân thượng'),
      checkbox('hasGarage', 'Có garage / sân để xe'),
      select(
        'privateEntrance',
        'Lối đi',
        options(['PRIVATE', 'Lối đi riêng biệt'], ['SHARED', 'Lối đi chung'])
      ),
      num('maxOccupants', 'Số người ở tối đa', { placeholder: 'Ví dụ: 6 người' }),
      num('maxVehicles', 'Số xe tối đa', { placeholder: 'Ví dụ: 4 xe máy, 1 ô tô' }),
      legal,
    ],
  },
  room: {
    title: 'Thông tin chi tiết — Phòng trọ',
    description: 'Chi tiết về tiện nghi phòng, khu vệ sinh, nội thất và quy định sinh hoạt',
    fields: [
      num('areaM2', 'Diện tích phòng (mét vuông)', { required: true, placeholder: 'Ví dụ: 25' }),
      text('roomCode', 'Mã phòng / Tên phòng', {
        required: true,
        maxLength: 255,
        hint: 'Nhập mã hoặc tên để nhận diện phòng này.',
        placeholder: 'Ví dụ: P.202, Phòng A3',
      }),
      select(
        'toiletType',
        'Nhà vệ sinh',
        options(
          ['PRIVATE', 'Nhà vệ sinh riêng khép kín trong phòng'],
          ['SHARED', 'Nhà vệ sinh chung ngoài phòng']
        ),
        { required: true }
      ),
      select(
        'kitchenType',
        'Khu bếp nấu ăn',
        options(
          ['PRIVATE', 'Kệ bếp riêng trong phòng'],
          ['SHARED', 'Khu bếp chung'],
          ['NONE', 'Không nấu ăn / Không có bếp']
        )
      ),
      select(
        'hasWindow',
        'Cửa sổ phòng',
        options(
          ['YES', 'Có cửa sổ thông thoáng đón gió/sáng'],
          ['NO', 'Không có cửa sổ (Phòng kín máy lạnh)']
        )
      ),
      select(
        'hasBalcony',
        'Ban công',
        options(
          ['PRIVATE', 'Ban công riêng phơi đồ / ngắm cảnh'],
          ['SHARED', 'Ban công / sân phơi chung'],
          ['NONE', 'Không có ban công']
        )
      ),
      num('roomFloor', 'Tầng của phòng', { placeholder: 'Ví dụ: 2 (Tầng 2)' }),
      furnishing,
      checkbox('hasLoft', 'Phòng có gác lửng cao ráo (tăng diện tích sinh hoạt)'),
      assets,
      num('maxOccupants', 'Số người tối đa / phòng', {
        required: true,
        placeholder: 'Ví dụ: 2 người',
      }),
      num('maxVehicles', 'Số xe tối đa / phòng', { placeholder: 'Ví dụ: 2 xe máy' }),
      select(
        'entranceType',
        'Lối đi',
        options(
          ['PRIVATE', 'Lối đi riêng biệt (Tự do ra vào)'],
          ['SHARED', 'Lối đi chung với chủ nhà']
        )
      ),
      select(
        'curfewType',
        'Giờ giấc sinh hoạt',
        options(
          ['FREE', 'Tự do 24/7 (Khóa vân tay / Thẻ từ)'],
          ['CURFEW', 'Có giờ đóng cửa buổi tối (VD: 23:00)']
        )
      ),
      select(
        'electricityMeter',
        'Đồng hồ điện',
        options(['PRIVATE', 'Đồng hồ điện riêng từng phòng'], ['SHARED', 'Dùng chung đồng hồ tổng'])
      ),
      select(
        'waterMeter',
        'Đồng hồ nước',
        options(
          ['PRIVATE', 'Đồng hồ nước riêng từng phòng'],
          ['SHARED', 'Dùng chung / Tính theo đầu người']
        )
      ),
      select(
        'parkingPolicy',
        'Chính sách chỗ để xe',
        options(
          ['FREE', 'Miễn phí chỗ để xe trong nhà / hầm xe'],
          ['PAID', 'Có thu phí gửi xe hàng tháng (Kê khai ở mục Chi phí)'],
          ['NONE', 'Không có chỗ để xe (Gửi bãi ngoài)']
        )
      ),
    ],
  },
};

export type ExpenseControl = {
  typeKey: keyof MonthlyExpensesData;
  priceKey: keyof MonthlyExpensesData;
  label: string;
  placeholder: string;
  /** `unit` set = the price input is shown; otherwise show `note` instead. */
  options: (ListingOption & { unit?: string; note?: string })[];
  apartmentOnly?: boolean;
};

/** Always editable, also when a branch is selected (web behaviour). */
export const EXPENSE_CONTROLS: ExpenseControl[] = [
  {
    typeKey: 'electricityType',
    priceKey: 'electricityPrice',
    label: 'Tiền điện',
    placeholder: '3500',
    options: [
      { value: 'KWH', label: 'Tính theo số công tơ (kWh)', unit: 'đ/kWh' },
      { value: 'INCLUDED', label: 'Đã bao gồm trong giá thuê', note: 'Miễn phí tiền điện' },
    ],
  },
  {
    typeKey: 'waterType',
    priceKey: 'waterPrice',
    label: 'Tiền nước',
    placeholder: '25000',
    options: [
      { value: 'M3', label: 'Tính theo khối (m³)', unit: 'đ/m³' },
      { value: 'PER_PERSON', label: 'Tính theo người / tháng', unit: 'đ/người' },
      { value: 'FLAT_ROOM', label: 'Khoán theo phòng / tháng', unit: 'đ/phòng' },
      { value: 'INCLUDED', label: 'Đã bao gồm trong giá thuê', note: 'Miễn phí tiền nước' },
    ],
  },
  {
    typeKey: 'managementFeeType',
    priceKey: 'managementFee',
    label: 'Phí quản lý',
    placeholder: '150000',
    apartmentOnly: true,
    options: [
      { value: 'NONE', label: 'Không áp dụng', note: 'Không áp dụng' },
      { value: 'MONTHLY', label: 'Cố định theo tháng', unit: 'đ/tháng' },
      { value: 'PER_M2', label: 'Tính theo mét vuông / tháng', unit: 'đ/mét vuông' },
      { value: 'INCLUDED', label: 'Đã bao gồm trong giá thuê', note: 'Đã bao gồm trong giá' },
    ],
  },
  {
    typeKey: 'internetType',
    priceKey: 'internetFee',
    label: 'Internet / Wifi',
    placeholder: '100000',
    options: [
      { value: 'SELF_PAY', label: 'Người thuê tự đăng ký', note: 'Tự đăng ký' },
      { value: 'MONTHLY', label: 'Cố định theo phòng / tháng', unit: 'đ/tháng' },
      { value: 'INCLUDED', label: 'Miễn phí / Đã bao gồm', note: 'Miễn phí Wifi' },
    ],
  },
  {
    typeKey: 'garbageFeeType',
    priceKey: 'garbageFee',
    label: 'Phí vệ sinh / Rác',
    placeholder: '50000',
    options: [
      { value: 'INCLUDED', label: 'Đã bao gồm trong giá thuê', note: 'Đã bao gồm' },
      { value: 'MONTHLY', label: 'Thu theo phòng / tháng', unit: 'đ/tháng' },
      { value: 'PER_PERSON', label: 'Thu theo người / tháng', unit: 'đ/người/tháng' },
      { value: 'NONE', label: 'Không áp dụng', note: 'Không áp dụng' },
    ],
  },
  {
    typeKey: 'motorbikeParkingType',
    priceKey: 'motorbikeParkingFee',
    label: 'Phí gửi xe máy',
    placeholder: '120000',
    options: [
      { value: 'NONE', label: 'Không nhận giữ xe máy', note: 'Không giữ xe' },
      { value: 'INCLUDED', label: 'Miễn phí giữ xe', note: 'Miễn phí' },
      { value: 'PER_VEHICLE', label: 'Thu phí theo xe / tháng', unit: 'đ/xe/tháng' },
    ],
  },
  {
    typeKey: 'carParkingType',
    priceKey: 'carParkingFee',
    label: 'Phí gửi ô tô',
    placeholder: '1200000',
    options: [
      { value: 'NONE', label: 'Không nhận giữ ô tô', note: 'Không giữ ô tô' },
      { value: 'INCLUDED', label: 'Miễn phí giữ ô tô', note: 'Miễn phí' },
      { value: 'PER_VEHICLE', label: 'Thu phí theo xe / tháng', unit: 'đ/xe/tháng' },
    ],
  },
];
