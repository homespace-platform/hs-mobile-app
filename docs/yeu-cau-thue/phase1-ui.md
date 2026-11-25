# Pha 1c-UI — bộ component dùng chung (`src/components/rental/shared/`)

Trạng thái: **XONG** (chưa thử trên thiết bị).

| Component | Trạng thái |
|---|---|
| logic.ts (hàm thuần) | done |
| AppDialog (host lồng nhau) | done |
| ActionButton | done |
| ModalShell | done |
| useActionDialog | done |
| PolicyNotice | done |
| DetailTabs | done |
| Badge, Card, InfoRow, Accordion | done |
| NextActionCard, OnboardingStepper | done |
| StateBlocks | done |
| VndMoneyInput, DecimalInput, DateField (+ FieldFrame) | done |
| EvidencePicker | done |
| EndOfPeriodCharges, RentalCostSummary | done |
| tests/rental-ui.test.cjs, kiểm tra | done |

## Cách dùng

Import: `@/components/rental/shared/<File>`.

### ActionButton
`{label, onClick?, variant?: 'primary'|'secondary'|'danger'|'warning'|'success', icon?, disabled?, busy?, className?}`
`<ActionButton label="Gửi" busy={sending} onClick={send} className="flex-1" />`

### ModalShell (default)
`{title, icon?: tên Ionicons, headerExtra?, onClose, closeDisabled?, size? (bỏ qua), footer?, children, scrollRef?}`
Mở = được mount (như web): `{open && <ModalShell title="…" onClose={close} closeDisabled={busy} footer={<ActionButton …/>}>…</ModalShell>}`.
Modal thứ hai (ModalShell lồng, PDF…) phải đặt TRONG children/footer của modal ngoài (iOS), không đặt cạnh.

### useActionDialog
`const { confirm, askReason, dialog } = useActionDialog();` — options y như web (`title, description?, confirmLabel?, cancelLabel?, tone?`; reason: `label?, placeholder?, minLength=10, maxLength=500`). `confirm → boolean`, `askReason → string (đã trim) | null`.
`dialog` luôn là null (giữ `{dialog}` hay bỏ đều được); hộp thoại tự vẽ ở host trên cùng nên hiện được trên ModalShell dù hook gọi ở ngoài.

### useDialog trong ModalShell
`useDialog()` (thay `toast`) gọi ở bất cứ đâu đều hiện trên ModalShell đang mở. Thông báo gọi ngay trước khi đóng modal được chuyển ra ngoài sau 500 ms. Đây là `<DialogProvider nested>` (bổ sung ở AppDialog; mặc định `nested=false` nên chỗ cũ không đổi).

### PolicyNotice / PolicyConsent / PolicyDialog (`PolicyNotice.tsx`)
`PolicyNotice {summary?, title, text?, children?, tone?: 'info'|'warning'|'neutral', icon?, actionLabel?, subtitle?, version?, className?}`; `PolicyConsent {label, title, version?, text?, children?, onAgree?}`; `PolicyDialog {visible, onClose, title, …}` (web `open` → `visible`). `summary` là string. Trong children dùng `<Text>` (không có `<p>`).
`<PolicyNotice tone="neutral" title="Đối chiếu PDF" summary="…"><Text className="text-sm leading-6 text-secondary">…</Text></PolicyNotice>`

### DetailTabs (default; export `TabItem`, `tabId`)
`{tabs: {id, label, badge?: number|string, hidden?}[], active, onChange, idPrefix?}` — thanh cuộn ngang, tự cuộn tới tab đang chọn; màn hình tự render phần đang chọn (không có tabpanel).
`<DetailTabs tabs={DETAIL_TABS} active={tab} onChange={setTab} />`

### Badge (default) — thay `Pill`
`{tone?: Tone, icon?, children: chuỗi}` — `<Badge tone={requestStatus(s).tone}>{requestStatus(s).label}</Badge>`

### Card / SectionTitle / SectionCard (`Card.tsx`, named)
`Card {children, className?, id?}` · `SectionTitle {title, hint?, action?}` · `SectionCard {title, hint?, action?, children, className?, id?}`
`<SectionCard title="Thanh toán">…</SectionCard>`

### InfoRow (default)
`{label, value: chuỗi|số|ReactNode, stacked?, strong?, className?}` — chuỗi > 22 ký tự tự xuống dòng; chữ chọn/sao chép được.
`<InfoRow label="Tổng cần thanh toán" value={formatVND(total)} strong />`

### Accordion (default) — thay `<details>`
`{title, icon?, badge?, defaultOpen?, open?, onToggle?, children, className?}` — con được giữ khi đóng lại. Chữ trong children cần `<Text>`.
`<Accordion title="Lịch sử" defaultOpen={status === 'PROPOSED'}>…</Accordion>`

### NextActionCard (default; export `CardAction`)
Props y như web: `{role, nextAction?, custom?, fallbackMessage?, primary?, secondary?, extra?}`; `CardAction {label, onClick?, disabled?, busy?}` (không có `href`: điều hướng trong `onClick`). Cập nhật đếm ngược mỗi 30 s.
`<NextActionCard role="TENANT" nextAction={view.nextAction} primary={{label: 'Thanh toán', onClick: pay}} />`

### OnboardingStepper (default)
`{steps: PreTenancyStep[], caption?}` — `<OnboardingStepper steps={steps} />`

### StateBlocks (named)
`Skeleton {className?}` · `PageSkeleton {label?}` · `LoadingBlock {label?}` · `EmptyBlock {title, message?, icon?, action?}` · `ErrorBlock {message, onRetry?, retryLabel='Thử lại', busy?}` — mặc định `label` của LoadingBlock/retry là chữ chung; truyền đúng chuỗi web khi web có chuỗi riêng.
`if (error) return <ErrorBlock message={error} onRetry={load} />;`

