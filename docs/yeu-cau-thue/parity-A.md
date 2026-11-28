# Parity A — Yêu cầu thuê (rental requests)

Pha 0 kiểm kê, phần A. Nguồn: web `hs-web-app` (chuẩn), backend `hs-core-api`. Chỉ đọc, ngày 25/11/2026.

Ký hiệu file (rút gọn):
- Web `components/rental-request/`: **M**=RentalRequestsManagement.tsx · **CD**=RentalRequestCard.tsx · **DL**=RentalRequestDialogs.tsx · **FL**=RentalRequestFilters.tsx · **LS**=useRentalRequestList.ts · **SY**=useRentalRequestSync.ts · **DP**=useRentalRequestDeepLink.ts · **HM**=useRentalHoldMinutes.ts · **DM**=RentalRequestDetailModal.tsx · **AI**=RentalRequestAiReviewModal.tsx · **RM**=RentalRequestModal.tsx · **CS**=RentalCostSummary.tsx · **MS**=ModalShell.tsx · **HP**=rental-request.helper.ts · **SN**=rental-request-snapshot.helper.ts · **UC**=useRequestContracts.ts · **FB**=RentalContractFallbackButton.tsx · **EC**=EndOfPeriodCharges.tsx
- Web khác: **RV**=`components/rent/RentDetailView.tsx` · **PR**=`lib/rental-request-presentation.ts` · **LB**=`lib/rental-labels.ts` · **AC**=`lib/rental-request-actions.ts` · **OL**=`lib/rental-occupant-limit.ts` · **CF**=`lib/rental-contract-fallback.ts` · **CP**=`lib/contract-preview.ts` · **PG**=`lib/profile-gate.ts` · **PM**=`lib/permissions.ts` · **KY**=`lib/kyc-gate.ts` · **UP**=`hooks/usePermission.ts` · **ND**=`components/common/ActionDialog.tsx` · **PD**=`components/common/PolicyDialog.tsx` · **NA**=`components/rental/NextActionCard.tsx` · **DT**=`components/rental/DetailTabs.tsx` · **TY**=`types/rental-request.type.ts` · **S1**=`services/rental-request.service.ts` · **S2**=`services/rental-request-review.service.ts`
- Backend (`hs-core-api/`): **RRC**=`hs-api-service/src/main/java/com/hs/api/controller/listing/RentalRequestController.java` · **RRS**=`hs-listing-service/src/main/java/com/hs/listing/service/RentalRequestService.java` · **RCC**=`hs-listing-service/.../service/RentalCostCalculator.java` · **ROS**=`hs-contract-service/src/main/java/com/hs/contract/service/RentalOnboardingService.java` · **LEC**=`hs-listing-service/.../advice/ListingErrorCode.java` · **AIR**=`hs-ai-service/src/homespace_ai/api/v1/rental_request_review.py` · **NEV**=`hs-notification-service/src/modules/notification-events/notification-event.ts`

---

## 1. Màn hình và điểm vào

| ID | Route web | Vai trò | Cách vào | Ghi chú |
|---|---|---|---|---|
| S-1 | `/dashboard/rental-requests` (`app/dashboard/rental-requests/page.tsx:8`) → `<RentalRequestsManagement mode="RECEIVED"/>` | LANDLORD (chủ nhà) | Menu "Yêu cầu thuê" (`components/dashboard/dashboard-nav.ts:62`), breadcrumb "Yêu cầu thuê" (`dashboard-breadcrumb.ts:24`) | title "Yêu cầu thuê từ khách \| HomeSpace" |
| S-2 | `/dashboard/rental-requests/my-requests` (`.../my-requests/page.tsx:8`) → `mode="SENT"` | TENANT (người thuê) | Menu "Yêu cầu đã gửi" (`dashboard-nav.ts:95`), breadcrumb "Yêu cầu đã gửi"; nút "Xem yêu cầu của tôi" ở chi tiết nhà (RV:443,453,466,476); link ContractListView:211 | title "Yêu cầu thuê tôi đã gửi \| HomeSpace" |
| S-3 | Chi tiết nhà `/rent/[slug]` → `RentalRequestModal` (RV:965) | TENANT (khách xem) | Nút "Yêu cầu thuê nhà" (RV:499-523) | form gửi yêu cầu |
| S-4 | Modal chi tiết yêu cầu (`DM`) trong S-1/S-2 | cả hai | Nút "Xem chi tiết"/"Mở hồ sơ" trên thẻ, hoặc deep link `?requestId=` | tab Tổng quan + (B) các tab xử lý |
| S-5 | Modal AI đánh giá (`AI`) | LANDLORD | Nút "Hỏi AI đánh giá (N yêu cầu)" trên thẻ PENDING có xung đột | |
| S-6 | Dialog Chấp thuận/Từ chối/Hủy (`DL`) | LANDLORD (accept/reject), cả hai (cancel) | Nút trên thẻ / modal chi tiết / AI | |

Deep link và thông báo:
- `?requestId=<uuid>` trên cả S-1 và S-2 (DP:9-103). Không phải UUID → toast; chưa đăng nhập → `login(redirectPath)` một lần; sai phía (owner/renter) → toast; 403/404 → toast; mọi lỗi đều xoá param.
- actionPath thông báo `RENTAL_REQUEST` (26 loại sự kiện, NEV:30-55): `recipientSide=OWNER` → `/dashboard/rental-requests?requestId=<id>`, `RENTER` → `/dashboard/rental-requests/my-requests?requestId=<id>` (NEV:913-915; test `rental-request-notification.spec.ts:38`). Trang thanh toán web (`app/dashboard/payments/page.tsx:113`) cũng sinh link cùng dạng (ngoài phạm vi).
- Realtime: socket `notification:new` với `category==="RENTAL_REQUEST"` → `notifyRentalRequestChanged(metadata.requestId ?? metadata.rentalRequestId)` (`components/notification/NotificationTransport.tsx:117-120`); khi socket connect / focus / push → `recoverChanges()` phát `rental-request-changed` không kèm id (NotificationTransport.tsx:64-73,95-97). `SY` lắng nghe sự kiện này.
- `dashboard-role.ts:41-60`: path `/dashboard/rental-requests/my-requests` suy ra role tenant; `/dashboard/rental-requests` suy ra landlord.
- Mobile hiện đã ánh xạ actionPath → section `landlord-requests` / `tenant-requests` (`src/lib/notification.ts:381`) nhưng **bỏ `requestId`**.

→ Bàn giao B: `RentalPaymentModal`, `RentalDepositQuickViewModal` (+`RentalReceiptNotice`), `RentalStartChangeQuickModal` (+`StartChangeNotice`), `RentalOnboardingPanel`.
→ Bàn giao C: `AgreementDocumentActions`, điều hướng `contractDetailPath(role, id)`.

---

## 2. Checklist hành vi

### 2.1 Trang danh sách (M) — chung hai phía

A-001 | Mỗi phía + tài khoản là một instance riêng: `key={mode:userId}`; đổi tài khoản xoá toàn bộ list/contract/modal | M:41 | —
A-002 | Tiêu đề: RECEIVED "Yêu cầu thuê từ khách", SENT "Yêu cầu thuê tôi đã gửi"; icon Inbox/Send | M:181-186 | —
A-003 | Mô tả RECEIVED: "Xét duyệt hồ sơ, theo dõi cọc, tiền tháng đầu và ký hợp đồng khi nhận nhà." — SENT: "Theo dõi yêu cầu thuê, thanh toán cọc và các bước nhận nhà theo ngày đã thống nhất." | M:187-191 | —
A-004 | Nút "Làm mới" (icon quay khi loading), disabled khi `loading`; gọi tải foreground lại | M:193-199 | list
A-005 | Bộ lọc trạng thái (chips cuộn ngang, `aria-pressed`): "Tất cả"(ALL) · "Chờ duyệt"(PENDING) · "Đang xử lý thuê"(ACCEPTED) · "Đã thuê"(COMPLETED) · "Bị từ chối"(REJECTED) · "Hết hạn"(EXPIRED) · "Đã hủy"(CANCELLED). Mặc định ALL. Không có số đếm trên chip | FL:5-30 | —
A-006 | Đổi bộ lọc → `page=1` | LS:80 | —
A-007 | Phân trang theo trang, `PAGE_SIZE = 8`, sắp xếp mới nhất trước (server `createdAt desc`) | LS:10, RRS:519 | `GET my-requests|owner?status&page&size=8`
A-008 | Lọc một trạng thái → server lọc đúng 1 `status`; ALL → không gửi `status` | LS:18-22, S1:49,108 | như trên
A-009 | Lọc "Đã hủy" = gộp 3 trạng thái CANCELLED_BY_RENTER/OWNER/SYSTEM: gọi 3 request song song, mỗi request `page=1,size=page*8`, gộp, sort `createdAt` giảm dần (so sánh chuỗi), cắt `[(p-1)*8, p*8)`, `total` = tổng 3 `totalElements`, `totalPages=max(1,ceil(total/8))` | LS:23-26 | 3× list
A-010 | `totalElements`/`totalPages` mặc định 0/1 nếu thiếu | LS:21 | —
A-011 | Loading: 3 skeleton thẻ (`role=status`, "Đang tải danh sách") | M:204-207 | —
A-012 | Lỗi tải foreground: toast "Không thể tải danh sách yêu cầu thuê nhà." (chỉ khi không phải silent và là lượt mới nhất); danh sách giữ nguyên | LS:60-62 | —
A-013 | Tải theo "vé": mỗi lần tải tăng `seq`; kết quả chỉ áp dụng nếu `seq >= foregroundSeq` và `seq > appliedSeq`; spinner thuộc lượt foreground mới nhất | LS:43-65 | —
A-014 | Silent refresh: không skeleton, không toast; nếu JSON không đổi thì giữ nguyên mảng (tránh fetch phụ thuộc) | LS:57,69 | —
A-015 | Chưa `initialized` → không làm gì; `initialized && !authenticated` → `loading=false`, không gọi API | LS:44,71-78 | —
A-016 | Empty (ALL): tiêu đề "Chưa có yêu cầu nào"; RECEIVED: "Hiện chưa có khách thuê nào gửi yêu cầu thuê nhà đến các bài đăng của bạn."; SENT: "Bạn chưa gửi yêu cầu thuê nhà nào. Hãy khám phá các căn hộ đang cho thuê ngay!" + nút "Tìm nhà cho thuê" (→ `/rent`) chỉ ở SENT | M:208-226 | —
A-017 | Empty (đang lọc): "Không có yêu cầu nào ở mục này" + "Thử chọn mục khác hoặc xem tất cả yêu cầu." + nút "Xem tất cả" (→ ALL) | M:211-220 | —
A-018 | Phân trang chỉ hiện khi `totalPages > 1`: "Tổng cộng {totalElements} yêu cầu", nút "Trang trước" (disabled `page<=1`), "Trang {page} / {totalPages}", "Trang sau" (disabled `page>=totalPages`) | M:241-252 | —
A-019 | Lỗi tải toàn trang chỉ có toast; **không có màn lỗi + nút thử lại** (nút "Làm mới" là đường thử lại) | LS:60 | —
A-020 | Thời gian tương đối thẻ: "Gửi {formatDistanceToNow(createdAt, vi, addSuffix)}" (vd "Gửi 3 giờ trước") | CD:81 | —

### 2.2 Dữ liệu phụ của danh sách

