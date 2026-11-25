# Pha 1b — logic thuần (`src/lib/rental/`)

## Tiến độ

| Nhóm                                                             | Trạng thái                                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. `lib/*` web (chép nguyên văn)                                 | ✅                                                                                     |
| 2. contract-* / document / preview                               | ✅                                                                                     |
| 3. Helper trong component (rental-request, contract/page, utils) | ✅                                                                                     |
| 4. Logic tách từ `.tsx` (yêu cầu thuê, hợp đồng, phụ lục)        | ✅                                                                                     |
| 5. Logic tách từ `.tsx` (cọc, hoá đơn)                           | ✅                                                                                     |
| 6. Test `tests/rental-logic.test.cjs`                            | ✅ 28/28                                                                               |
| 7. tsc / eslint / prettier                                       | ✅ tsc toàn repo sạch; eslint 0 lỗi (3 warning từ code chép nguyên văn); prettier sạch |

## Cách UI dùng

Port component web: đổi import `@/lib/X`, `.../X.helper`, `contract/page/X` thành `@/lib/rental/X`; logic nằm trong `Component.tsx` thành `@/lib/rental/Component` (hook: `@/lib/rental/useX`). Kiểu: `@/types/rental/*.type`; service: `@/services/rental/*.service`.

Đã có sẵn ở nơi khác, **không** chép lại:

| Web                                                                                                          | Mobile dùng                                             |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `lib/profile-gate.ts`, `lib/permissions.ts`, `getGateLock`                                                   | `@/lib/profile-gate`, `@/lib/permissions`               |
| `VIETNAMESE_PHONE_REGEX`                                                                                     | `@/lib/profile-form`                                    |
| `PolicyDialog.versionLabel`                                                                                  | `components/PolicyDialog.tsx` (giống hệt)               |
| `complaintEventContext`, `complaintCategories/Stages/Actions`, `workflowTitles/Statuses/Actions/Obligations` | `@/types/rental/complaint.type`, `rental-workflow.type` |
| `normalizePaymentRequest`, `resolveContentType`/upload, `getEffectiveDocument`                               | service của 1a                                          |

## Khác web (bắt buộc do thiết bị)

- `contract-routes` trả object route (`{screen, side, contractId, tab?, section?, invoice?}`) thay cho path. `paymentQuery` trả object; `contractLandingTarget(side, contract, query, hash)` nhận object thay cho chuỗi `?…`. `primaryAction` (ContractListView) và `paymentLink` (`payment-link.ts`) trả route.
- `toneClasses`, `fieldStateClass`, `className` của hoá đơn và tình trạng bàn giao: đổi sang token màu mobile.
- Định dạng tiền/ngày dùng `format.ts` (không dựa vào Intl của Hermes).
- `throwIfAborted(signal)` (trong `contract-preview`) thay `signal.throwIfAborted()`/`signal.reason`: polyfill AbortSignal của React Native không có.
- `Object.hasOwn` → `hasOwnProperty.call`.
- `hashPdfForProof`: `expo-crypto digest` thay `crypto.subtle` (giữ 3 thông báo lỗi nguyên văn).
- Hook web → hàm điều khiển, UI tự viết hook: `createRentalRequestSync`, `createChangeSync` (`isVisible` = AppState + focus; gọi `onVisible()` khi quay lại), `createListTickets` + `loadPage(api, …)`, `isRequestOnSide`/`deepLinkLoadError`, `resolveDetailTab`.
- `amendmentPayload`: kiểm tra DOM `input:invalid` → tham số `hasInvalidInput`.
- `dashboard-role`: chỉ kiểu + nhãn (bỏ localStorage và suy vai từ URL).

## Chưa port (có chủ đích)

- `invoice-list`: chỉ `findInvoicePayment`, `invoiceNeedsAction`; phần còn lại là code chết (WD-9).
- `invoice-period-filter`, `contract-feature-flags`, `listing-detail-access` (mobile mở tin theo id), `formatCountdown` (MOBILE_QR đã bỏ, Q2).
- `usePolledRead`, `useNowMs`, `useOnboardingNextAction`: hook React thuần UI/dữ liệu, agent UI viết.
- Chữ trong JSX (AcceptSummary, `WorkflowSummary`, `RentCalculation`, `FieldRow`) và toast nằm trong handler: port cùng component.
- `lib/kyc-gate`: dùng toast/router; mobile đã có luồng KYC riêng.
- Luật nút của `OnboardingPaymentCard` (`canPay`/`canReceive`/`canReview`, :31-43) không nằm trong danh sách "logic thuần": agent UI port cùng component.

## Test so với web

`node --test tests/rental-logic.test.cjs`: nạp module web và mobile cùng lúc; logic nằm trong `.tsx` được cắt từ source web theo mốc chữ rồi chạy (web đổi đoạn đó thì test đỏ). Chỉ đối chiếu bằng kỳ vọng viết tay (kèm file:dòng): `estimateKey/estimateRequest/createRentalRequestBody`, `proofFileError`, `depositForfeit/unreconciled/visiblePayments`, `DepositLedgerSummary`, `InvoiceLineCalculation`, `previousEnd`, các pipe refresh, ticket tải danh sách, `isRequestOnSide`, `isSignatureLocked/isReviewLocked/isPreActive`.

## Chưa kiểm trên máy thật (Hermes)

- `Date.parse` với chuỗi ISO có phần giây dài hơn 3 chữ số (Instant của Java).
- Regex lookbehind trong `splitSentences`.
- `hashPdfForProof` với `expo-crypto` native (test dùng stub); `structuredClone` do Expo cài (đã thấy trong `expo/src/winter`).
- Mã lỗi mạng axios trên React Native (`isUncertainPreviewError`: `ERR_NETWORK`, `ECONNABORTED`, `ETIMEDOUT`).
