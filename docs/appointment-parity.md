# Viewing appointments ("Đặt lịch xem"): web to mobile parity

Acceptance checklist. Owner: `[F]` foundation (done), `[A]` booking/reschedule modal and listing
detail, `[B]` renter and landlord management. Mobile status is as of the end of phase F:
**has** / **partial** / **missing**.

Web refs (`hs-web-app/`): **BM** `components/appointment/BookingAppointmentModal.tsx`, **DM**
`.../AppointmentDetailModal.tsx`, **CARD** `.../AppointmentCardCompact.tsx`, **DF**
`.../AppointmentDateFilter.tsx`, **CAL** `.../AppointmentCalendar.tsx`, **DL**
`.../useAppointmentDeepLink.ts`, **NH** `.../useAppointmentNotifications.ts`, **OWN**
`app/dashboard/viewing-schedules/page.tsx`, **MY** `.../my-bookings/page.tsx`, **RD**
`components/rent/RentDetailView.tsx`, **SVC** `services/appointment.service.ts`, **UC**
`components/ui/calendar.tsx`, **NS** `services/notification.service.ts`, **NT**
`components/notification/NotificationTransport.tsx`.

## 0. File ownership (A and B never edit the same file)

| Owner | Files |
| --- | --- |
| A | `components/appointment/BookingAppointmentModal.tsx`, new files only under `components/appointment/booking/`, `screens/ListingDetailScreen.tsx`, `components/listing-detail/*`, `components/{BookingForm,BookingConfirmation,BookingDatePicker}.tsx`, `lib/booking.ts`, `services/bookingApi.ts`, new `tests/appointment-booking.test.cjs` |
| B | `screens/ManagementScreen.tsx`, new files only under `components/appointment/manage/`, `components/AppointmentCalendar.tsx`, `services/managementApi.ts`, `lib/notification.ts`, `screens/NotificationsScreen.tsx`, `lib/dashboard-navigation.ts`, `components/BottomTabBar.tsx`, `App.tsx`, `tests/api.test.cjs` |
| Frozen (ask the coordinator) | `package.json`, lock file, `types/appointment.ts`, `services/appointmentApi.ts`, `lib/appointment.ts`, `lib/appointment-calendar.ts`, `lib/permissions.ts`, `lib/permission-store.ts`, `lib/use-feature-gate.ts`, `components/appointment/AppCalendar.tsx`, `global.css`, `tailwind.config.js`, `tests/appointment.test.cjs` |

Paths are under `src/` except `App.tsx`, `tests/`, `package.json`.

- **A must not delete or change the props of** `BookingForm` (ManagementScreen still imports it until
  B switches to the modal), `BookingDatePicker` (also RentalRequestForm, ListingDraftScreen),
  `lib/booking.ts` or the `bookingApi` re-exports (`tests/api.test.cjs`, which B owns, covers them).
  Delete dead files in a follow-up after both are merged.
- **App.tsx is B's. A needs no new App.tsx prop**: wire `onViewMyBookings={() => onOpenManagement('tenant-appointments')}`
  with the existing ListingDetailScreen prop. KYC uses `startKyc()`; the profile gate is global.
- B uses the modal for rescheduling through the props in the stub; it compiles now and renders null.

## Notes for both agents

- Toasts: web `toast.x(msg)` becomes `useDialog()('Thông báo', msg)`; success uses tone `'success'`.
  The dialog is itself an RN `Modal`. Stacking it over another open `Modal` is **unverified, notably on
  iOS**: show form errors inline, or show the dialog after closing yours. Test on a device.
- Gates: `const gate = useFeatureGate(PERMISSIONS.X)`; disable with `!gate.allowed` and show
  `gate.title` near the button (no tooltip on mobile); `gate.guard()` shows it in a dialog.
- Server errors: web shows `response.data.message || fallback`. Keep each fallback; do not use
  `apiError` alone where web has a specific one. A 1009 already arrives rewritten to the locked text.
- `AppCalendar` calls `onSelect` when the selected day is tapped again. Booking: ignore it. Date
  filter: treat it as "clear" (react-day-picker deselects there).
- Images: web accepts `http(s)://` and `/relative`; only `http(s)` loads on mobile, so show the
  placeholder otherwise. Phone: `Linking.openURL('tel:...')`.