A-021 | Với mỗi yêu cầu có status ∈ {ACCEPTED, COMPLETED, CANCELLED_BY_SYSTEM, CANCELLED_BY_RENTER, CANCELLED_BY_OWNER, EXPIRED}: tra hợp đồng 1 lần theo tập id (key = các id nối chuỗi) | UC:9,39-47 | `GET /api/v1/contracts/by-rental-request/{id}?includeDepositFallback=true` (N+1)
A-022 | Kết quả tra: `agreementsByRequest[id]` = hợp đồng/thoả thuận trả về; `contractsByRequest[id]` = cùng object nhưng **null nếu `agreementKind==="DEPOSIT"`** (HĐ cọc ACTIVE không phải HĐ thuê). Lỗi một id → bỏ qua id đó (giữ giá trị cũ) | UC:19-36 | như trên
A-023 | Poll 30 s các yêu cầu chưa đóng (không thuộc REJECTED/EXPIRED/CANCELLED_*/COMPLETED) chỉ khi `document.visibilityState==="visible"` | UC:40,49-56, PR:123 | như trên
A-024 | `rememberContract(requestId, contract)` lưu HĐ vừa tạo nháp vào `contractsByRequest` | UC:58-60 | —
A-025 | Giờ giữ chỗ: `holdMinutes` từ policy; `holdLabel = "{n} phút"` hoặc null (khi lỗi/0 → UI không hiện số) | HM:7-18, M:54-55 | `GET /api/v1/rental-requests/policy` → `result.holdMinutes`
A-026 | Chỉ RECEIVED: tải xung đột chủ nhà mỗi khi `requests` đổi → map theo `listingId` | M:125-149 | `GET /api/v1/rental-requests/owner/conflicts`
A-027 | Fallback khi API xung đột lỗi: tự nhóm các yêu cầu PENDING cùng `listingId` trong trang hiện tại, nhóm ≥2 → conflict `{listingId,listingTitle,listingAddress,pendingCount,requestIds}` | M:133-145 | —
A-028 | Poll nền 30 s (`pollMs=30000`) khi trong trang còn yêu cầu PENDING hoặc ACCEPTED, ngược lại không poll; chỉ chạy khi `authenticated && userId` | M:162-163 | list (silent)
A-029 | Đồng bộ thông báo: sự kiện `rental-request-changed` → refresh silent, debounce 250 ms, 1 lần chạy cùng lúc, tối đa 1 lượt xếp hàng; tab ẩn → đánh dấu dirty, hiện lại thì refresh; kiểm tra visibility lúc lên lịch và ngay trước khi gọi | SY:6-91 | list (silent)
A-030 | `requestId` của SY: bỏ qua sự kiện có `event.requestId` khác `requestId` đang xem; sự kiện không id luôn khớp | SY:71 | —
A-031 | `useNowMs` cập nhật mỗi 30 s để tính `transferWindowClosed` (gợi ý UX, server quyết định hạn) | CD:53, DM:92 | —

### 2.3 Thẻ yêu cầu (CD)

A-032 | Ảnh 64×64 (link tới bài đăng, title "Xem bài đăng"); ảnh hợp lệ nếu URL bắt đầu `http(s)://` hoặc `/`, ngược lại icon nhà | CD:40,65-69 | —
A-033 | Tiêu đề (2 dòng, link bài đăng), địa chỉ (1 dòng, chỉ khi có), giá `formatVND(listingPrice)` + "/tháng" (chỉ khi `listingPrice` truthy) | CD:70-74 | —
A-034 | `aria-label="Yêu cầu thuê {listingTitle}"` | CD:63 | —
A-035 | Badge trạng thái: `presentRentalRequest(...).label` + tone màu (xem mục 4) và gợi ý `p.hint` dưới badge | CD:77-83 | —
A-036 | 4 ô sự thật: "Dọn vào" (`dd/MM/yyyy` hoặc "—"), "Thời hạn" (`{leaseMonths} tháng`), "Số người ở" (`{occupantCount \|\| 1} người`), "Tiền cọc" (`formatVND` nếu `depositAmount != null`, ngược lại "Theo tin đăng") | CD:85-90 | —
A-037 | RECEIVED: tên khách, SĐT (link `tel:`), email (nếu có, cắt bớt), lời nhắn `renterNote` in nghiêng trong ngoặc kép, 2 dòng | CD:92-101 | —
A-038 | SENT: không hiện khối liên hệ | CD:92 | —
A-039 | `rejectReason` (mọi trạng thái, nếu có): hộp đỏ "Lý do từ chối: {rejectReason}" | CD:102 | —
A-040 | PENDING + `respondBy`: "Hạn chủ nhà phản hồi: {toLocaleString("vi-VN", tz Asia/Ho_Chi_Minh)} (giờ Việt Nam)" | CD:103 | —
A-041 | Khối hợp đồng khi có `agreement`: tiêu đề "Hợp đồng đặt cọc giữ phòng" (agreementKind DEPOSIT) hoặc "Hợp đồng thuê"; dòng phụ `contractNumber` + " · Đã ký đủ hai bên" nếu DEPOSIT và status ACTIVE; kèm `AgreementDocumentActions` (→ bàn giao C: props `contract=agreement`, `perspective="landlord"\|"tenant"`, `key=agreement.id`) | CD:105-113 | —
A-042 | `StartChangeNotice` (→ bàn giao B: props `request`, `mode`, `onOpen=()=>openStartChange(req)`) luôn render (tự quyết hiển thị) | CD:114 | —
A-043 | Khi nút chính là `review`: `RentalReceiptNotice` (→ bàn giao B: props `request`, `onOpen=()=>review(req)`) | CD:115 | —
A-044 | **Nút chính duy nhất** theo `primaryCardAction(role, p, {canCreateContract})` (mục 4): `respond` / `review` / `pay` / `createContract` / `open` | CD:55-57 | —
A-045 | `respond` (LANDLORD, phase pending): nút "Chấp thuận · giữ chỗ {holdLabel}" (hoặc "Chấp thuận & giữ chỗ" khi chưa biết giờ) + nút "Từ chối"; cả hai disabled khi `busy \|\| !canManage` (tooltip `manageTitle`) | CD:120-125 | —
A-046 | `pay` (TENANT, phase unpaid hoặc rejected-chưa-lapsed): nút "Thanh toán", đổi thành "Gửi lại chứng từ" khi `p.phase==="rejected"`; disabled khi `busy`; mở `RentalPaymentModal` (→ bàn giao B) | CD:126-128, M:272-279 | —
A-047 | `createContract` (LANDLORD, phase paid + `canOfferContractFallback`): `RentalContractFallbackButton` — nhãn "Tạo hợp đồng" / "Đang tạo hợp đồng…" (spinner, `aria-busy`), tooltip "Thử tạo bản nháp theo luồng hiện tại. Nếu chưa có mẫu đã phát hành, cần quản trị viên bổ sung mẫu."; disabled khi `busy \|\| !canManageContract` (`CONTRACT_MANAGE` gate và không có lượt tạo khác) | CD:129, FB:20-26, M:236 | `POST /api/v1/contracts` (+ chuỗi, xem A-066)
A-048 | `open`: nếu `kind==="open"` && có `contract` && status ACCEPTED/COMPLETED → nút "Xem hợp đồng hiệu lực" (contract ACTIVE) hoặc "Mở hợp đồng" → điều hướng chi tiết hợp đồng (landlord/tenant) ; ngược lại nút "Mở hồ sơ" → mở modal chi tiết | CD:59,130-132 | —
A-049 | Nút phụ "Xem chi tiết" hiện trừ khi (`kind==="open"` và không mở hợp đồng) | CD:60,133 | —
A-050 | Hàng link: "Xem bài đăng" (luôn) | CD:136 | —
A-051 | "Hỏi AI đánh giá ({pendingCount} yêu cầu)" (icon Sparkles, tooltip "Phòng này có {pendingCount} yêu cầu đang chờ duyệt") — chỉ RECEIVED + status PENDING + có `conflict` của listing | CD:137-141 | —
A-052 | "Đề nghị bắt đầu thuê sớm" — chỉ SENT + ACCEPTED + `!cancellationRefundPending` + `!latestStartChange` + `initialPayment.status==="CONFIRMED"`; mở `RentalStartChangeQuickModal` (→ bàn giao B: `request`, `mode`) | CD:142-144, M:259-260 | —
A-053 | "Hủy yêu cầu" (đỏ, disabled khi `busy`) khi `canCancelRentalRequest(req, contract, undefined, role)` (mục 4) | CD:57,145 | —
A-054 | Khi status ACCEPTED: `PolicyNotice` tone neutral, tiêu đề "Hợp đồng cọc & hợp đồng thuê": nếu `depositAmount===0` "Không yêu cầu đặt cọc: bỏ qua hợp đồng cọc. Hợp đồng thuê được chuẩn bị khi đến ngày bắt đầu thuê và xác nhận đủ tiền thuê tháng đầu." ngược lại "Hợp đồng cọc có thể xem và ký ngay sau khi xác nhận nhận tiền. Khi hợp đồng thuê được tạo, nút xem sẽ ưu tiên hợp đồng thuê; HĐ cọc vẫn được lưu riêng trong hồ sơ." | CD:149-154 | —
A-055 | `busy` = `decisions.processing`; `canManage` = gate `RENTAL_REQUEST_MANAGE` (quyền + hồ sơ đầy đủ) | M:49,234-236 | —
A-056 | Nhãn trạng thái (mục 4) trong thẻ: PENDING LANDLORD "Chờ bạn duyệt", TENANT "Chờ chủ nhà duyệt" | PR:61-66 | —

### 2.4 Chấp thuận / Từ chối / Hủy (DL)

A-057 | Khoá thao tác: một thao tác tại một thời điểm (`lock`), `processing` khoá các nút | DL:51-59 | —
A-058 | Chấp thuận → hộp xác nhận: tiêu đề "Duyệt yêu cầu & giữ chỗ {holdLabel}" (hoặc "Duyệt yêu cầu & giữ chỗ"), nút "Xác nhận chấp thuận" (nút huỷ mặc định "Quay lại") | DL:62-66 | —
A-059 | Nội dung `AcceptSummary`: "Bạn đang chấp thuận yêu cầu thuê của **{renterName}** và giữ chỗ {holdLabel}." (hoặc "và giữ chỗ cho khách."); bảng: "Ngày vào ở", "Thời hạn" (`{leaseMonths} tháng · {occupantCount\|\|1} người`), "Xe" (`{n} xe máy`/"Không xe máy" · `{n} ô tô`/"Không ô tô"), "Tiền thuê kỳ đầu" (`effectiveMonthlyRent ?? monthlyRentPrice`), "Tiền đặt cọc" (hoặc "Theo tin đăng"), **"Tổng ban đầu"** = rent + (deposit ?? 0) | DL:19-32 | —
A-060 | `PolicyNotice` warning "Quy tắc khi chấp thuận" (summary "Phòng chuyển sang Đang giữ chỗ; các yêu cầu chờ duyệt khác của tin này bị từ chối.") với 4 gạch đầu dòng: (1) "Bài đăng chuyển sang **Đang giữ chỗ**. Người thuê cần báo chuyển trước hạn trên yêu cầu thanh toán." (2) "Các yêu cầu còn chờ duyệt của cùng tin đăng sẽ tự động bị từ chối với lý do chủ nhà đã chọn yêu cầu khác." (3) `depositAmount===0` ? "Không yêu cầu đặt cọc: bỏ qua hợp đồng cọc. Tiền thuê tháng đầu và ký hợp đồng thuê mở vào ngày bắt đầu thuê." : "Nếu ngày vào ở còn ở phía trước, chỉ thu cọc trước và ký riêng hợp đồng cọc sau khi xác nhận nhận tiền. Tiền tháng đầu và ký hợp đồng thuê mở vào ngày bắt đầu thuê." (4) "Chưa báo chuyển khi hết hạn thì giải phóng giữ chỗ nếu tin còn hạn đăng. Đã báo chuyển, có tranh chấp hoặc đã nhận cọc thì không tự giải phóng phòng. Các yêu cầu đã bị từ chối không tự khôi phục khi hết hạn giữ chỗ." | DL:33-40 | —
A-061 | Xác nhận → `PUT accept`; thành công: toast "Đã chấp thuận và giữ chỗ. Các yêu cầu còn chờ duyệt của tin đăng này đã được từ chối kèm lý do." rồi tải lại danh sách (foreground) | DL:68-70 | `PUT /api/v1/rental-requests/{id}/accept`
A-062 | Lỗi accept thiếu tài khoản nhận tiền (`code===7009` hoặc message chứa "defaultIncoming" / "tài khoản nhận tiền" / "ngân hàng"): toast "Bạn cần thiết lập tài khoản nhận tiền mặc định trước khi chấp nhận yêu cầu thuê." + nút "Cài đặt tài khoản" (→ `/settings/bank-accounts`), 7 s | DL:72-77 | —
A-063 | Lỗi accept khác: toast `getApiErrorMessage(err,"Duyệt yêu cầu thất bại.")` | DL:78 | —
A-064 | Từ chối → hộp nhập lý do: tiêu đề "Từ chối yêu cầu thuê", nhãn "Lý do từ chối (tuỳ chọn)", placeholder "VD: Căn hộ hiện đã có khách đặt cọc trước hoặc không đáp ứng thời gian dọn vào...", mô tả "Từ chối yêu cầu của **{renterName}** cho căn {listingTitle}.", nút "Xác nhận từ chối" (đỏ), `minLength=0` (cho phép rỗng), tối đa 500 ký tự mặc định; đóng hộp = huỷ (null) | DL:84-89, ND:17,65-66 | —
A-065 | Từ chối: `PUT reject` body `{rejectReason: <chuỗi, có thể "">}`; toast "Đã từ chối yêu cầu thuê."; lỗi: `getApiErrorMessage(err,"Từ chối yêu cầu thất bại.")`; rồi tải lại | DL:91-94 | `PUT /api/v1/rental-requests/{id}/reject`
A-065b | Hộp lý do: bộ đếm "Đã đủ nội dung"/"Cần nhập thêm {n} ký tự", `{len}/{max}`; Esc/backdrop = huỷ | ND:132-135 | —
A-066 | Hủy → hộp xác nhận tone danger, tiêu đề "Hủy yêu cầu thuê nhà?", nút "Xác nhận hủy", huỷ "Giữ yêu cầu"; mô tả ACCEPTED: "Hủy ngay lượt giữ chỗ chưa chuyển tiền cho căn **{listingTitle}**, không cần chờ hết hạn. Tin đăng và chỗ xe sẽ được trả lại nếu đủ điều kiện. Nếu người thuê đã chuyển hoặc chủ nhà đã nhận tiền, không hủy ở đây; hãy báo chuyển hoặc yêu cầu đối soát."; trạng thái khác: "Bạn có chắc chắn muốn hủy yêu cầu thuê cho căn **{listingTitle}**?" | DL:98-103 | —
A-067 | Hủy → `PUT cancel`; thành công: toast SENT "Đã hủy yêu cầu thuê của bạn." / RECEIVED "Đã hủy yêu cầu thuê.", gọi `afterCancel` (đóng modal thanh toán + đóng chi tiết) rồi tải lại; lỗi: toast `getApiErrorMessage(err,"Hủy yêu cầu thất bại.")` **và vẫn tải lại** | DL:106-113, M:88-90 | `PUT /api/v1/rental-requests/{id}/cancel`
A-068 | Chấp thuận/Từ chối/Hủy từ modal chi tiết: đóng chi tiết trước rồi mới chạy dialog | M:293-295 | —

