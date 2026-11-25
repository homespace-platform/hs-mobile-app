// Port of hs-web-app lib/contract-property-feature-labels.ts (Object.hasOwn -> hasOwnProperty.call for Hermes).
/** Presentation only; keep stored codes and free-entered descriptions unchanged. */
export function contractPropertyFeatureValue(featureName: unknown, raw: unknown): string {
  const original = String(raw ?? '');
  const field = String(featureName ?? '')
    .trim()
    .toLocaleLowerCase('vi-VN');
  const key = original.trim().toLocaleUpperCase('vi-VN');
  let labels: Record<string, string> = {};
  switch (field) {
    case 'tình trạng nội thất':
      labels = {
        UNFURNISHED: 'Không nội thất',
        BASIC: 'Nội thất cơ bản',
        PARTIALLY_FURNISHED: 'Nội thất một phần',
        FULLY_FURNISHED: 'Đầy đủ nội thất',
        LUXURY: 'Nội thất cao cấp',
      };
      break;
    case 'loại lối đi':
    case 'lối đi':
      labels = {
        PRIVATE: 'Riêng biệt',
        SHARED: 'Dùng chung',
        'ĐƯỜNG NỘI BỘ': 'Đường nội bộ',
        'HẺM XE HƠI': 'Hẻm xe hơi',
        'HẺM XE MÁY': 'Hẻm xe máy',
        'MẶT TIỀN': 'Mặt tiền',
      };
      break;
    case 'nhà vệ sinh':
    case 'khu vực bếp':
    case 'ban công':
    case 'đồng hồ điện':
    case 'đồng hồ nước':
      labels = { PRIVATE: 'Riêng', SHARED: 'Dùng chung', NONE: 'Không có' };
      break;
    case 'giờ giấc sinh hoạt':
      labels = { FLEXIBLE: 'Tự do giờ giấc', FREE: 'Tự do giờ giấc', CURFEW: 'Có giờ đóng cửa' };
      break;
    case 'chính sách gửi xe':
      labels = { NONE: 'Không có chỗ gửi xe', FREE: 'Miễn phí', PAID: 'Có thu phí' };
      break;
    case 'hướng cửa chính':
    case 'hướng ban công':
      labels = {
        EAST: 'Đông',
        WEST: 'Tây',
        SOUTH: 'Nam',
        NORTH: 'Bắc',
        SOUTH_EAST: 'Đông Nam',
        SOUTHEAST: 'Đông Nam',
        NORTH_EAST: 'Đông Bắc',
        NORTHEAST: 'Đông Bắc',
        SOUTH_WEST: 'Tây Nam',
        SOUTHWEST: 'Tây Nam',
        NORTH_WEST: 'Tây Bắc',
        NORTHWEST: 'Tây Bắc',
      };
      break;
    case 'tình trạng pháp lý':
    case 'pháp lý':
    case 'giấy tờ pháp lý':
      labels = {
        NONE: 'Chưa cập nhật',
        PINK_BOOK: 'Sổ hồng',
        RED_BOOK: 'Sổ đỏ',
        CONTRACT: 'Hợp đồng mua bán',
        PENDING: 'Đang chờ cấp giấy tờ',
        OTHER: 'Khác',
      };
      break;
  }
  return (Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : original).replace(
    /m²/g,
    'mét vuông'
  );
}