- The web modal and detail views fit in a phone-sized layout; keep the same order and strings.

## F. Foundation

1. [F] All 16 service calls with web endpoints, params, defaults (`page 1`, `size 12`, `ALL`/empty omitted). SVC:10-211. **has** (`services/appointmentApi.ts`; extra optional `signal` on availability, ids URL-encoded)
2. [F] Errors propagate; only `getMyBookingByListing` returns null on failure. SVC:100-111. **has**
3. [F] Types. `types/appointment.type.ts`. **has**
4. [F] Status labels, tones, icons, PENDING fallback. DM:63-97, CARD:53-87. **has**
5. [F] Cancelled-by and slot-type labels; slot period headings with hours. DM:99-109, BM:636-673. **has**
6. [F] Slot caption, tone, disabled rule. BM:813-835. **has** (`getSlotView`)
7. [F] Weekday enum/labels, "Tất cả các ngày", disabled days, jump to next open day. BM:73-91,161-176,557-592. **has**
8. [F] Vietnamese date, time range, VND, date-filter chip state. BM:48-71, DF:21-55,118,159. **has**
9. [F] Monday-first month/week grid, title, step by month/week, weekday headings, grouping/sort. `lib/appointment-calendar.ts`, CAL:28,47-78. **has**
10. [F] Calendar-tab loader: all CONFIRMED then COMPLETED pages, size 50, all or nothing. OWN:78-93, MY:77-92. **has**
11. [F] Actions per status/role with gate and placement; card quick approve. DM:254-282,419-515, CARD:238. **has**
12. [F] Owner dialog copy and required-reason validation. OWN:137-248,456-485. **has**
13. [F] Booking/reschedule validation order, request bodies, default name (last then first), limits. BM:134-140,199-260,733-765. **has**
14. [F] Deep-link parser and status-to-tab map. DL:9-26. **has** (not wired: B)
15. [F] Calendar: `vi`, Monday first, outside days, 36px rounded-12 days, bold "Tháng Mười Một 2026" caption, uppercase "TH 2…CN", nav on the right, brand selected, primary today, 25% disabled. UC:11-71. **has** (`AppCalendar`; not yet viewed on a device; library arrow buttons are labelled "Prev"/"Next" and days do not announce "selected")
16. [F] Permission list, "unknown never blocks", 1009 rewrite and refetch, refetch on role notification / reconnect / foreground. `lib/permissions.ts`, `hooks/usePermission.ts`, `lib/axios-client.ts:121-125`, NT:96-111. **has** (new)
17. [F] Gate priority: locked permission, then `Cần cập nhật: …`. `lib/profile-gate.ts:59-67`. **has** (new)

## A. Listing detail entry

18. [A] On mount (signed in, not preview) look up the active booking. RD:202-212. **has**
19. [A] Button "Đặt lịch xem" (calendar); with PENDING/CONFIRMED "Lịch xem của bạn" (check, success style). RD:526-569. **has**
20. [A] Disabled when not PUBLISHED/RESERVED and no booking; with a booking on a non-public listing it opens my bookings. RD:530-535. **has**
21. [A] Owner tap: "Bạn là chủ bài đăng này, không thể tự đặt lịch xem nhà." RD:536-539. **has**
22. [A] Signed-out toast "Vui lòng đăng nhập để đặt lịch xem nhà" + login. RD:540-544. **has** (n/a: app is signed-in only)
23. [A] `APPOINTMENT_BOOK` gate `guard()`; hint "Đặt lịch hẹn gặp trực tiếp chủ nhà tại bất động sản". RD:545,556. **missing**
24. [A] KYC before opening. Profile unavailable: "Đang tải thông tin tài khoản. Vui lòng thử lại trong giây lát."; unverified: "Vui lòng xác minh danh tính (KYC) trước khi thực hiện thao tác này." + "Xác minh ngay" (`startKyc()`). Use `getUserProfileApi(true)` if the cached value is unverified. RD:546-550, `lib/kyc-gate.ts:19-52`. **missing**
25. [A] Replace the "Tính năng đang phát triển" dialog with the modal; pass id, title, location, price `priceMillion * 1_000_000`, first image, owner id. RD:945-965. **missing**
26. [A] After the modal closes, look the booking up again. RD:948-956. **missing**
27. [A] Section "Lịch hẹn xem nhà": "Ngày tiếp khách trong tuần", "Khung giờ tiếp khách"; hidden when both empty. RD:866-897. **has** (labels say evening 18:00, see W7)