### 2.5 Tạo hợp đồng nháp (landlord, nút "Tạo hợp đồng")

A-069 | Điều kiện hiển thị `canOfferContractFallback`: `mode==="RECEIVED"`, status ACCEPTED, chưa có `contract`; có `view` onboarding → `view.askerRole==="LANDLORD" && view.canPrepareContract && !view.cancellationRequestedAt`; không có view → `initialPayment.type==="INITIAL" && initialPayment.status==="CONFIRMED"` | CF:6-12 | —
A-070 | Khoá chống bấm đúp (`contractCreationLock`), `AbortController` huỷ khi unmount; chỉ chạy khi RECEIVED, ACCEPTED, chưa có hợp đồng | M:57-58,85,92-96 | —
A-071 | Chuỗi gọi: (1) refresh onboarding; (2) kiểm tra `askerRole/canPrepareContract/!cancellationRequestedAt` và `serverNow >= paymentOpensAt` (parse ISO hợp lệ) — sai → ném Error "Chưa đủ điều kiện tạo hợp đồng. Cần xác nhận đủ cọc, tiền thuê tháng đầu và đến ngày bắt đầu thuê; hồ sơ không đang hủy."; (3) tạo draft; nếu lỗi "không chắc" (502/503/504 hoặc không response với ECONNABORTED/ETIMEDOUT/ERR_NETWORK) thì **chỉ đọc** `getByRentalRequest`, không POST lại, không có → Error "Chưa xác định được kết quả tạo hợp đồng. Vui lòng làm mới để kiểm tra; không cần thanh toán thêm."; (4) nếu status ≠ DRAFT → `EXISTING`; (5) completeness → chưa đủ → `INCOMPLETE`; (6) không có `currentRevisionId` → Error "Bản nháp chưa có phiên bản để kết xuất."; (7) kết xuất preview (POST 1 lần, đối soát bằng GET `preview-status` tối đa 20 lần cách 3 s, gọi `onReconciling`) → READY/PENDING; lỗi file → `UNAVAILABLE` | CF:24-63, CP:23-56, M:99-106 | `POST /onboarding/refresh`, `POST /contracts {rentalRequestId}`, `GET /contracts/by-rental-request/{id}`, `GET /contracts/{id}/completeness`, `POST /contracts/{id}/previews` (timeout 95 s), `GET /contracts/{id}/preview-status` (timeout 10 s)
A-072 | Toast khi đang đối soát kết xuất: info "Đang kiểm tra kết quả kết xuất; vui lòng không bấm tạo lại." | M:106 | —
A-073 | Kết quả → toast: UNAVAILABLE/PENDING (warning) "Đã có bản nháp nhưng file chưa sẵn sàng. Mở hợp đồng để kiểm tra; không cần tạo lại hay thanh toán thêm."; INCOMPLETE (info) "Đã có bản nháp. Vui lòng bổ sung thông tin bắt buộc trước khi kết xuất và ký."; EXISTING (info) "Hợp đồng đã tồn tại. Mở để tiếp tục theo trạng thái hiện tại."; READY (success) "Bản nháp hợp đồng đã sẵn sàng để kiểm tra."; sau đó đóng chi tiết + điều hướng chi tiết hợp đồng landlord | M:109-115 | —
A-074 | Lỗi: toast `getApiErrorMessage(error,"Chưa thể tạo bản nháp hợp đồng. Vui lòng kiểm tra tiến trình nhận nhà và mẫu hợp đồng.")` (không toast nếu đã abort) | M:116-118 | —
A-075 | `isProcessingAction` của modal chi tiết = `decisions.processing \|\| creatingContractFor !== null` | M:288 | —

### 2.6 Modal chi tiết (DM)

A-076 | Khung `ModalShell`: tiêu đề "Chi tiết yêu cầu thuê" (icon FileText), bottom sheet trên điện thoại (max 94dvh) / thẻ giữa màn hình ≥sm (max-w-5xl), Esc/backdrop đóng (trừ khi `closeDisabled`), khoá scroll nền, nút "Đóng" ở header | DM:237-241, MS:12-66 | —
A-077 | Chip mã `#{id.slice(0,8)}` ở header (ẩn trên điện thoại) | DM:239 | —
A-078 | Mở modal: reset toàn bộ state (onboarding, detail, payment, error, tab="overview"), đánh vé mới | DM:104-115 | —
A-079 | Có `initialDetail` (từ deep link, đã xác thực phía) và `id` khớp, `isOwnSide` → dùng luôn, không GET lần 2; nếu status ∈ ONBOARDING_STATUSES → tải initial-payment | DM:117-122 | `GET /api/v1/rental-requests/{id}/initial-payment`
A-080 | Ngược lại GET chi tiết theo id; chỉ áp dụng nếu vé mới hơn vé đã áp dụng; sai phía/tài khoản → lỗi "Yêu cầu thuê không thuộc tài khoản hoặc vai trò đang xem."; lỗi mạng → "Không thể tải chi tiết yêu cầu thuê. Vui lòng thử lại." | DM:124-142 | `GET /api/v1/rental-requests/{id}`
A-081 | `isOwnSide`: RECEIVED → `res.ownerId===userId`; SENT → `res.renterId===userId` (không tin 200) | DM:86-89 | —
A-082 | ONBOARDING_STATUSES = ACCEPTED, COMPLETED, CANCELLED_BY_SYSTEM, CANCELLED_BY_RENTER, CANCELLED_BY_OWNER → mới có tab xử lý và khối onboarding; PENDING/REJECTED/EXPIRED chỉ có tab Tổng quan + khối "Tiến độ yêu cầu" | DM:58,173,331 | —
A-083 | Initial-payment lỗi → `detailedPayment=null` (im lặng) | DM:98-101 | —
A-084 | Silent refresh khi có sự kiện cho đúng `requestId` (không bật poll): GET lại, áp dụng theo vé, tải lại initial-payment nếu cần | DM:147-157 | `GET` detail + initial-payment
A-085 | Loading: 3 skeleton (`role=status` "Đang tải yêu cầu thuê") | DM:242-245 | —
A-086 | Lỗi: hộp đỏ, tiêu đề "Không thể tải yêu cầu", nội dung `error` hoặc "Yêu cầu thuê không tồn tại hoặc bạn không có quyền truy cập.", nút "Thử lại" (GET lại; lỗi → "Không thể tải chi tiết yêu cầu thuê.") | DM:246-252,196-204 | `GET` detail
A-087 | Header: ảnh 80×80 (alt = tiêu đề hoặc "Ảnh bài đăng"), badge trạng thái (live: dùng `detailedPayment.status`, `onboarding.stage`, `paymentLapsed`), tiêu đề, địa chỉ có icon | DM:171-172,257-268 | —
A-088 | `NextActionCard` (→ nội dung do (B) cung cấp `nextAction` qua `onSnapshot`; mô tả, tone, hạn "Còn …/Đã quá hạn …" xem mục 4 `describeNextAction` và NA): props `role`, `nextAction=onboarding?.nextAction`, `fallbackMessage=onboarding?.message \|\| p.hint`, `primary`, `secondary` | DM:271, NA:52-110 | —
A-089 | Nút chính/phụ của NextActionCard: PENDING+RECEIVED → primary "Chấp thuận · giữ chỗ {holdText}" / "Chấp thuận & giữ chỗ" (disabled `isProcessingAction \|\| !manageGate.allowed`) + secondary "Từ chối"; else nếu bước tiếp theo là của mình và ở tab khác → primary "Đi tới mục xử lý" (chuyển tab); else nếu chưa có onboarding, ACCEPTED, SENT, phase unpaid → primary "Thanh toán" (mở RentalPaymentModal) | DM:177-187 | —
A-090 | Tab (chỉ khi `hasPanel`): "Tổng quan"(overview), "Ký số & tài liệu"(sign), "Thanh toán & cọc"(payment), "Hủy / kết thúc"(end), "Lịch sử"(history); tab "Nội dung hợp đồng" bị loại ở modal này; badge "1" trên tab chứa bước của mình nếu không phải tab đang mở | DM:60-61,273-274, LB:70-77 | —
A-091 | Tự mở đúng tab một lần theo `describeNextAction(view.nextAction).tab` nếu `mine` và khác overview (khi `onSnapshot` nhận onboarding lần đầu) | DM:159-166 | —
A-092 | Tab Tổng quan, PENDING + `respondBy`: `PolicyNotice` "Hạn chủ nhà phản hồi" (summary "Quá hạn yêu cầu tự hết hiệu lực; phòng chưa bị khóa ở bước này.") nội dung "Hạn chủ nhà phản hồi: {giờ VN} (giờ Việt Nam). Quá hạn yêu cầu tự hết hiệu lực; phòng chưa bị khóa ở bước này." | DM:278 | —
A-093 | EXPIRED + `holdExpiresAt`: hộp cảnh báo "Thời hạn giữ chỗ{ ' {n} phút'} đã kết thúc vào lúc {HH:mm:ss, dd/MM/yyyy}" | DM:279-281 | —
A-094 | `rejectReason`: "Lý do từ chối" + `"{reason}"` in nghiêng | DM:282 | —
A-095 | Mục "Bài đăng cho thuê": tiêu đề, "Giá niêm yết hiện tại: {formatVND(listingPrice)}/tháng" (nếu có), nút "Xem bài đăng" | DM:284-293 | —
A-096 | Mục người thuê: tiêu đề RECEIVED "Thông tin khách thuê" / SENT "Thông tin của bạn"; "Họ và tên"; "Số điện thoại" (link `tel:`); "Email liên hệ" (link `mailto:`, nếu có); "Lời nhắn gửi chủ nhà" `"{renterNote}"` (nếu có) | DM:295-303 | —
A-097 | Mục "Điều kiện thuê & nhân khẩu": "Ngày dọn vào", "Thời hạn thuê" (`{n} tháng`), "Dự kiến kết thúc" (`calculateEstimatedEndDate` hoặc "—"), "Số người ở" (`formatOccupantCount`), "Xe máy" (`formatMotorbikeCount`), "Ô tô" (`formatCarCount`) | DM:305-315, SN:77-122 | —
A-098 | Mục "Khoản thanh toán ban đầu": `PolicyNotice` "Nghĩa vụ thanh toán" (summary "Nghĩa vụ gồm cọc và tiền tháng đầu."; nội dung "Nghĩa vụ gồm cọc và tiền tháng đầu. Nếu nhận nhà trong tương lai, hai khoản được mở ở hai thời điểm riêng; xem từng khoản ở mục Thanh toán & cọc. HomeSpace không nhận tiền và không giữ tiền."); dòng "Tiền thuê kỳ đầu", "Tiền đặt cọc", (nếu `prepaidFees>0`) "Phí đã trả trước (yêu cầu cũ)", **"Tổng cọc + tháng đầu"**; ghi chú "Đây là tổng nghĩa vụ, không phải số tiền cần chuyển ngay. Cọc là khoản bảo đảm, hoàn trả theo điều kiện hợp đồng." | DM:317-326 | —
A-099 | Công thức: `rentPrice = effectiveMonthlyRent>0 ? effectiveMonthlyRent : monthlyRentPrice ?? 0`; `prepaidFees = Σ lineItems(type ∉ {RENT, DEPOSIT}).amount` của initial-payment; `upfrontTotal = rentPrice + (depositAmount ?? 0) + prepaidFees` | DM:190-192 | initial-payment
A-100 | `EndOfPeriodCharges` (collapsible "Phí dịch vụ và điện/nước tính cuối kỳ"; xem A-157) với `predictableCharges=parseCostBreakdownSnapshot(costBreakdownSnapshot)`, `excludedCharges=parseExcludedChargesSnapshot(excludedChargesSnapshot)`, `prepaidFees` | DM:193-194,327 | —
A-101 | Khối "Tiến độ yêu cầu" (hiện ở tab Lịch sử, hoặc ở Tổng quan khi không có panel): "Thời điểm gửi yêu cầu" (`HH:mm:ss, dd/MM/yyyy (tương đối)`), "Thời điểm chấp thuận" (nếu có `acceptedAt`), "Cập nhật lần cuối" (nếu `updatedAt !== createdAt`) | DM:206-215,331 | —
A-102 | `RentalOnboardingPanel` (→ bàn giao B): props `rentalRequestId=detail.id`, `isLandlord=(mode==="RECEIVED")`, `sections=PANEL_SECTIONS[tab]` (overview/content → [], sign→["sign"], payment→["payments"], end→["end"], history→["history"]), `onSnapshot`, `onUpdated` = GET lại detail + initial-payment + `onPaymentStatusChange` (→ tải lại danh sách) | DM:59,333-347 | `GET` detail, initial-payment
A-103 | Footer: "Đóng" (disabled khi `isProcessingAction`); "Hủy yêu cầu" (đỏ) khi `canCancelRentalRequest(detail, linkedContract, currentPaymentStatus, role)` và không loading | DM:217-222 | —
A-104 | Footer RECEIVED + ACCEPTED + chưa có HĐ: `RentalContractFallbackButton` (có `view=onboarding` nên điều kiện theo A-069) | DM:223-226 | —
A-105 | Footer khi có HĐ: nút "Xem hợp đồng hiệu lực" (ACTIVE) / DRAFT: RECEIVED "Xem / tiếp tục hợp đồng", SENT "Xem bản nháp hợp đồng" / khác: RECEIVED "Xem / tiếp tục hợp đồng", SENT "Mở hợp đồng" → đóng chi tiết + điều hướng hợp đồng | DM:227-232, M:297 | —
A-106 | Đóng modal: `closeDetail` xoá `requestId` khỏi URL (chỉ param đó) | M:69-73 | —

