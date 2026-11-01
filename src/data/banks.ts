export interface BankInfo {
  bin: string;
  code: string;
  name: string;
  shortName: string;
}

export const VIETNAMESE_BANKS: BankInfo[] = [
  { bin: '970422', code: 'MB', name: 'Ngân hàng Quân Đội', shortName: 'MBBank' },
  {
    bin: '970436',
    code: 'VCB',
    name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    shortName: 'Vietcombank',
  },
  {
    bin: '970415',
    code: 'CTG',
    name: 'Ngân hàng TMCP Công Thương Việt Nam',
    shortName: 'VietinBank',
  },
  {
    bin: '970418',
    code: 'BIDV',
    name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    shortName: 'BIDV',
  },
  {
    bin: '970407',
    code: 'TCB',
    name: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
    shortName: 'Techcombank',
  },
  { bin: '970432', code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank' },
  { bin: '970416', code: 'ACB', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB' },
  { bin: '970423', code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank' },
  { bin: '970437', code: 'HDB', name: 'Ngân hàng TMCP Phát triển TP.HCM', shortName: 'HDBank' },
  { bin: '970403', code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank' },
  { bin: '970441', code: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam', shortName: 'VIB' },
  { bin: '970443', code: 'SHB', name: 'Ngân hàng TMCP Sài Gòn - Hà Nội', shortName: 'SHB' },
  { bin: '970448', code: 'OCB', name: 'Ngân hàng TMCP Phương Đông', shortName: 'OCB' },
  { bin: '970426', code: 'MSB', name: 'Ngân hàng TMCP Hàng Hải', shortName: 'MSB' },
  { bin: '970440', code: 'SEAB', name: 'Ngân hàng TMCP Đông Nam Á', shortName: 'SeABank' },
  { bin: '970449', code: 'LPB', name: 'Ngân hàng TMCP Bưu Điện Liên Việt', shortName: 'LPBank' },
  { bin: '970428', code: 'NAB', name: 'Ngân hàng TMCP Nam Á', shortName: 'Nam A Bank' },
  {
    bin: '970412',
    code: 'PVCB',
    name: 'Ngân hàng TMCP Đại Chúng Việt Nam',
    shortName: 'PVcomBank',
  },
  { bin: '970409', code: 'BAB', name: 'Ngân hàng TMCP Bắc Á', shortName: 'Bac A Bank' },
  {
    bin: '970424',
    code: 'SHBVN',
    name: 'Ngân hàng TNHH MTV Shinhan Việt Nam',
    shortName: 'Shinhan Bank',
  },
  { bin: '963388', code: 'TIMO', name: 'Ngân hàng số Timo', shortName: 'Timo by BVBank' },
  { bin: '546034', code: 'CAKE', name: 'Ngân hàng số Cake by VPBank', shortName: 'Cake by VPBank' },
];