## A. Booking modal

28. [A] Header "Đặt lịch xem nhà" / "Yêu cầu đổi lịch xem nhà", subtitle "Hẹn gặp trực tiếp chủ nhà tại bất động sản", close button. BM:302-325. **partial** (old BookingForm)
29. [A] Listing summary: thumbnail or "Ảnh", title, address, "{VND} / tháng". BM:329-360. **missing**
30. [A] On open and each date change: active booking, then availability for the date; ignore stale responses (old form aborts). BM:148-185. **partial**
31. [A] If the date's weekday is closed, jump to the next open one (`nextAllowedViewingDate`). BM:161-176. **missing**
32. [A] Web only logs load errors and then shows the "closed day" text. Mobile should keep an error + retry (deliberate deviation). BM:177-178. **has** (old form)
33. [A] Existing PENDING/CONFIRMED and not rescheduling: "Lịch hẹn hiện tại của bạn", badge "Chủ nhà đã xác nhận" / "Chờ chủ nhà xác nhận", "Ngày xem", "Khung giờ". BM:363-413. **missing** (old form only shows a warning)
34. [A] "Lời dặn từ chủ nhà:" when `ownerNote`. BM:415-425. **missing**
35. [A] Pending change box "Đang chờ chủ nhà duyệt yêu cầu đổi lịch:" / "Ngày mới đề xuất: … lúc …". BM:427-445. **missing**
36. [A] "Yêu cầu đổi ngày / giờ khác" (hidden while a change is pending, not gated here); enters reschedule mode and clears the slot. BM:449-461. **missing**
37. [A] "Hủy lịch hẹn" opens inline confirm "Bạn có chắc chắn muốn hủy lịch hẹn này?", input "Nhập lý do hủy (tùy chọn)...", "Quay lại", "Xác nhận hủy lịch" / "Đang hủy...". BM:462-517. **missing**
38. [A] Cancel: `cancelByRenter`; "Đã hủy lịch xem nhà thành công"; clear booking, confirm and reschedule mode, reload availability, stay open. Fallback "Không thể hủy lịch. Vui lòng thử lại." BM:273-292. **missing**
39. [A] "Xem tất cả lịch hẹn của bạn": `onClose()` then `onViewMyBookings`. BM:471-484. **missing**
40. [A] Form shows when there is no active booking or when rescheduling. BM:522-524. **partial**
41. [A] Banner "Đang chọn lại thời gian mới để gửi chủ nhà xét duyệt" + "Hủy đổi" (exits, clears slot). BM:530-547. **missing**
42. [A] "1. Chọn ngày xem nhà *" and "Chủ nhà tiếp khách vào: {days | Tất cả các ngày}". BM:550-567. **partial**
43. [A] `AppCalendar` with `isViewingDayDisabled`; picking a day clears the slot. BM:569-593. **partial** (old BookingDatePicker)
44. [A] "Ngày đã chọn:" + long date. BM:595-602. **partial**
45. [A] "2. Chọn khung giờ (1 tiếng / lượt) *" and "Đã chọn: HH:mm – HH:mm". BM:608-618. **partial**
46. [A] Loading "Đang tải khung giờ khả dụng cho ngày dd/MM/yyyy...". BM:621-625. **partial**
47. [A] Closed day "Chủ nhà không tiếp khách vào ngày này. Vui lòng chọn một ngày khác trên lịch."; no slots "Không có khung giờ nào khả dụng cho ngày này." BM:626-633. **partial** (old text differs)
48. [A] Slots by period with the three headings, only non-empty (`groupSlots`). BM:636-673. **partial** (no hours)
49. [A] Slot button: time + `getSlotView` caption; UNAVAILABLE, PENDING_YOU, CONFIRMED_YOU disabled (also when rescheduling); AVAILABLE with bookings shows "{n} lượt đặt xem" and stays pickable. BM:813-860. **partial** (no booking count)
50. [A] "3. Thông tin người đi xem"; name and phone prefilled from the profile. BM:134-140,679-719. **partial** (old order is first then last)
51. [A] "Họ và tên *" placeholder "Nhập họ và tên của bạn..."; "Số điện thoại *" "Số điện thoại nhận xác nhận...". BM:686-718. **partial**
52. [A] "Số người cùng tham quan" / "Bao gồm cả bạn và người thân / bạn bè", stepper 1-10. BM:722-751. **partial**
53. [A] Note label "Ghi chú gửi chủ nhà" / "Lý do xin đổi lịch hẹn", "Tối đa 500 ký tự", separate state; placeholders "Ví dụ: Tôi muốn hỏi thêm về chỗ để ô tô, khoảng cách ra bến xe..." / "Ví dụ: Em có việc đột xuất vào giờ cũ, muốn xin dời sang khung giờ này...". BM:754-779. **partial**
54. [A] Web keeps section 3 (name, phone, visitors) visible while rescheduling, though only date, slot and reason are sent. BM:678-780. **missing** (old form hides it; follow web)
55. [A] Submit "Xác nhận đặt lịch xem nhà" / "Gửi yêu cầu đổi lịch hẹn" / "Đang gửi yêu cầu..."; disabled while submitting, without slot, or without `APPOINTMENT_BOOK` gate. BM:783-803. **partial** (no gate)
56. [A] `validateBookingForm` / `validateRescheduleForm` messages. BM:205-218,248-251. **partial** (single combined message)
57. [A] Create success "Gửi yêu cầu đặt lịch thành công! Vui lòng chờ chủ nhà xác nhận.", `onClose()`, `onViewMyBookings?.()`; fallback "Không thể đặt lịch. Vui lòng thử lại." BM:220-240. **partial**
58. [A] Reschedule success "Đã gửi yêu cầu đổi lịch đến chủ nhà!", same navigation; fallback "Không thể đổi lịch. Vui lòng thử lại." BM:253-269. **partial**
59. [A] Web has one page and no confirm step; the old two steps + BookingConfirmation are not in web. BM:525-805. **partial**
60. [A] The web component stays mounted, so date, slot and mode survive close/reopen. On mobile reset mode, slot and cancel confirm on close, and reset all on a new listingId (deliberate). BM:114-131,294. **missing**