### 2.7 Deep link `?requestId=` (DP)

A-107 | Có `requestId` nhưng chưa `initialized` → chờ | DP:52 | —
A-108 | Chưa đăng nhập → gọi `login(pathname+search+hash)` đúng một lần | DP:53-58 | —
A-109 | Không khớp regex UUID → toast info "Liên kết yêu cầu thuê không hợp lệ." + xoá param | DP:60-64 | —
A-110 | Hợp lệ → `GET /rental-requests/{id}` (không quét list, không lọc status); phải đúng phía (`ownerId`/`renterId === userId`) và `request.id===rawId`, nếu sai: toast info "Yêu cầu thuê không thuộc phía tài khoản bạn đang xem." + xoá param; đúng → mở modal với `initialDetail` | DP:66-82 | `GET /api/v1/rental-requests/{id}`
A-111 | Lỗi 403/404 → toast info "Yêu cầu thuê không còn tồn tại hoặc bạn không có quyền xem."; lỗi khác → toast error "Không thể mở yêu cầu thuê lúc này. Vui lòng thử lại."; luôn xoá param | DP:83-93 | —
A-112 | Bỏ param (back) khi link đang mở → đóng modal | DP:44-50 | —
A-113 | Mở chi tiết thủ công (`openDetail`) xoá param trước, bỏ `verifiedDetail` | M:74-78 | —

### 2.8 AI đánh giá (AI) — chỉ LANDLORD

A-114 | Mở: dialog toàn màn (max-w-3xl, max 90dvh): tiêu đề "AI đánh giá yêu cầu thuê", phụ đề tên bài đăng, nút đóng `aria-label="Đóng đánh giá AI"`; Esc = đóng | AI:110-124 | —
A-115 | Tự gọi review khi mở: "Đang đọc và so sánh các yêu cầu…" | AI:59-79,127 | `POST /api/v1/ai/agent/rental-requests/review {listingId}`
A-116 | Lỗi review: hộp vàng `getApiErrorMessage(e,"Chưa đánh giá được các yêu cầu lúc này. Vui lòng thử lại.")`, bỏ review | AI:66-69,128 | như trên
A-117 | Khi có review: "Đề xuất cho chủ nhà" (xanh) + `summary` render Markdown (`AiMarkdownMessage`) | AI:130-137 | —
A-118 | Danh sách xếp hạng: số thứ tự, `renterName`, `score/100`, thanh tiến độ (clamp 0-100), hạng 1 viền xanh; chip sự thật: `{leaseMonths} tháng` (nếu ≠null), `{occupantCount} người` (nếu ≠null), `Dọn vào {dd/MM/yyyy|"Chưa rõ"}`, `Cọc {N đ|"Chưa rõ"}`; điểm mạnh "✓ …" (xanh), điểm yếu "• …" (vàng) | AI:17-40,139-165 | —
A-119 | Nút "Chấp thuận yêu cầu này" trên từng dòng: đóng modal AI rồi mở hộp xác nhận chấp thuận hiện có (lấy yêu cầu từ list local, không có thì GET theo id; lỗi toast "Không mở được yêu cầu để chấp thuận. Vui lòng thử lại.") | AI:166-170, M:151-158 | `GET /api/v1/rental-requests/{id}`
A-120 | "Hỏi AI nhanh": 3 gợi ý "Vì sao chọn người này?", "Rủi ro khi chọn người này là gì?", "Nếu tôi ưu tiên doanh thu ổn định thì nên chọn ai?" (disabled khi `busy`); ô nhập tối đa 500 ký tự, placeholder "Ví dụ: So sánh rủi ro của hai người thuê", nút gửi `aria-label="Gửi câu hỏi"` disabled khi `busy` hoặc rỗng | AI:11-15,175-207 | `POST /api/v1/ai/agent/rental-requests/review/ask {listingId, question, history: 6 lượt cuối}`
A-121 | Lịch sử hội thoại: user (bên phải, nền primary) / assistant (Markdown); "AI đang trả lời…"; trả lời xong cập nhật `review` mới; lỗi: thêm lượt assistant `getApiErrorMessage(e,"AI chưa trả lời được lúc này. Bạn thử lại sau nhé.")`; chống gửi đồng thời | AI:82-105,185-196 | như trên
A-122 | Chú thích: "Điểm số tính từ dữ liệu yêu cầu theo trọng số cố định; AI chỉ giải thích. Bạn là người quyết định chấp thuận hay từ chối." | AI:210-213 | —
A-123 | Footer: "Đánh giá lại" (disabled khi `loading \|\| busy`), "Đóng" | AI:218-221 | review

### 2.9 Gửi yêu cầu thuê (RM, từ chi tiết nhà)