### FieldFrame (default; `inputBoxClass`, `inputTextClass`)
`{label?, hint?, error?, children, className?}` — khung cho ô nhập tự viết.

### VndMoneyInput (default)
Props y như web: `{label?, ariaLabel?, value, onValueChange(chuỗi số), disabled?, min=0, max=1_000_000_000, placeholder?, hint?: string, className?}`.
`<VndMoneyInput label="Số tiền (đ)" min={1} value={amount} onValueChange={setAmount} />`
ScrollView bao ngoài cần `keyboardShouldPersistTaps="handled"` để bấm được gợi ý. Dán số có phần thập phân/âm bị từ chối; dán chen vào giữa số đã có cũng có thể bị từ chối (cố ý, không đoán).

### DecimalInput (default)
`{label?, ariaLabel?, value: "12.5", onValueChange, maxDecimals=3, suffix?, disabled?, placeholder?, hint?, error?, className?}` — hiển thị dấu ",", trả "." (dùng `Number()` như web; giá trị có thể là "12." khi đang gõ). Kiểm min/max ở màn hình.
`<DecimalInput label="Chỉ số cuối" suffix="kWh" value={end} onValueChange={setEnd} />`

### DateField (default)
`{label?, ariaLabel?, value: "yyyy-MM-dd"|"", onChange, min?, max?, isDateDisabled?(key), placeholder?, disabled?, hint?, error?, className?}` — `isDateDisabled` nên bọc `useCallback`.
`<DateField label="Ngày hiệu lực" value={on} onChange={setOn} isDateDisabled={(k) => !dates.includes(k)} />`

### EvidencePicker (default)
`{value: LocalFile[], onChange, messages: string | {type,size,count}, types=JPG/PNG/WebP/PDF, maxBytes=15MB, maxCount=1, existingCount=0, onError?, camera?, libraryLabel?, documentLabel?, cameraLabel?, label?, ariaLabel?, disabled?, hint?, error?, className?}`.
Chỉ chọn tệp (không upload): đưa `LocalFile` cho `storageService.upload*`. `maxCount=1` thay tệp; `>1` cộng dồn; cả lượt chọn bị từ chối nếu có 1 tệp sai (như web). `messages` phải là chuỗi web của màn đó.
`<EvidencePicker maxCount={5} existingCount={row.evidenceIds.length} value={row.files} onChange={setFiles} messages="Tối đa 5 ảnh JPG/PNG/WebP hoặc PDF, mỗi tệp không quá 15 MB." />`
Hàm thuần dùng riêng được (`logic.ts`): `normalizeFile`, `fileSelectionError`, `reasonState`, `editVndText`, `parseDecimal`, `toDateKey`/`fromDateKey`, `toneParts`.

### EndOfPeriodCharges, RentalCostSummary (default — web export có tên)
Props y như web: `{predictableCharges?, excludedCharges?, prepaidFees?}` · `{estimate, loading, error, depositBadge, occupantCount?}`.
`<RentalCostSummary estimate={estimate} loading={loading} error={error} depositBadge={badge} />`

## Có sẵn, dùng tiếp (không viết lại)
`ScreenHeader`, `Field`, `ErrorNotice` (`Screen.tsx`) · `Dropdown` (thay `<select>`; `{options: {id,label}[], value, onChange}`; trong ModalShell phải render trong children) · `PageBar` · `Avatar` · `AppCalendar`.

## Quy tắc bố cục
- Nút chạm tối thiểu 44 pt (các component trên đã đạt); khoảng cách theo bội 4 (`gap-2/3/4`); thẻ `rounded-2xl border bg-surface p-4`.
- Màn hình/modal: một nút chính; nút nguy hiểm dùng `variant="danger"`, tách khỏi nút chính.
- Trạng thái luôn có chữ (Badge), không chỉ màu.

## Chưa kiểm trên thiết bị (cả Android và iOS)
- Chưa render component nào trên máy thật/emulator; chỉ có tsc, eslint, test hàm thuần và test theme.
- Modal chồng: hộp thoại/`useDialog` trên ModalShell, ModalShell lồng, DateField/PolicyDialog/Dropdown trong ModalShell. iOS: mở ModalShell ngay khi hộp thoại vừa đóng có thể bị nuốt.
- iOS: nếu một Modal con (lịch, PolicyDialog) đang mở mà `useDialog`/`useActionDialog` được gọi (vd. do realtime), hộp thoại có thể không hiện cho tới khi Modal con đóng.
- Bàn phím trong ModalShell/ActionDialog (KeyboardAvoidingView `height` trên Android), autoFocus ô lý do, vị trí con trỏ ô tiền khi tự chèn dấu chấm.
- Ảnh HEIC: Android và iOS xuất JPEG khi `quality < 1` (suy từ mã nguồn expo-image-picker 17, chưa thử). Android với ảnh WebP có thể cho nội dung JPEG trong tệp gắn nhãn WebP. HEIC chọn qua "Chọn tệp" bị từ chối.

## Kiểm tra

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` (toàn repo, gồm file đang được agent khác sửa tại thời điểm chạy) | sạch |
| eslint `shared/`, `AppDialog.tsx`, test | 0 lỗi, 0 cảnh báo |
| prettier cùng các file | sạch |
| `node --test tests/rental-ui.test.cjs` | 9/9 |
| `npm run test:theme` | 5/5 |
| `npm run test:appointment-booking` | 20/20 (không phủ AppDialog) |

Không thêm token màu, không thêm dependency. Đề xuất cho chủ `package.json`: `"test:rental-ui": "node --test tests/rental-ui.test.cjs"`.