## B. Navigation and page shell

61. [B] Menu "Lịch xem nhà" (landlord), "Lịch đi xem" (tenant). `components/dashboard/dashboard-nav.ts:56-59,89-93`. **has**
62. [B] Titles "Lịch tiếp khách (Chủ nhà)" / "Lịch tôi đi xem (Khách thuê)"; subtitles "Quản lý các yêu cầu đặt lịch xem nhà từ khách thuê gửi đến bài đăng của bạn." / "Theo dõi các lịch hẹn xem nhà bạn đã đăng ký trực tiếp với các chủ nhà." OWN:275-285, MY:182-191. **partial**
63. [B] "Làm mới" (spins and disabled while loading); pull to refresh may be added. OWN:288-296, MY:194-202. **partial** (pull only)
64. [B] Signed-out state "Bạn cần đăng nhập". OWN:254-271, MY:160-177. **has** (n/a)
65. [B] State resets when the account changes. OWN:36-39, MY:35-38. **has** (AuthGate remounts)
66. [B] Tabs "Lịch xem" (default), "Chờ xác nhận", "Đã hoàn thành", "Đã hủy", "Đã từ chối" (`STATUS_TABS`; no EXPIRED, no ALL). OWN:28-34. **missing** (old: Lịch/Danh sách + all/unviewed/completed)
67. [B] Tab change resets page to 1; date filter persists across tabs. OWN:126-134, MY:132-140. **missing**
68. [B] Owner: count pill on every tab from `/owner/counts`; "Lịch xem" has no key so web shows 0. OWN:106-108,301-333. **missing**
69. [B] Owner red dot on "Chờ xác nhận" when PENDING > 0, a11y "{n} lịch đang chờ xác nhận". OWN:317-323. **missing**
70. [B] Renter: red dot only, no numbers; count from the PENDING list total (date filtered on that tab), else a `size 1` request. MY:103-115,222-228. **missing**

## B. Date filter and lists