A-124 | Nút chính "Yêu cầu thuê nhà" hiện khi: listing PUBLISHED (`acceptsNewRequests`), không có yêu cầu active, và `showVisitorCta` (không phải chủ, không preview); tooltip `rentalGate.title ?? "Gửi yêu cầu thuê nhà trực tiếp tới chủ nhà"` | RV:189,431,494-524 | —
A-125 | Bấm: chủ bài đăng → toast info "Bạn là chủ bài đăng này, không thể tự gửi yêu cầu thuê."; chưa đăng nhập → toast error "Vui lòng đăng nhập để gửi yêu cầu thuê nhà" + `login()`; gate `RENTAL_REQUEST_CREATE` (quyền + hồ sơ đầy đủ; toast khoá `FEATURE_LOCKED_MESSAGE`="Tính năng này đang bị tạm khóa cho tài khoản của bạn" hoặc "Cần cập nhật: {Thông tin cá nhân, Địa chỉ, Tài khoản ngân hàng, Xác minh danh tính (KYC)}"); rồi `requireKyc` | RV:501-517, UP:16-29, PG:58-67 | —
A-126 | `requireKyc`: chưa có profile → toast info "Đang tải thông tin tài khoản. Vui lòng thử lại trong giây lát."; `profile.kycVerified!==true` → toast error "Vui lòng xác minh danh tính (KYC) trước khi thực hiện thao tác này." + nút "Xác minh ngay" (→ `/kyc?returnTo=…`), **không** tự chuyển (`redirect:false`); đủ → mở modal | KY:19-53 | —
A-127 | CTA theo trạng thái: yêu cầu PENDING → nút vàng "Đã gửi yêu cầu thuê (Chờ duyệt)" (tooltip "Xem yêu cầu thuê đang chờ duyệt của bạn") + link "Xem yêu cầu của tôi" → `/dashboard/rental-requests/my-requests`; ACCEPTED → nút xanh "Yêu cầu được duyệt (Đang giữ chỗ)" (tooltip "Yêu cầu thuê đã được duyệt và đang giữ chỗ trong {RENTAL_HOLD_DURATION_LABEL}! Bấm để xem chi tiết") + cùng link; listing RESERVED (không có yêu cầu của mình) → nút disabled "Đang giữ chỗ (Tạm khóa)" (tooltip "Chỗ thuê này đang được giữ chỗ trong {RENTAL_HOLD_DURATION_LABEL} cho một khách thuê khác"); listing không PUBLISHED → "Tin hiện không nhận yêu cầu thuê mới" | RV:438-497 | —
A-128 | Yêu cầu active của khách: tải khi mở trang nếu `authenticated && !previewMode`; tải lại khi đóng modal; `onSuccess(req)` gán ngay. Lỗi nuốt im (→ null) | RV:202-212,967-973,1001-1003, S1:61-72 | `GET /api/v1/rental-requests/by-listing/{listingId}` (200 `result:null` nếu không có/chưa đăng nhập)
A-129 | Hằng `RENTAL_HOLD_DURATION_MINUTES=60` hard-code dùng cho tooltip A-127 (không lấy từ policy) | `config/rental-hold.config.ts:2-4` | —
A-130 | Props truyền vào RM: `listingId,listingTitle,listingAddress=property.location,listingPrice=priceMillion*1e6,depositType(property.depositType\|\|details.depositType\|\|pricing.depositType),listingDepositAmount,depositMonths,listingThumbnail=images[0],minimumLeaseMonths=Number(details.minimumLeaseMonths)\|\|6,listingMaxOccupants=details.maxOccupants (number)\|\|null` | RV:965-1004 | —
A-131 | Form modal: lớp phủ mờ, bấm nền hoặc X = đóng (`onClose`); tiêu đề "Gửi yêu cầu thuê nhà", phụ đề "Đăng ký quan tâm và thỏa thuận điều kiện thuê"; **không** khoá đóng khi đang gửi (nút "Hủy" disabled khi `isSubmitting`) | RM:493-522,1175-1181 | —
A-132 | Policy giữ chỗ khi mở: `holdMinutes` (null khi lỗi); `PolicyNotice` warning "Điều kiện giữ chỗ", summary "Sau khi chủ nhà chấp thuận, bạn có **{n phút \| 'thời hạn hiển thị trên yêu cầu thanh toán'}** để hoàn tất khoản giữ chỗ."; nội dung: "Khoản giữ chỗ được mở sau khi chủ nhà chấp thuận. {depositAmount===0 ? 'Không yêu cầu đặt cọc: bỏ qua chuyển cọc và ký hợp đồng cọc. Tiền thuê tháng đầu và ký hợp đồng thuê mở vào ngày bắt đầu thuê.' : 'Dọn vào cùng ngày: thu cọc + tiền thuê tháng đầu. Dọn vào sau: chỉ thu cọc trước, đến ngày dọn vào mới mở tiền thuê tháng đầu. Sau khi chủ nhà xác nhận nhận cọc, hai bên xem và ký hợp đồng cọc trước, không đợi đến ngày vào. Hợp đồng thuê ký riêng khi đến ngày vào và xác nhận đủ tiền tháng đầu.'} Bạn có thể đề nghị chủ nhà đồng ý bắt đầu thuê sớm." | RM:86-91,524-535 | `GET /api/v1/rental-requests/policy`
A-133 | Tải điều kiện giữ chỗ khi mở (reset accepted=false); lỗi → toast "Chưa tải được điều kiện giữ chỗ. Hãy mở lại trước khi gửi yêu cầu." | RM:111 | `GET /api/v1/rental-requests/reservation-policy` → `{version,text}`
A-134 | Tóm tắt tin đăng: ảnh 56×56 (hợp lệ nếu http/https hoặc `/`), tiêu đề, địa chỉ, `{formatVND(listingPrice)}/tháng`, badge cọc `depositInfo.badge` | RM:540-574 | —
A-135 | Prefill khi có profile: `renterName` = "firstName lastName" (lọc rỗng) hoặc `username`; `renterPhone=profile.phone`; `renterEmail=profile.email` (chạy lại mỗi khi profile đổi, ghi đè giá trị người dùng đã gõ) | RM:123-136 | —
A-136 | Mở modal: reset ngày = hôm nay, `leaseMonths = (min>12 ? min : 12)` với `min=max(minimumLeaseMonths||1,1)`, `occupantCount=1`, xe=0, ghi chú rỗng, chưa đồng ý chính sách, estimate rỗng, `customDepositInput = format vi-VN(listingPrice)` hoặc "" | RM:176-199 | —
A-137 | Ngày dọn vào: nhãn "Ngày bắt đầu dọn vào" *; hiển thị `EEEE, 'ngày' dd 'tháng' MM, yyyy` (vi); popup lịch, disable ngày < hôm nay; chọn xong đóng popup; mặc định hôm nay | RM:577-617 | —
A-138 | Thời hạn thuê: nhãn "Thời hạn thuê" *, "Tối thiểu {minimumLeaseMonths} tháng"; 4 nút nhanh theo `quickLeaseOptions` (min≤6: 6/12/18/24; ≤12: 12/24/36/48; ≤24: [min,24,36,48] bù +12 cho đủ 4; >24: [min,min+6,min+12,min+24]); nhãn nút: <12 `{m} tháng`, bội 12 `{m} th ({y} năm)`, khác `{m} tháng`; nút < min disabled mờ | RM:139-164,619-662 | —
A-139 | Ô nhập số tháng (number, min=minimumLeaseMonths\|\|1, max=240, placeholder "Nhập số tháng (tối thiểu {min} tháng)", hậu tố "tháng"): gõ số >0 → set `leaseMonths` ngay; blur với rỗng hoặc < min → khôi phục ô theo `leaseMonths` (**không** nâng `leaseMonths` lên min — chỉ submit mới chặn) ; nút "-1" (title "Giảm 1 tháng", disabled khi `leaseMonths<=min`), "+1" ("Tăng 1 tháng"), "+1 năm" ("Tăng 1 năm (12 tháng)") — **không có trần 240 ở +1/+1 năm/gõ** | RM:664-734 | —
A-140 | Hộp "Thời gian thuê:" `formatDetailedDuration` ("{m} tháng" <12; "{y} năm ({m} tháng)"; "{y} năm {r} tháng ({m} tháng)") và "Dự kiến kết thúc hợp đồng:" `dd/MM/yyyy` (= moveInDate + leaseMonths tháng) | RM:166-173,736-751 | —
A-141 | Số người: nhãn "Số người sẽ ở thường xuyên" *; phụ: "Tối đa {limit} người theo bài đăng" hoặc "Tối thiểu 1 người"; ô number (min1, max `limit ?? 20`, placeholder "Nhập số người (tối đa {limit??20})", hậu tố "người"); gõ → `clampOccupants` và kẹp xe ≤ số người; rỗng → 0 (tạm); blur → clamp (rỗng→1); "-1" (disabled ≤1, title "Giảm 1 người"), "+1" (disabled ≥ limit??20, title "Tăng 1 người") | RM:756-842, OL:12-15 | —
A-142 | Giới hạn người: `resolveOccupantLimit(listingId, listingMaxOccupants, snapshot)` — ưu tiên snapshot từ estimate (`occupantLimit`), khác listing → dùng `listingMaxOccupants` đã chuẩn hoá (`normalizeOccupantLimit`: số nguyên an toàn >0 else null) | RM:101-102, OL:3-10 | —
A-143 | Dòng thông tin "Số người được dùng để tính tiền thuê / phí nước." khi estimate có phí `PER_PERSON_MONTH` hoặc `effectiveMonthlyRent > listingPrice` | RM:770-775, HP:28-37 | —
A-144 | Phương tiện: chỉ hiện khi estimate có `motorbike.allowed \|\| car.allowed` (`hasVehicleParkingAllowed`); tiêu đề "Phương tiện mang theo", phụ "Chỗ khả dụng theo lịch thuê"; mỗi loại ("Xe máy"/"Ô tô"): badge "Còn {available} chỗ" (xanh) hoặc "Hết chỗ" (đỏ), `note` từ server, stepper -/+ và ô số; `max = min(available, max(1,occupants))`; ô gõ kẹp bằng `clampValue` | RM:845-985, HP:14-26 | estimate
A-145 | Thông tin liên hệ: "Họ và tên" * (placeholder "Nguyễn Văn A", `required`), "Số điện thoại" * (type tel, placeholder "0912345678", `required`), "Địa chỉ Email (để nhận hợp đồng & thông báo)" (type email, placeholder "email@example.com", tuỳ chọn) | RM:987-1043 | —
A-146 | Chỉ khi cọc THỎA THUẬN: khối "Tiền cọc đề xuất (Thỏa thuận)" hiển thị `formatVND(depositAmount)`; ô text số (`inputMode=numeric`, chỉ giữ chữ số, định dạng `vi-VN`, hậu tố "VNĐ", placeholder "VD: {formatVND(listingPrice)}"); nút "Gợi ý nhanh:" → "1 tháng ({formatVND(listingPrice)})", "2 tháng ({…})" (chỉ khi listingPrice>0), "Miễn cọc (0 đ)" (đặt "0"); `PolicyNotice` "Thỏa thuận tiền cọc" ("* Bài đăng cho phép thỏa thuận tiền cọc." / "* Bài đăng cho phép thỏa thuận tiền cọc. Mức tiền cọc bạn đề xuất sẽ được gửi đến chủ nhà xem xét duyệt.") | RM:1045-1117 | —
A-147 | `depositInfo` (cọc hiển thị trước khi có estimate): type = `depositType`, nếu thiếu: `listingDepositAmount>0`→FIXED_AMOUNT, `depositMonths>0`→MONTH_COUNT, else FIXED_AMOUNT. NONE: label "Không đặt cọc", badge "Không yêu cầu đặt cọc", 0. MONTH_COUNT: `rent*max(months,1)`, badge "{n} tháng tiền nhà". FIXED_AMOUNT: `listingDepositAmount ?? rent`, badge "Cố định theo bài đăng". NEGOTIABLE: rỗng → rent, else số từ ô; badge "Theo thỏa thuận" | RM:208-276 | —
A-148 | Dự toán (backend): khoá `estimateKey = [listingId, yyyy-MM-dd, leaseMonths, occupants, motorbike, car, isNegotiable, depositAmount]`; debounce 250 ms; body `{listingId, moveInDate, leaseMonths, occupantCount:max(1,occ), motorbikeCount:min(max(0,m),max(1,occ)), carCount:min(max(0,c),max(1,occ)), negotiatedDepositAmount (chỉ khi thỏa thuận)}`; kết quả chỉ dùng nếu `estimateFor===estimateKey` (chưa khớp = loading) | RM:279-297,300-304 | `POST /api/v1/rental-requests/estimate`
A-149 | Sau estimate thành công: lưu snapshot `occupantLimit`; xe không cho phép → xe=0; xe vượt `min(available, occ)` → kẹp; `occupantLimit && occupants>limit` → hạ `occupantCount` về limit và kẹp xe | RM:305-339 | —
A-150 | Estimate lỗi: lỗi = `response.data.message` hoặc "Không thể tính toán chi phí dự kiến cho bài đăng này." | RM:341-350 | —
A-151 | Cọc dùng khi gửi = `estimate.depositAmount ?? depositInfo.amount` | RM:372 | —
A-152 | `RentalCostSummary` (CS): loading → "Đang tính lịch thanh toán..."; lỗi/thiếu `paymentPlan` → "Chưa thể xác định khoản thanh toán" + lỗi, hoặc "Chưa có lịch thanh toán từ hệ thống. Vui lòng tải lại dự toán trước khi gửi yêu cầu." | CS:24-35 | —
A-153 | CS khi có `paymentPlan`: tiêu đề `depositOnly ? (deposit===0 ? "Không yêu cầu đặt cọc" : "Đặt cọc trước ngày nhận nhà") : "Thanh toán ban đầu"`; mô tả theo 4 tổ hợp (depositOnly × deposit===0): "Bỏ qua chuyển cọc và ký hợp đồng cọc. Tiền thuê tháng đầu mở vào ngày bắt đầu thuê." / "Sau khi chủ nhà chấp thuận, chỉ thanh toán tiền cọc giữ chỗ. Chưa thu tiền thuê tháng đầu." / "Dọn vào cùng ngày: chỉ thanh toán tiền thuê tháng đầu và ký hợp đồng thuê, bỏ qua hợp đồng cọc." / "Dọn vào cùng ngày: thanh toán tiền cọc và tiền thuê tháng đầu sau khi chủ nhà chấp thuận yêu cầu." | CS:47-56 | —
A-154 | CS dòng tiền: "Tiền thuê kỳ đầu" (`plan.firstRentAmount`, ẩn khi `depositOnly`); "Tiền đặt cọc ({depositBadge})" hoặc "Tiền đặt cọc (không có)"; tổng: `depositOnly ? "Cọc cần thanh toán sau khi được duyệt" : "Tổng cần thanh toán ban đầu"` = `plan.amountAfterApproval`; chú thích "Bạn được miễn cọc, không cần chuyển tiền giữ chỗ. " (depositOnly & deposit 0) hoặc "Chuyển trực tiếp cho chủ nhà. " + "HomeSpace không nhận hoặc giữ tiền." | CS:59-78 | —
A-155 | CS khi `depositOnly`: thẻ "Tiền thuê tháng đầu — thanh toán sau": "Mở thanh toán từ {dd/MM/yyyy của firstRentOpensOn}" + số tiền, `PolicyNotice` "Thanh toán tiền phòng tháng đầu" (summary "Hệ thống mở thanh toán tiền phòng tháng đầu vào ngày bắt đầu dọn vào."; nội dung "Đến ngày bắt đầu dọn vào {dd/MM/yyyy moveInDate}, hệ thống mới mở thanh toán tiền phòng tháng đầu. Không thu lại khoản cọc đã xác nhận. Ký hợp đồng mở sau khi đã xác nhận đủ tiền theo tiến trình nhận nhà.") | CS:81-88 | —
A-156 | CS luôn: `PolicyNotice` "Về dự toán chi phí" (summary "Khoản cần thanh toán được xác định lại khi chủ nhà chấp thuận."; nội dung "Dự toán theo ngày {businessDate} của hệ thống. Khoản cần thanh toán được xác định lại khi chủ nhà chấp thuận; nếu thời điểm đó trùng ngày dọn vào thì thu cọc + tháng đầu. Ngày thuê có thể thay đổi nếu hai bên đồng ý bắt đầu sớm."); rồi `EndOfPeriodCharges(predictableCharges, excludedCharges)` từ estimate; `dateLabel` = đảo "yyyy-MM-dd" → "dd/MM/yyyy" | CS:40,89-94 | —
A-157 | `EndOfPeriodCharges` (collapsible `<details>` đóng sẵn): tiêu đề "Phí dịch vụ và điện/nước tính cuối kỳ"; câu mở "Những khoản dưới đây **không nằm trong tổng thanh toán ban đầu**. Chủ nhà sẽ quyết toán sau kỳ thuê theo hợp đồng và mức sử dụng thực tế."; nhóm "Phí cố định theo bài đăng" (charge payable có `amount>0`: `{displayName}` — `{formatVND(amount)}/tháng`); nhóm "Theo sử dụng thực tế" (excluded metered: PER_KWH/PER_M3/STATE_WATER_RATE/PER_HOUR → `formatExcludedChargeValue`); nếu có excluded khác: "Các khoản cần thỏa thuận hoặc tự thanh toán sẽ được hai bên xác nhận riêng."; nếu `prepaidFees>0`: "Yêu cầu cũ đã trả trước {formatVND} tiền phí; khoản này sẽ không bị thu lại."; cuối: "Chi phí phát sinh chưa biết trước sẽ chỉ được tính khi có thực tế và được ghi rõ trên hóa đơn cuối kỳ." | EC:18-73, HP:39-121 | —
A-158 | Lời nhắn: nhãn "Lời nhắn gửi chủ nhà (tuỳ chọn)", bộ đếm `{len}/500`, textarea 3 dòng maxLength 500, placeholder "VD: Tôi muốn thuê lâu dài, hiện đang làm việc tại quận 1, có nuôi 1 chú mèo nhỏ ngoan..." | RM:1129-1146 | —
A-159 | Đồng ý chính sách: checkbox `required`, disabled khi chưa tải được policy; "**Tôi đã đọc và đồng ý** [điều kiện giữ chỗ] **(bắt buộc)**" — link mở `PolicyConsent` (tiêu đề "Điều kiện giữ chỗ", phụ đề "Vui lòng đọc kỹ trước khi đồng ý", nhãn phiên bản "Phiên bản {n}" tách từ `version` bằng regex `v?(\d+(\.\d+)*)$`, nội dung `text` viết hoa chữ đầu, nhiều câu → danh sách số; chân "Bạn vẫn cần tích ô đồng ý trong biểu mẫu"; nút "Đã hiểu" và "Đồng ý & đóng" (tích luôn checkbox)); policy chưa tải: "điều kiện giữ chỗ (đang tải…)" | RM:1149-1158, PD:7-12,216-275 | —
A-160 | Dòng trạng thái cạnh nút gửi: chưa đồng ý → "Vui lòng đọc và tích đồng ý điều kiện giữ chỗ để gửi yêu cầu thuê."; có lỗi estimate → "Chưa thể xác nhận dự toán chi phí."; chưa có estimate & đang tính → "Đang tính toán dự toán thanh toán..." | RM:1160-1172 | —
A-161 | Nút "Gửi yêu cầu thuê" (icon Sparkles; "Đang gửi yêu cầu..." khi gửi) disabled khi `isSubmitting \|\| !reservationPolicy \|\| !accepted \|\| loadingEstimate \|\| estimateError \|\| !estimate.paymentPlan` | RM:1183-1192 | —
A-162 | Validate theo thứ tự (toast error, dừng ở lỗi đầu): "Bạn cần đồng ý điều kiện giữ chỗ trước khi gửi yêu cầu thuê." → "Vui lòng chọn ngày bắt đầu dọn vào" → "Vui lòng chờ hệ thống xác định lịch và khoản thanh toán trước khi gửi yêu cầu." → "Ngày bắt đầu thuê không thể trong quá khứ" → "Vui lòng chọn thời hạn thuê hợp lệ" (`<1`) → "Thời hạn thuê tối thiểu cho căn này là {min} tháng" → "Vui lòng nhập số người dọn vào ở (tối thiểu 1 người)" (không phải số nguyên an toàn hoặc <1) → "Bài đăng chỉ cho phép tối đa {limit} người." → "Chỉ còn {available} chỗ xe máy khả dụng trong thời gian này." → "Chỉ còn {available} chỗ ô tô khả dụng trong thời gian này." → "Vui lòng nhập họ và tên của bạn" → "Vui lòng nhập số điện thoại liên hệ" | RM:385-451 | —
A-163 | Gửi: body `{listingId, moveInDate yyyy-MM-dd, leaseMonths, occupantCount, motorbikeCount:min(m,occ), carCount:min(c,occ), renterName.trim(), renterPhone.trim(), renterEmail.trim()||undefined, depositAmount, negotiatedDepositAmount (chỉ khi thỏa thuận), renterNote.trim()||undefined, reservationPolicyAccepted, reservationPolicyVersion}` | RM:455-470 | `POST /api/v1/rental-requests`
A-164 | Thành công: toast "Gửi yêu cầu thuê nhà thành công! Chủ nhà sẽ nhận được thông báo để xem xét.", `onSuccess(created)`, đóng | RM:472-476 | —
A-165 | Lỗi: toast `response.data.message` ‖ `error.message` ‖ "Không thể gửi yêu cầu thuê nhà. Vui lòng kiểm tra lại thông tin." (lưu ý: **không** dùng `errors[]` như `getApiErrorMessage`) | RM:477-486 | —
A-166 | Backend từ chối: quyền `RENTAL_REQUEST_CREATE`, hồ sơ đầy đủ (code 1010), KYC, policy version đúng, ngày không quá khứ, listing PUBLISHED (RESERVED → `LISTING_ALREADY_RESERVED`), không phải chủ, chưa có PENDING/ACCEPTED của chính mình cho listing (`RENTAL_REQUEST_ALREADY_EXISTS`) | RRC:66-76, RRS:176-207 | `POST`

