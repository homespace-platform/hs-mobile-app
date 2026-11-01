export const LISTING_STEPS = [
  'Loại tin & cơ bản',
  'Vị trí & hình ảnh',
  'Đặc điểm & tiện ích',
  'Giá & điều kiện',
  'Lịch xem & mô tả',
  'Kiểm tra tin',
] as const;

export const LISTING_CATEGORIES = [
  { key: 'apartment', label: 'Căn hộ', icon: 'business-outline' },
  { key: 'house', label: 'Nhà nguyên căn', icon: 'home-outline' },
  { key: 'room', label: 'Phòng trọ', icon: 'bed-outline' },
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number]['key'];

export type DetailField = {
  key: string;
  label: string;
  required?: boolean;
  number?: boolean;
  options?: readonly string[];
};

const furnishing = ['Bàn giao thô', 'Cơ bản', 'Một phần', 'Đầy đủ', 'Cao cấp'];
const directions = ['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Nam', 'Đông Bắc', 'Tây Nam', 'Tây Bắc'];
const legal = ['Sổ hồng / Sổ đỏ', 'Hợp đồng mua bán', 'Đang chờ sổ', 'Khác'];
const yesNo = ['Có', 'Không'];

export const DETAIL_FIELDS: Record<ListingCategory, { main: DetailField[]; more: DetailField[] }> =
  {
    apartment: {
      main: [
        { key: 'projectName', label: 'Tên dự án / tòa nhà', required: true },
        { key: 'areaM2', label: 'Diện tích căn hộ (m²)', required: true, number: true },
        { key: 'floor', label: 'Tầng căn hộ', required: true, number: true },
        { key: 'bedrooms', label: 'Phòng ngủ', number: true },
        { key: 'bathrooms', label: 'Phòng tắm / WC', number: true },
        { key: 'furnishing', label: 'Tình trạng nội thất', options: furnishing },
      ],
      more: [
        { key: 'buildingBlock', label: 'Block / tòa' },
        { key: 'unitNumber', label: 'Số căn hộ' },
        { key: 'livingRooms', label: 'Phòng khách', number: true },
        { key: 'kitchens', label: 'Phòng bếp', number: true },
        { key: 'totalFloors', label: 'Tổng số tầng', number: true },
        { key: 'doorOrientation', label: 'Hướng cửa chính', options: directions },
        { key: 'balconyOrientation', label: 'Hướng ban công', options: directions },
        { key: 'view', label: 'View căn hộ' },
        { key: 'maxOccupants', label: 'Số người ở tối đa', number: true },
        { key: 'legalStatus', label: 'Giấy tờ pháp lý', options: legal },
      ],
    },
    house: {
      main: [
        {
          key: 'totalUsableAreaM2',
          label: 'Tổng diện tích sử dụng (m²)',
          required: true,
          number: true,
        },
        { key: 'totalFloors', label: 'Tổng số tầng', required: true, number: true },
        { key: 'bedrooms', label: 'Phòng ngủ', number: true },
        { key: 'bathrooms', label: 'Phòng tắm / WC', number: true },
        { key: 'furnishing', label: 'Tình trạng nội thất', options: furnishing },
      ],
      more: [
        { key: 'landAreaM2', label: 'Diện tích đất (m²)', number: true },
        { key: 'facadeWidthM', label: 'Chiều ngang mặt tiền (m)', number: true },
        { key: 'lengthM', label: 'Chiều dài (m)', number: true },
        { key: 'streetWidthM', label: 'Độ rộng đường / hẻm (m)', number: true },
        { key: 'frontageCount', label: 'Số mặt tiền', number: true },
        { key: 'livingRooms', label: 'Phòng khách', number: true },
        { key: 'kitchens', label: 'Phòng bếp', number: true },
        { key: 'hasRooftopTerrace', label: 'Sân thượng', options: yesNo },
        { key: 'privateEntrance', label: 'Lối đi riêng', options: yesNo },
        { key: 'hasGarage', label: 'Gara ô tô', options: yesNo },
        { key: 'maxOccupants', label: 'Số người ở tối đa', number: true },
        { key: 'maxVehicles', label: 'Số xe tối đa', number: true },
        { key: 'legalStatus', label: 'Giấy tờ pháp lý', options: legal },
      ],
    },
    room: {
      main: [
        { key: 'roomCode', label: 'Mã / tên phòng', required: true },
        { key: 'areaM2', label: 'Diện tích phòng (m²)', required: true, number: true },
        { key: 'maxOccupants', label: 'Số người ở tối đa', required: true, number: true },
        { key: 'toiletType', label: 'Nhà vệ sinh', options: ['Riêng', 'Dùng chung'] },
        { key: 'kitchenType', label: 'Khu bếp', options: ['Riêng', 'Dùng chung', 'Không có'] },
        { key: 'furnishing', label: 'Tình trạng nội thất', options: furnishing },
      ],
      more: [
        { key: 'roomFloor', label: 'Tầng của phòng', number: true },
        { key: 'hasWindow', label: 'Cửa sổ', options: yesNo },
        { key: 'hasBalcony', label: 'Ban công', options: ['Riêng', 'Dùng chung', 'Không có'] },
        { key: 'hasLoft', label: 'Gác lửng', options: yesNo },
        { key: 'entranceType', label: 'Lối đi', options: ['Riêng', 'Dùng chung'] },
        { key: 'curfewType', label: 'Giờ giấc', options: ['Tự do', 'Có giờ đóng cửa'] },
        { key: 'electricityMeter', label: 'Đồng hồ điện', options: ['Riêng', 'Dùng chung'] },
        { key: 'waterMeter', label: 'Đồng hồ nước', options: ['Riêng', 'Dùng chung'] },
        { key: 'maxVehicles', label: 'Số xe tối đa', number: true },
        { key: 'parkingPolicy', label: 'Quy định gửi xe' },
      ],
    },
  };

export const AMENITIES: Record<ListingCategory, readonly string[]> = {
  apartment: [
    'WiFi',
    'Máy lạnh',
    'Thang máy',
    'Bảo vệ',
    'Camera',
    'Hồ bơi',
    'Phòng gym',
    'Chỗ để xe',
  ],
  house: ['WiFi', 'Máy lạnh', 'Máy nước nóng', 'Gara', 'Camera', 'Sân thượng', 'Chỗ để xe'],
  room: ['WiFi', 'Máy lạnh', 'Máy nước nóng', 'Thang máy', 'Camera', 'Chỗ để xe'],
};