71. [B] Filter on non-calendar tabs: "Tất cả ngày", "Hôm nay", "Ngày mai", "Chọn ngày khác" (shows the date when custom); active chip filled. DF:57-119. **missing** (old DatePeriodFilter filters loaded rows only)
72. [B] Picker "Chọn ngày xem nhà:" with "Xóa chọn"; choosing closes it; same day again clears; past days allowed. DF:121-151. **missing**
73. [B] Summary chip (`getDateFilterState().summary`) with clear "Xóa bộ lọc ngày". DF:155-172. **missing**
74. [B] Server filter `date`; changing it resets page to 1. OWN:95-100,131-134. **missing**
75. [B] List request: tab status, date, page, size 10. OWN:95-103, MY:94-102. **partial** (size 12, no status/date)
76. [B] Calendar tab uses `loadCalendarAppointments`, no date filter, no pagination. OWN:78-93. **partial** (old loader uses `hasMore`)
77. [B] Load error "Không thể tải danh sách lịch tiếp khách." / "Không thể tải danh sách lịch đi xem."; ignore stale responses. OWN:109-111, MY:116-118. **partial** (generic message)
78. [B] Loading "Đang tải calendar lịch tiếp khách..." / "Đang tải danh sách lịch tiếp khách..." / "Đang tải calendar lịch đi xem của bạn..." / "Đang tải danh sách lịch đi xem của bạn...". OWN:352-368, MY:248-263. **partial**
79. [B] Owner empty "Không có lịch hẹn nào"; "Không tìm thấy lịch hẹn nào trong ngày đã chọn. Thử chọn ngày khác hoặc xem tất cả." / "Hiện chưa có khách hàng nào đặt lịch xem các bất động sản của bạn."; "Xem tất cả ngày" with a date. OWN:369-387. **partial**
80. [B] Renter empty "Bạn chưa có lịch hẹn xem nhà nào"; "Không có lịch hẹn nào vào ngày đã chọn. Thử đổi ngày khác hoặc bấm xem tất cả." / "Khám phá các căn hộ đang cho thuê trên HomeSpace và đặt lịch xem nhà ngay."; "Xem tất cả ngày" with a date; "Khám phá nhà thuê" always (search tab). MY:264-290. **partial**
81. [B] Pagination only when totalPages > 1: "Tổng cộng: N lịch hẹn", "Trước", "x / y", "Sau", disabled at the ends. OWN:405-432, MY:305-332. **partial** (old "Tải thêm")

## B. List card

82. [B] Tap anywhere or "Chi tiết" opens the detail. CARD:120-123,251-258. **partial**
83. [B] Thumbnail or building icon, title, address, "{VND} / tháng". CARD:125-157. **partial** (no image/price)
84. [B] Long date, "HH:mm – HH:mm", slot-type badge. CARD:161-176. **partial**
85. [B] Owner view: renter name "(n người)", phone. CARD:180-193. **partial**
86. [B] Renter view: "Lời dặn: “note”" or "Không có lời dặn"; "Đi cùng: n người" (n>1) / "Đi xem một mình". CARD:195-207. **missing**
87. [B] Change banner "Khách xin đổi sang: date (start – end)" (same text in both roles). CARD:211-220. **partial**
88. [B] Status badge with icon and tone. CARD:229-234. **partial** (labels/tones differ: "Chờ duyệt", CONFIRMED primary)
89. [B] Owner PENDING: "Duyệt" opens the approve dialog; disabled by `APPOINTMENT_MANAGE`, hint = gate title or "Chấp nhận lịch hẹn". Web passes quick reject/complete but renders neither. CARD:238-249, OWN:395-398. **missing**

## B. Month/week calendar

90. [B] Previous / "Hôm nay" / next with a11y "Tháng trước|Tuần trước", "Tháng sau|Tuần sau"; title via `getCalendarTitle`. CAL:68-110. **partial** (title format differs)
91. [B] "Tháng" / "Tuần" toggle, month default. CAL:43,113-128. **has**
92. [B] 7 columns "Thứ 2…Chủ nhật" (web min width 840px, horizontal scroll). The old compact grid + selected-day list is the mobile adaptation; the coordinator must accept it or require the web grid. CAL:132-148. **partial**
93. [B] Day cell: today highlight and "Hôm nay" tag, outside-month dimming, "{n} lịch". CAL:150-194. **partial** (no tag or "lịch" text)
94. [B] Month event: start time, title, check "Đã xem xong" when completed; completed green, confirmed blue. CAL:197-247. **partial** (dot + count)
95. [B] Week event: time range, "Done" mark, title, address, owner "name · n người". CAL:248-291. **partial**
96. [B] Tap event opens detail. CAL:204. **has**
97. [B] Empty "Chưa có lịch xem nhà trong calendar" / "Lịch đã xác nhận và đã xem xong sẽ xuất hiện tại đây." CAL:303-311. **partial**
98. [B] Web remounts the calendar after each reload (view/anchor reset). Keeping the lifted state is better (deliberate). OWN:351-363. **has**