### 2.10 Quyền / KYC / hồ sơ

A-167 | `useFeatureGate(code)`: khoá nếu thiếu quyền (message `FEATURE_LOCKED_MESSAGE`) hoặc hồ sơ chưa đủ (ngoại trừ FAVORITE_USE, KYC_SUBMIT) → "Cần cập nhật: {Thông tin cá nhân, Địa chỉ, Tài khoản ngân hàng, Xác minh danh tính (KYC)}" (nhãn thiếu theo thứ tự cố định); quyền chưa tải (`null`) → không khoá; hồ sơ chưa tải → coi như sẵn sàng | UP:7-29, PG:6-67, PM:19-22 | —
A-168 | Cổng dùng trong phần A: `RENTAL_REQUEST_CREATE` (nút gửi), `RENTAL_REQUEST_MANAGE` (Chấp thuận/Từ chối trên thẻ và modal), `CONTRACT_MANAGE` (Tạo hợp đồng); **Hủy yêu cầu và Thanh toán không bị gate** | RV:173, M:49-50, CD:121-145 | —
A-169 | Backend 403 code 1009 (thiếu quyền) / 1010 (hồ sơ chưa đủ) kích hoạt `PERMISSIONS_STALE_EVENT`/`PROFILE_GATE_STALE_EVENT` ở axios client (refetch quyền/onboarding) | PM:24,44-47, PG:17,70-80 | —
A-170 | Accept/Reject backend yêu cầu `@RequiresCompleteProfile` + `RENTAL_REQUEST_MANAGE`; Cancel không có hai ràng buộc này | RRC:146-160 vs 98-106 | —

### 2.11 Khác

A-171 | Điều hướng tới hợp đồng: `contractDetailPath(role, id)` = `/dashboard/{landlord|tenant}/contracts/{id}` (RECEIVED→landlord, SENT→tenant) | M:173,297, `lib/contract-routes.ts:7-9` | —
A-172 | Link bài đăng `listingDetailPath(listingId)` = `/rent/{id}` (id UUID) | `lib/listing-detail-access.ts:18-24` | —
A-173 | Định dạng tiền `formatVND` (`Intl vi-VN VND`, 0 chữ số thập phân, falsy → 0) | HP:7-12 | —
A-174 | Định dạng "Số người ở": `{n>0?n:1} người`; xe: "Không đăng ký xe máy"/"{n} xe máy"; "Không đăng ký ô tô"/"{n} ô tô" (chi tiết); thẻ/hộp accept dùng chuỗi khác (A-036, A-059) | SN:77-101 | —
A-175 | `parseCostBreakdownSnapshot` / `parseExcludedChargesSnapshot`: JSON.parse an toàn, mảng object, chuẩn hoá trường (mặc định "OTHER", "Khoản phí", "PER_MONTH"/"CUSTOM", reason "Chưa bao gồm trong tổng") | SN:12-71 | —
A-176 | `calculateEstimatedEndDate`: `addMonths(parseISO(moveInDate), leaseMonths>0?leaseMonths:1)` → `dd/MM/yyyy` hoặc null | SN:107-122 | —
A-177 | Thông báo chat không liên quan; nhưng `RENTAL_REQUEST` có nhãn loại (tag) khi hiển thị chuông: "Yêu cầu mới", "Chấp nhận", "Từ chối", "Tự động từ chối", "Đã hủy", "Hết hạn", "Hết hạn giữ chỗ", … (26 loại) và nhãn vai trò "Vai trò chủ nhà"/"Vai trò người thuê" theo `metadata.recipientSide` | `services/notification.service.ts:198-229,372-396` | —

---

## 3. Bảng API

Base `/api/v1` qua Gateway (axios `lib/axios-client.ts`). Tất cả cần JWT. Response bọc `ApiResponse{code,message,result}`; phân trang `PageResponse{code,result[],page,size,totalElements,totalPages,hasMore}` (không nằm trong `result`). Trang 1-based.