## B. Detail modal

99. [B] Header status badge, "Mã: {first 8 of id}", close. DM:150-170. **partial**
100. [B] Listing card + "Xem tin đăng" (`onOpenListing(listingId)`). DM:175-218. **missing**
101. [B] Change box "Yêu cầu dời lịch hẹn đang chờ duyệt", "Ngày mới đề xuất:", "Khung giờ mới:", "Lý do xin đổi:". DM:221-251. **partial**
102. [B] "Thời gian hẹn xem nhà": "Ngày xem", "Khung giờ" + slot badge. DM:289-320. **partial**
103. [B] "Khách hàng liên hệ" / "Thông tin của bạn": name, tap-to-call phone, email if any, "Số người đi cùng: n người". DM:323-358. **partial** (no call/email/count)
104. [B] "Ghi chú từ người đặt:" and "Lời dặn từ chủ nhà:" shown separately when present. DM:362-385. **partial**
105. [B] "Lý do từ chối:" and "Lý do hủy (Khách hàng hủy|Chủ nhà hủy|Hệ thống tự động hủy):". DM:388-404. **partial** (no cancelled-by)
106. [B] Footer "Đóng" + buttons from `getAppointmentActions` (banner ones inside the change box). Each closes the detail, then runs. DM:253-282,408-517. **partial** (old: owner can cancel PENDING; confirm dialogs and one shared reason field)
107. [B] Owner buttons disabled by `APPOINTMENT_MANAGE`; renter reschedule by `APPOINTMENT_BOOK`; renter cancel never. DM:136-137,262,429-471,494,505. **missing**

## B. Actions

108. [B] Dialog for approve/reject/cancel/reject-reschedule (`OWNER_ACTION_DIALOGS`): 3-line input, "Quay lại", "Xác nhận" / "Đang xử lý...", both disabled while running; approve primary, others destructive. Input resets on open. OWN:137-148,449-519. **missing**
109. [B] Missing required reason shows `validateOwnerDialog`. OWN:170,191,236. **partial**
110. [B] Approve (note trimmed or omitted): "Đã chấp nhận lịch xem nhà!"; fallback "Không thể chấp nhận lịch hẹn." OWN:151-165. **partial** (note never sent)
111. [B] Reject: "Đã từ chối lịch xem nhà." / "Không thể từ chối lịch hẹn." OWN:168-186. **partial**
112. [B] Owner cancel: "Đã hủy lịch hẹn xem nhà." / "Không thể hủy lịch hẹn." OWN:189-207. **partial**
113. [B] Complete, no dialog: "Đã đánh dấu hoàn thành buổi xem nhà!" / "Không thể đánh dấu hoàn thành." OWN:210-219. **partial**
114. [B] Approve change, no dialog: "Đã chấp nhận thời gian hẹn mới của khách!" / "Không thể chấp nhận đổi lịch." OWN:222-231. **partial**
115. [B] Reject change: "Đã từ chối yêu cầu đổi lịch của khách." / "Không thể từ chối đổi lịch." OWN:234-252. **partial**
116. [B] After success refresh list and counts; replace an open detail with the response. Guard double taps on the two no-dialog actions. OWN:156-159. **partial**
117. [B] Renter cancel dialog "Hủy lịch xem nhà", "Bạn có chắc chắn muốn hủy lịch hẹn xem nhà cho bài đăng {title}?", placeholder "Nhập lý do hủy lịch (ví dụ: bận đột xuất, đã tìm được nhà khác...)", "Quay lại", "Xác nhận hủy lịch" / "Đang hủy..."; reason optional. MY:342-344,369-409. **partial** (old requires a reason)
118. [B] Renter cancel: "Đã hủy lịch xem nhà thành công." / "Không thể hủy lịch hẹn." MY:143-158. **partial**
119. [B] "Yêu cầu đổi lịch": close detail, clear deep link, open `BookingAppointmentModal` with the appointment's listing fields (`listingPrice ?? undefined`) and no `onViewMyBookings`; refetch on close. The modal first shows the current booking (row 36). MY:345-367. **partial** (old BookingForm)