| # | Method + path | Params / body | Trường được hiển thị | Xử lý lỗi web | Backend |
|---|---|---|---|---|---|
| 1 | GET `/rental-requests/policy` | — | `holdMinutes` (số phút) | nuốt lỗi, `holdMinutes=null` → UI bỏ số (HM, RM:89) | RRC:44-48 (cũng trả `responseHours`, web bỏ qua) |
| 2 | GET `/rental-requests/reservation-policy` | — | `version`, `text` | toast "Chưa tải được điều kiện giữ chỗ. Hãy mở lại trước khi gửi yêu cầu." (RM:111) | RRC:50-53 |
| 3 | POST `/rental-requests/estimate` | body A-148 (`RentalEstimateRequest`: listingId, moveInDate, leaseMonths≥1, occupantCount≥1, motorbikeCount≥0, carCount≥0, negotiatedDepositAmount≥0) | `occupantLimit`, `motorbike{allowed,available,note}`, `car{…}`, `effectiveMonthlyRent`, `predictableCharges[]`, `excludedCharges[]`, `depositAmount`, `paymentPlan{businessDate,moveInDate,depositOnly,amountAfterApproval,firstRentAmount,firstRentOpensOn}` | `response.data.message` ‖ chuỗi mặc định (RM:341-350) | RRC:59-64, RRS:137-172, RCC:55-100 (lỗi: ngày quá khứ "Ngày bắt đầu thuê đã qua; vui lòng chọn ngày mới.", "Số người sẽ ở (N người) vượt quá giới hạn tối đa của bài đăng (M người).", "Chi nhánh/bài đăng chỉ còn N chỗ xe máy…", "Tiền đặt cọc đề xuất không được âm.") |
| 4 | POST `/rental-requests` | body A-163 (`CreateRentalRequest`) | `result` = RentalRequestResponse (web chỉ nhét vào state CTA: `id`, `status`) | A-165 | RRC:66-76 (`@RequiresCompleteProfile`, `@PreAuthorize RENTAL_REQUEST_CREATE`, KYC), RRS:176-269, DTO `hs-listing-service/.../dto/request/CreateRentalRequest.java` |
| 5 | GET `/rental-requests/my-requests` | `status?`(enum), `page=1`, `size` (web 8; BE mặc định 10, tối đa 50) | list `RentalRequestResponse` (mục 3.1) | toast A-012 | RRC:78-85, RRS:464-493 |
| 6 | GET `/rental-requests/owner` | `listingId?`, `status?`, `page`, `size` | như trên | như trên | RRC:128-136, RRS:496-526 |
| 7 | GET `/rental-requests/owner/conflicts` | — | `[{listingId,listingTitle,listingAddress,pendingCount,requestIds[]}]` | lỗi → fallback cục bộ (M:133-145) | RRC:138-144, RRS:529-548 |
| 8 | GET `/rental-requests/by-listing/{listingId}` | — | `id`,`status` (PENDING/ACCEPTED); `result:null` nếu chưa đăng nhập/không có | nuốt mọi lỗi → null (S1:61-72) | RRC:87-96, RRS:550-560 |
| 9 | GET `/rental-requests/{id}` | — | toàn bộ trường mục 3.1 | modal: A-080/086; deep link: A-111 | RRC:108-114, RRS:447-461 (403 `RENTAL_REQUEST_FORBIDDEN` nếu không phải owner/renter; 404 `RENTAL_REQUEST_NOT_FOUND`) |
| 10 | GET `/rental-requests/{id}/initial-payment` | — | `status`, `lineItems[{type,amount}]` (chỉ để tính `prepaidFees`, badge live, `transferWindowClosed` dùng `type,status,dueAt`) | nuốt lỗi → null | RRC:116-122 |
| 11 | PUT `/rental-requests/{id}/accept` | — | (bỏ qua body; tải lại list) | A-062/063 | RRC:146-156 (message BE gồm số phút), RRS:272-366 |
| 12 | PUT `/rental-requests/{id}/reject` | `{rejectReason?: string≤500}` (web gửi `""` nếu bỏ trống → BE ghi "Chủ nhà từ chối yêu cầu thuê") | — | A-065 | RRC:158-169, RRS:369-406 |
| 13 | PUT `/rental-requests/{id}/cancel` | — | — | A-067 | RRC:98-106 → `ROS.cancelUnpaid` `ROS:347-385` (chủ nhà → CANCELLED_BY_OWNER, người thuê → CANCELLED_BY_RENTER; từ chối nếu đã ký/đã chuyển tiền/đã nhận cọc, với thông điệp tiếng Việt từ ROS:352-369) |
| 14 | POST `/ai/agent/rental-requests/review` | `{listingId}` (36 ký tự) | `summary`, `recommendedRequestId`, `ranking[{requestId,renterName,rank,score,facts{leaseMonths,occupantCount,moveInDate,depositAmount},strengths[],weaknesses[]}]` | A-116; lỗi FastAPI `detail` (403 "Vui lòng đăng nhập để dùng tính năng này." / "Bạn không có quyền xem yêu cầu thuê của phòng này."; 404 "Không tìm thấy yêu cầu thuê đang chờ duyệt của phòng này."; 409 "Phòng này hiện chỉ có 1 yêu cầu đang chờ duyệt nên chưa cần so sánh."; 502 "Chưa đọc được danh sách yêu cầu thuê lúc này. Vui lòng thử lại.") | AIR:63-104 |
| 15 | POST `/ai/agent/rental-requests/review/ask` | `{listingId, question(1-500), history[{role,content≤1500}] ≤6}` | `answer`, `status` (ANSWERED/GENERATION_UNAVAILABLE), `review` | A-121 | AIR:93-120 |
| 16 | GET `/contracts/by-rental-request/{id}` | `includeDepositFallback=true` | `status`, `agreementKind`, `contractNumber`, `id`, `currentRevisionId` | từng id lỗi → bỏ qua | `services/contract.service.ts:87-96` (C) |
| 17 | POST `/rental-requests/{id}/onboarding/refresh` | — | `askerRole, canPrepareContract, cancellationRequestedAt, serverNow, paymentOpensAt` | A-074 | `services/rental-onboarding.service.ts:43` (B) |
| 18 | POST `/contracts` ; GET `/contracts/{id}/completeness` ; POST `/contracts/{id}/previews` (timeout 95 s, param `expectedRevisionId`) ; GET `/contracts/{id}/preview-status` (timeout 10 s) | `{rentalRequestId}` | `contract.id/status/currentRevisionId`, `completeness.complete` | A-071..074 | `services/contract.service.ts:98-175` (C) |

### 3.1 `RentalRequestResponse` (trường nhận từ BE, RRS:~690-740)
`id, listingId, listingTitle, listingAddress, listingThumbnail, listingPrice, ownerId, renterId, renterName, renterPhone, renterEmail, moveInDate, leaseMonths, occupantCount, motorbikeCount, carCount, monthlyRentPrice, effectiveMonthlyRent, estimated*Total/Charges, depositAmount, costBreakdownSnapshot(JSON string), excludedChargesSnapshot(JSON string), listingSnapshot, renterNote, status, cancellationRefundPending, rejectReason, acceptedAt, holdExpiresAt, respondBy, initialPayment{id,type,status,totalAmount,dueAt,confirmationDueAt,canCancelImmediately,…}, latestStartChange{status,…}, createdAt, updatedAt`.
Web hiển thị trực tiếp: tất cả trừ `estimated*`, `listingSnapshot`, `renterId/ownerId` (chỉ dùng để xác thực phía).

### 3.2 Chuyển trạng thái (backend)
- Tạo → PENDING (`respondBy = now + rental.response-hours (24h)`) · RRS:261-262.
- PENDING → ACCEPTED (chủ nhà; yêu cầu `moveInDate ≥ hôm nay`, chưa quá `respondBy` "Đã hết hạn phản hồi yêu cầu thuê.", listing còn PUBLISHED; đặt `holdExpiresAt = now + hold`; tạo giữ chỗ xe, listing → RESERVED, tạo INITIAL payment AWAITING_TRANSFER; tự REJECT các PENDING còn lại với lý do "Chủ nhà đã chấp thuận yêu cầu thuê khác cho tin đăng này.") · RRS:272-366.
- PENDING → REJECTED (chủ nhà; lý do mặc định "Chủ nhà từ chối yêu cầu thuê"; 409 nếu thanh toán đã CONFIRMED) · RRS:369-406.
- PENDING/ACCEPTED → CANCELLED_BY_RENTER/OWNER (`/cancel`) · ROS:347-385.
- PENDING → EXPIRED (cron khi quá `respondBy`), ACCEPTED → EXPIRED (cron khi hết `holdExpiresAt` và không được bảo vệ) · RRS:565-620.
- ACCEPTED → COMPLETED, CANCELLED_BY_SYSTEM: bởi (B)/(C).

---

## 4. Logic thuần cần port nguyên văn (Pha 1)

| Hàm / hằng | File | Ghi chú |
|---|---|---|
| `presentRentalRequest`, `primaryCardAction`, `transferWindowClosed`, `isClosedRequest`, `preTenancySteps`, `isClosedOnboardingStage`, kiểu `RequestPresentation`/`CardActionKind`/`StepState` | `lib/rental-request-presentation.ts` | thứ tự ưu tiên 1..9 ở comment đầu file; có test `tests/rental-request-presentation.test.cjs` |
| `canCancelRentalRequest(request, contract, livePaymentStatus, role)` | `lib/rental-request-actions.ts` | test `tests/rental-request-actions.test.cjs` |
| `requestStatus`, `contractStatus`, `paymentStatus`, `toneClasses`→(mobile: ánh xạ tone→token), `DETAIL_TABS`, `describeNextAction`, `tabForNextAction`, bảng `COPY`/`TAB_OF`, kiểu `Tone/Role/Labeled/DetailTab/NextActionView` | `lib/rental-labels.ts` | |
| `normalizeOccupantLimit`, `resolveOccupantLimit`, `clampOccupants` | `lib/rental-occupant-limit.ts` | test `tests/rental-occupant-limit.test.cjs` |
| `formatVND`, `clampValue`, `hasVehicleParkingAllowed`, `hasPersonBasedCharges`, `partitionPredictableCharges`, `partitionExcludedCharges`, `formatExcludedChargeValue` | `components/rental-request/rental-request.helper.ts` | |
| `parseCostBreakdownSnapshot`, `parseExcludedChargesSnapshot`, `formatOccupantCount/MotorbikeCount/CarCount`, `calculateEstimatedEndDate` | `components/rental-request/rental-request-snapshot.helper.ts` | |
| `canOfferContractFallback`, `createRentalContractFallback` (transport + AbortSignal) | `lib/rental-contract-fallback.ts` | test `tests/rental-contract-fallback.test.cjs` |
| `generateContractPreview`, `isUncertainPreviewError` | `lib/contract-preview.ts` | dùng chung với (C) |
| `loadPage` (gộp 3 trạng thái huỷ) + ticketed load logic | `useRentalRequestList.ts:16-27,43-65` | tách ra hàm thuần để test |
| Logic debounce/in-flight/queued/dirty của `useRentalRequestSync` | `useRentalRequestSync.ts:26-90` | thay `document.visibilityState` bằng `AppState` |
| Phân tích deep link: UUID regex, kiểm tra phía | `useRentalRequestDeepLink.ts:10,60-82` | |
| `quickLeaseOptions`, `formatLeaseLabel`, `formatDetailedDuration`, `depositInfo` (A-147), `estimateKey`, clamp sau estimate (A-149), thứ tự validate A-162 | `RentalRequestModal.tsx:139-173,208-276,279-281,305-339,385-451` | tách thành `rentalRequestForm.ts` |
| `getGateLock`, `missingLabels`, `normalizeOnboardingStatus`, `isProfileIncomplete`, `profileGateHref`; `hasPermission`, `isPermissionDenied`; `requireKyc/isKycSatisfied` | `lib/profile-gate.ts`, `lib/permissions.ts`, `lib/kyc-gate.ts` | thường thuộc Pha 1 chung |
| `getApiErrorMessage` (ưu tiên `errors[]` → `message` → `detail` → `Error.message` → mặc định) | `utils/apiError.ts` | AI service trả `detail` |
| `remaining(dueAt, now)` của NextActionCard ("Còn {d} ngày {h} giờ" / "{h} giờ {m} phút" / "{m} phút", "Đã quá hạn …") | `components/rental/NextActionCard.tsx:17-27` | |
| `versionLabel` (PolicyDialog) | `components/common/PolicyDialog.tsx:8-12` | mobile `PolicyDialog` đã có, kiểm tra |
| Text hằng: `AcceptSummary` copy, chuỗi toast ở mục 2 | `RentalRequestDialogs.tsx` | |

---

## 5. Lệch web ↔ backend