## B. Deep link, realtime, notifications

120. [B] Notification path `/dashboard/viewing-schedules[/my-bookings]?appointmentId=…` opens that side **and the appointment**. DL:47-59. **partial** (`notificationTarget` drops the id)
121. [B] Fetch by id; if the user is not on that side: "Lịch hẹn không thuộc phía tài khoản bạn đang xem." DL:53-58. **missing**
122. [B] Switch to `tabForStatus` (CONFIRMED to calendar; EXPIRED keeps the tab) and page 1. DL:59, OWN:59-62. **missing**
123. [B] 403/404 "Lịch hẹn không còn tồn tại hoặc bạn không có quyền xem."; other "Không thể mở lịch hẹn lúc này. Vui lòng thử lại." A new link closes the old detail; ignore stale replies; closing consumes the link. DL:39-71. **missing**
124. [B] Live refresh: `subscribeNotificationEvents`: `notification:new` with category APPOINTMENT, plus `connect` and `notifications:changed` (reconnect, foreground, push). NH:41-47, NT:64-73,143-146,203-208. **missing**
125. [B] Debounce 250 ms, one refresh at a time with one trailing run; refetch the open detail, close it if that fails. NH:16-53. **missing**
126. [B] Category tab "Lịch hẹn", `BOOKING_*` tags, "Vai trò chủ nhà|người thuê", settings copy. NS:90-97,148,166-177,391-396. **has**
127. [B] Push taps open the notification center (mobile push has no resource id), then row 120. `lib/push/pure.ts`. **has**
128. [B] Keep the mobile-only attention dots (`getManagementAttentionCounts`, mark seen on open) working with the new screens. No web equivalent. **has**

## Out of scope for A and B (not ported, report if wanted)

AI chat appointment cards (`lib/ai-appointment-cards.ts`; mobile missing), chat quick reply "Hẹn lịch
xem nhà" (`ChatWindow.tsx:573`), listing editor/preview viewing schedule.

## Web and backend disagreements (`hs-core-api`, read-only)

- W1. Renter cancel has no `@Valid`: the 500 limit on `cancelReason` is not enforced; a whitespace reason (BM:278 does not trim) is stored empty.
- W2. Backend lets the owner cancel PENDING or CONFIRMED; web offers CONFIRMED only. Neither cancel endpoint requires a complete profile, yet web disables owner cancel on an incomplete profile.
- W3. Reschedule needs a PUBLISHED listing, approve needs the listing operationally PUBLISHED; web still offers both. The server errors are English and shown as-is.
- W4. Empty `allowedViewingDays`: web enables every day ("Tất cả các ngày"); backend then reports every day unavailable and rejects bookings.
- W5. Web slot type has `LOCKED`; backend never sends it (and web would treat it as pickable). Slots are not locked on approval despite the SVC comment: several renters can hold one slot.
- W6. Web has no name/phone length limit; backend max 100/20. No phone format check on either side.
- W7. Evening is 17:00-21:00 in the backend and BM:667, but "18:00" in RD:74-78 and `ListingPreviewModal.tsx:135` (mobile `lib/rent-detail.ts` copies it and `test:rent-detail` pins it).
- W8. Availability of a non-PUBLISHED listing is 404 for non-owners; the modal shows it as a closed day.
- W9. The 1-hour same-day rule uses Vietnam time; the web "past day" rule uses device time.
- W10. Rejecting a change overwrites `ownerNote` with "Yêu cầu đổi lịch bị từ chối: …", losing the earlier note.
- W11. Counts include EXPIRED, which has no tab; there is no CALENDAR count (row 68).
- W12. POST requires KYC; reschedule does not. Web matches (KYC only before opening from listing detail).
- Contract confirmed as matching: the 16 routes and bodies, `size` 1-50, visitors 1-10, notes 500, `PageResponse` fields, sort date and start desc, notification `actionPath` (no `status` hint).