WA-1 | Web gửi `negotiatedDepositAmount` ở `POST /rental-requests` nhưng `CreateRentalRequest` **không có trường này** (record bỏ qua). BE dùng `depositAmount` làm số đề xuất (RRS:222 → RCC:515-525, chỉ có hiệu lực khi listing cọc NEGOTIABLE; listing khác bỏ qua `depositAmount`). Web gửi cả hai — vô hại. | RM:465-466 vs `CreateRentalRequest.java:40`
WA-2 | `minimumLeaseMonths` chỉ kiểm ở client (RM:412). BE chỉ kiểm `leaseMonths` 1..240 khi tạo (estimate chỉ ≥1). Người dùng gõ >240 hoặc dùng +1/+1 năm vượt 240 → estimate vẫn OK, submit bị BE chặn bằng thông báo tiếng Anh "leaseMonths cannot exceed 240". | RM:664-733 vs `CreateRentalRequest.java:14-17`
WA-3 | Giới hạn số người client mặc định `20` khi listing không có giới hạn (OL:13), BE cho tới 100 (DTO) và tự chặn theo `occupantLimit` của listing (RCC:70-77). Listing không giới hạn → không thể nhập >20 dù BE cho phép. | OL:13 vs `CreateRentalRequest.java:19-21`
WA-4 | Nhiều lỗi BE là chuỗi tiếng Anh từ `ListingErrorCode` hiện nguyên văn trong toast (vd "You already have an active rental request for this listing", "This listing is currently reserved by another renter", "Rental request not found", "Invalid rental request status for this action", "Rental request has already been paid and cannot be cancelled or rejected normally"). | LEC:46-67 + `getApiErrorMessage`
WA-5 | Web tạo yêu cầu dùng `err.response.data.message ‖ err.message` (không đọc `errors[]`) trong khi các nơi khác dùng `getApiErrorMessage`; lỗi validation Bean (`@Valid`) có thể hiện thông điệp khác nhau tuỳ nơi. | RM:477-486 vs DL:78
WA-6 | Web tự tính cọc hiển thị MONTH_COUNT bằng `listingPrice * months` (RM:231-239) nhưng BE tính `effectiveMonthlyRent * months` (RCC:512-520, giá đã tính theo số người). Chỉ lệch trước khi có estimate; sau estimate web dùng `estimate.depositAmount`. | RM:372
WA-7 | `useRentalHoldMinutes`/RM lấy giờ giữ chỗ từ `/policy`, nhưng tooltip chi tiết nhà dùng hằng cứng 60 phút (`RENTAL_HOLD_DURATION_LABEL`) "phải khớp BE: rental.hold-duration-minutes". Cấu hình BE khác 60 → lệch. | `config/rental-hold.config.ts:1-4`, RV:469,489
WA-8 | `/policy` còn trả `responseHours` (24h) nhưng web không dùng; hạn phản hồi chỉ lấy từ `respondBy`. | RRC:44-48
WA-9 | Ngày "quá khứ": web so với ngày **trình duyệt/thiết bị** (`startOfDay(new Date())`), BE so với ngày nghiệp vụ múi giờ `BillingTime.ZONE` (RRS:80-84). Thiết bị lệch múi/giờ có thể được client chấp nhận nhưng BE từ chối "Ngày bắt đầu thuê đã qua; vui lòng chọn ngày mới." (và ngược lại). Mobile nên tính "hôm nay" theo giờ VN. | RM:402, `Calendar disabled`
WA-10 | Lọc "Đã hủy" gộp ở client (BE chỉ lọc 1 status); với `page` lớn mỗi nguồn tải `page*8` dòng (tối đa 50/lượt → từ trang 7 trở đi, mỗi nguồn bị BE cắt ở 50, kết quả gộp sai). | LS:23-26 vs `RRC:82 @Max(50)`
WA-11 | `GET /by-listing/{id}` chỉ trả PENDING/ACCEPTED (RRS:550-560); web ẩn hẳn trạng thái COMPLETED/REJECTED trên CTA (nút "Yêu cầu thuê nhà" hiện lại). Web `getMyRequestByListing` còn nuốt cả 401/mạng → CTA có thể hiện sai khi lỗi mạng. | S1:61-72
WA-12 | `PUT /{id}/cancel` thực chất gọi `onboarding.cancelUnpaid` (ROS:347), **không** phải `RentalRequestService.cancelRentalRequest` (RRS:409, hiện không còn controller gọi). Chủ nhà cũng có thể gọi cancel (→ `CANCELLED_BY_OWNER`); web chỉ cho chủ nhà hủy ở trạng thái ACCEPTED (AC:11-15). Cancel không có `@PreAuthorize`/`@RequiresCompleteProfile` còn accept/reject có. | RRC:98-106
WA-13 | Web gate nút "Chấp thuận/Từ chối" bằng `RENTAL_REQUEST_MANAGE` + hồ sơ; BE còn bắt chủ nhà phải có tài khoản nhận tiền mặc định khi accept (`PAYEE_BANK_ACCOUNT_REQUIRED`, mã 7009) — web nhận diện bằng cả `code===7009` và so khớp chuỗi message ("ngân hàng", "tài khoản nhận tiền", "defaultIncoming"). Nhận diện bằng chuỗi dễ gãy khi BE đổi lời. | DL:72-77 vs `PaymentErrorCode.java:18`
WA-14 | `canCancelRentalRequest` là gợi ý UX; BE `cancelUnpaid` còn chặn khi đã bắt đầu ký, có chứng từ, đã nhận cọc, chờ hoàn tiền (thông điệp tiếng Việt ROS:352-369). Nút "Hủy yêu cầu" có thể hiện rồi nhận lỗi; web xử lý bằng toast lỗi + tải lại. | AC:8-16
WA-15 | `useRequestContracts` gọi N+1 `by-rental-request?includeDepositFallback=true` (8 yêu cầu/trang) mỗi 30 s cho yêu cầu đang xử lý — không có endpoint gộp. | UC:19-56
WA-16 | AI review: lỗi FastAPI dùng khoá `detail`, các service khác dùng `message`; chỉ `getApiErrorMessage` đọc `detail` (apiError mobile cần hỗ trợ). 404 khi listing không còn PENDING (ví dụ vừa duyệt xong) cũng hiện trong hộp vàng. | AIR:63-83, `apiError.ts:44-49`
WA-17 | Mọi loại `RENTAL_*` (26) đều trỏ về cùng trang yêu cầu thuê (không trỏ thẳng hợp đồng/khiếu nại); BE chỉ đặt `data.requestId` còn web đọc `metadata.requestId ?? metadata.rentalRequestId` (nhánh thứ hai thừa); loại `COMPLAINT_*` cùng category `RENTAL_REQUEST` (thuộc D). | NEV:913-915, NotificationTransport.tsx:117-120
WA-18 | `RentalRequestResponse` BE có `listingSnapshot` mà type web không khai báo (không dùng). Web `cancellationRefundPending` BE suy ra từ `status==ACCEPTED && cancellationRefundApprovedAt!=null` (RRS:~722). | TY:28-65

---

## 6. Mobile hiện có (sẽ thay thế)

| File | Hiện có | Khác web |
|---|---|---|
| `src/components/listing-detail/ContactCta.tsx:86-140` | Đã có CTA theo trạng thái (PENDING/ACCEPTED/RESERVED/không nhận) đúng chuỗi web; nút "Yêu cầu thuê nhà" chủ bài đăng → thông báo; **khách thường → `soon()` dialog "đang phát triển"** (không mở form, không gate quyền/KYC) | thiếu gate `RENTAL_REQUEST_CREATE`, `requireKyc`, mở form |
| `src/screens/ListingDetailScreen.tsx:78-96,331` | Gọi `getMyRentalRequestByListing`; `onOpenRequests` → `onOpenManagement('tenant-requests')`; không dùng `RentalRequestForm` | |
| `src/components/RentalRequestForm.tsx` (521 dòng) | Form đầy đủ nhưng **không được import ở đâu** (mồ côi): ước tính, chính sách giữ chỗ, ngày/xe | thiếu: thời hạn nhanh/stepper, giới hạn người, cọc thoả thuận, `RentalCostSummary` đầy đủ, validate theo thứ tự web, prefill đúng, gate |
| `src/services/bookingApi.ts:14-68` | `estimateRental` (không `negotiatedDepositAmount`, kiểu rút gọn), `getReservationPolicy`, `getMyRentalRequestByListing`, `createRentalRequest` | kiểu thiếu `occupantLimit`, `predictableCharges`, `excludedCharges`, `paymentPlan` đầy đủ |
| `src/services/managementApi.ts:59-100,207-250,360-452,640-660` | `RentalRequest` rút gọn; `rentalEntry` (action chỉ accept/reject/cancel kiểu menu), `getManagementPage` (size 12, **có lọc 1 trạng thái; không có "Đã hủy" gộp**), `getRentalRequestCounts` (duyệt toàn bộ trang để đếm), `runManagementAction` (`PUT /{id}/{action}`), `refreshRentalOnboarding`, cờ "đã xem" cục bộ (`markRentalNoticeSeen`) | điều kiện cancel khác web (không dùng `canCancelRentalRequest`), không có hộp xác nhận accept, không xung đột/AI, không deep link `requestId`, không poll/realtime |
| `src/screens/ManagementScreen.tsx` (1066 dòng) | Section `tenant-requests` "Yêu cầu đã gửi" / `landlord-requests` "Yêu cầu thuê"; tab lọc theo trạng thái có số đếm (chỉ hiện tab count>0), danh sách chung (`ManagementEntry` với `fields[[nhãn,giá trị]]`), badge chú ý, chi tiết dạng bảng trường | khác bố cục thẻ web (một nút chính), thiếu tab "Đang xử lý thuê"…, thiếu NextActionCard, tab chi tiết, AI review |
| `src/lib/notification.ts:353-385` | Ánh xạ `/dashboard/rental-requests[/my-requests]` → section quản lý, bỏ `requestId` | cần truyền `requestId` để mở modal |
| `src/lib/realtime/*` | có kênh thông báo; chưa thấy phát `rental-request-changed` (cần Pha 1 kiểm tra) | |

---

## 7. Ghi chú riêng cho thiết bị (đề xuất)

| # | Web | Không giống hệt trên điện thoại | Đề xuất mobile |
|---|---|---|---|
| D-1 | Tooltip `title`/hover (tooltip khoá `manageTitle`, "Thử tạo bản nháp…", "Xem bài đăng", `title` +1/-1) | Không có hover | Hiện lý do khoá bằng dòng chữ nhỏ dưới nút (disabled) hoặc `showDialog` khi chạm nút khoá (giống `guard()` toast); tooltip tạo hợp đồng → dòng phụ |
| D-2 | Modal `ModalShell` (bottom sheet ≥/≤sm), Esc/backdrop | Không có phím Esc; có nút Back Android | Bottom sheet/full-screen modal; Back Android = đóng (trừ khi `closeDisabled`); khoá đóng khi đang xử lý |
| D-3 | `<dialog>` AI review, `ActionDialog` (portal) xếp chồng trên modal | Xếp chồng modal trên RN dễ lỗi z-order/iOS | Dùng `useDialog` của app (AGENTS.md) cho confirm/askReason; AI review là màn/sheet riêng; accept từ AI: đóng sheet AI rồi mở confirm |
| D-4 | Popup lịch `Calendar` (react-day-picker) bên dưới nút | | Dùng `BookingDatePicker` sẵn có (`min = hôm nay giờ VN`) |
| D-5 | `<input type=number min max>` + nút -1/+1 | Bàn phím số, không `step` | `TextInput keyboardType="number-pad"` + stepper; clamp khi `onChangeText` và `onBlur` như web |
| D-6 | Link `tel:`/`mailto:` | | `Linking.openURL('tel:…')`/`mailto:` |
| D-7 | `<details>` EndOfPeriodCharges, `PolicyNotice` + `PolicyDialog` | | Accordion tự viết; `PolicyDialog` mobile sẵn có (kiểm tra có `PolicyNotice` + `version` + `PolicyConsent` đủ nút "Đã hiểu"/"Đồng ý & đóng") |
| D-8 | Toast sonner với nút hành động ("Cài đặt tài khoản", "Xác minh ngay") 7 s | Không có toast action chuẩn | `showDialog` có nút hành động hoặc snackbar tự dựng; điều hướng sang màn Tài khoản ngân hàng / KYC của app |
| D-9 | Điều hướng URL (`?requestId=`, `router.push`, `replaceState`) | Không có URL | Tham số route `requestId`; "xoá param" = `navigation.setParams({requestId: undefined})`; back trong lúc link đang mở = đóng modal |
| D-10 | `document.visibilityState`, `visibilitychange` (SY, UC poll) | | `AppState` (`active`); dừng poll khi nền; refresh khi quay lại foreground |
| D-11 | Poll 30 s + socket `notification:new` → `rental-request-changed` | | Tái dùng kênh realtime thông báo của app; thêm bus `rentalRequestChanged(requestId?)` ở Pha 1 |
| D-12 | `login(redirectPath)` | | Điều hướng sang đăng nhập, sau đó quay lại deep link (nếu app chưa có thì lưu pending target) |
| D-13 | Mở HĐ/tải PDF (C) | | → bàn giao C |
| D-14 | `useNowMs`, `toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})` | Hermes hỗ trợ `Intl` hạn chế tuỳ bản | Dùng `date-fns` + `date-fns-tz`/tính offset +07 thủ công; kiểm tra có `Intl.NumberFormat('vi-VN')` (`money()` mobile đã có) |
| D-15 | Bộ lọc chips cuộn ngang + phân trang số trang | | Chips cuộn ngang giữ nguyên; phân trang giữ nút Trước/Sau hoặc "tải thêm" — **giữ đúng 8 mục/trang và tổng như web** để khớp A-009; ưu tiên giữ nút trang vì A-009 gộp theo trang |
| D-16 | `Markdown` AI (`AiMarkdownMessage`) | | Thư viện markdown RN có sẵn trong app chat AI (`HomeAiPanel`)? kiểm tra; không có thì render text thường |
| D-17 | Đảm bảo `refresh` silent không reset form (SY) | | Khi AppState quay lại, chỉ refresh danh sách/detail, không remount form |
| D-18 | Ảnh `next/image` | | `expo-image`/`Image` với cùng quy tắc URL hợp lệ (http/https hoặc `/`); `/…` tương đối cần ghép base URL |
