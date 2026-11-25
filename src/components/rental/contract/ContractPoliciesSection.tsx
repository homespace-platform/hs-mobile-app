// Web: components/contract/detail/ContractPoliciesSection.tsx (with listing/ListingPoliciesCard in
// its `contract` form).
import { Text, TextInput, View } from 'react-native';

import FieldFrame, {
  FieldTextColor,
  inputBoxClass,
  inputTextClass,
} from '@/components/rental/shared/FieldFrame';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import VndMoneyInput from '@/components/rental/shared/VndMoneyInput';
import Dropdown from '@/components/Dropdown';
import {
  feeAfterDays,
  formatVnd,
  type DraftPolicyFields,
} from '@/lib/rental/ContractPoliciesSection';
import { isZeroDeposit } from '@/lib/rental/utils';
import type { TermRow } from '@/types/rental/contract-amendment.type';
import type { PolicySnapshot } from '@/types/rental/contract.type';
import type { ListingPolicyValue } from '@/types/rental/listing-policy.type';

import { Anchor } from './anchors';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { ContractEditField, FieldRow, NoticeText, Section } from './fields';
import InlineAmendmentFields, { BillingSystemRuleLabels } from './InlineAmendmentFields';

const FEE_OPTIONS = [
  { id: 'NONE', label: 'Không phạt' },
  { id: 'FIXED_ONCE', label: 'Phạt một lần sau hạn' },
  { id: 'FIXED_PER_DAY', label: 'Phạt cho mỗi ngày trễ' },
];

function SubTitle({ children }: { children: string }) {
  return (
    <Text className="text-xs font-bold uppercase tracking-wide text-foreground">{children}</Text>
  );
}

function ListingPoliciesCard({ rows }: { rows: ListingPolicyValue[] }) {
  return (
    <View className="gap-3 rounded-xl border border-border p-3">
      <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
        Chính sách & nội quy thuê
      </Text>
      <PolicyNotice
        tone="neutral"
        title="Chính sách & nội quy thuê"
        text="Chính sách lấy từ bài đăng đã duyệt. Sửa bài gốc, gửi admin duyệt rồi cập nhật vào bản nháp hoặc đề xuất phụ lục."
      />
      {rows.map((row) => (
        <View key={row.code} className="border-b border-border pb-2">
          <Text className="text-xs text-muted-foreground">{row.label}</Text>
          <Text selectable className="mt-1 text-sm font-medium leading-5 text-foreground">
            {row.displayValue}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function ContractPoliciesSection({
  policies: originalPolicies,
  financial: originalFinancial,
  specialTerms: originalSpecialTerms,
  isDraft,
  draft,
  draftSystemTerms,
  originalAdditionalTerms,
  draftDisabled,
  feeError,
  onDraftChange,
}: {
  policies?: PolicySnapshot | TermRow | null;
  financial?: TermRow;
  specialTerms?: string | null;
  isDraft: boolean;
  draft?: DraftPolicyFields;
  draftSystemTerms?: string | null;
  originalAdditionalTerms?: string | null;
  draftDisabled?: boolean;
  feeError?: string;
  onDraftChange?: (changes: Partial<DraftPolicyFields>) => void;
}) {
  const w = useAmendmentWorkspace();
  const policies =
    (w?.editing ? w.listingSync?.terms.policies : undefined) ??
    w?.data?.currentTerms.policies ??
    originalPolicies;
  const financial =
    (w?.editing ? w.listingSync?.terms.financial : undefined) ??
    w?.data?.currentTerms.financial ??
    originalFinancial;
  const noDeposit = isZeroDeposit(financial?.depositAmountValue ?? financial?.depositAmountNumber);
  const specialTerms = w?.data?.currentTerms.specialTerms ?? originalSpecialTerms;
  const p = (policies || {}) as TermRow;
  const policyRows = Array.isArray(p.listingPolicies)
    ? (p.listingPolicies as ListingPolicyValue[]).filter(
        (row) => !noDeposit || row.code !== 'depositRefundDays'
      )
    : [];
  const noticeDays = p.noticeDaysBeforeTermination;
  const lateMode = String(p.latePaymentFeeMode || 'NONE');
  const savedFeeAmount = Number(p.latePaymentFeeAmount || 0);
  const savedGraceDays = Number(p.latePaymentFeeGraceDays || 0);
  const savedFeeCap = Number(p.latePaymentFeeCap || 0);
  const feeMode = draft?.feeMode ?? 'NONE';
  const feeAmount = draft?.feeAmount ?? '';
  const draftFeeAmount = Number(feeAmount);
  const depositRefundDays = p.depositRefundDays;
  const policyText = (flag: string, key: string, yes: string, no: string) =>
    typeof p[flag] === 'boolean'
      ? p[flag]
        ? yes
        : no
      : typeof p[key] === 'string' && String(p[key]).trim()
        ? String(p[key])
        : 'Chưa có thỏa thuận trong bản chụp hợp đồng';
  const systemTerms = w?.data?.currentTerms.systemTerms || draftSystemTerms;

  if (w?.editing)
    return (
      <Anchor id="amendment-rules">
        <Section title="Chính sách vận hành và điều khoản thỏa thuận bổ sung">
          <InlineAmendmentFields group="rules" />
        </Section>
      </Anchor>
    );

  const otherTerms = () => {
    const text =
      (draft ? null : specialTerms) ||
      (draft
        ? 'Điều khoản của bản nháp này được giữ nguyên ở phần chỉ đọc.'
        : 'Không có điều khoản bổ sung.');
    return text.length > 280 ? (
      <PolicyNotice
        tone="neutral"
        title="Điều khoản thỏa thuận khác"
        summary="Hai bên có thỏa thuận bổ sung riêng. Mở để xem đầy đủ."
        actionLabel="Xem điều khoản">
        <NoticeText>{text}</NoticeText>
      </PolicyNotice>
    ) : (
      <Text selectable className="text-sm leading-6 text-muted-foreground">
        {text}
      </Text>
    );
  };

  return (
    <Anchor id={draft ? 'contract-policies' : 'amendment-rules'}>
      <Section
        icon="document-text-outline"
        title="Chính sách vận hành và điều khoản thỏa thuận bổ sung">
        {policyRows.length > 0 ? (
          <ListingPoliciesCard rows={policyRows} />
        ) : (
          <View>
            <FieldRow
              label="Thời hạn báo trước khi chấm dứt"
              value={noticeDays != null ? `Tối thiểu ${noticeDays} ngày` : 'Chưa có thỏa thuận'}
            />
            {!noDeposit ? (
              <FieldRow
                label="Thời hạn hoàn trả tiền đặt cọc"
                value={
                  depositRefundDays != null
                    ? `Trong vòng ${depositRefundDays} ngày sau khi bàn giao và quyết toán`
                    : 'Chưa có thỏa thuận'
                }
              />
            ) : null}
            <FieldRow
              label="Cho thuê lại (Subletting)"
              value={policyText(
                'sublettingAllowed',
                'subleasePolicy',
                'Được phép theo thỏa thuận',
                'Không được phép'
              )}
            />
            <FieldRow
              label="Quy định nuôi thú cưng"
              value={policyText(
                'petsAllowed',
                'petPolicy',
                'Được phép, tuân thủ nội quy',
                'Không được phép'
              )}
            />
            <FieldRow
              label="Quy định hút thuốc trong nhà"
              value={policyText(
                'smokingAllowed',
                'smokingPolicy',
                'Chỉ tại khu vực cho phép',
                'Không được phép'
              )}
            />
          </View>
        )}

        <View className="gap-3 rounded-xl border border-border bg-background p-3">
          <SubTitle>Phí phạt đóng trễ</SubTitle>
          {draft ? (
            <>
              <ContractEditField group="policies" changed={feeMode !== lateMode}>
                <FieldFrame label="Cách tính phí">
                  {draftDisabled ? (
                    <View className={`${inputBoxClass(false, true)} py-3`}>
                      <Text className="text-base text-muted-foreground">
                        {FEE_OPTIONS.find((option) => option.id === feeMode)?.label}
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row">
                      <Dropdown
                        accessibilityLabel="Cách tính phí"
                        options={FEE_OPTIONS}
                        value={feeMode}
                        onChange={(id) =>
                          onDraftChange?.({ feeMode: id as DraftPolicyFields['feeMode'] })
                        }
                      />
                    </View>
                  )}
                </FieldFrame>
              </ContractEditField>
              {feeMode !== 'NONE' ? (
                <ContractEditField group="policies" changed={Number(feeAmount) !== savedFeeAmount}>
                  <VndMoneyInput
                    label="Mức phạt (đ)"
                    min={1}
                    value={feeAmount}
                    disabled={draftDisabled}
                    onValueChange={(amount) => onDraftChange?.({ feeAmount: amount })}
                    placeholder={
                      feeMode === 'FIXED_PER_DAY' ? 'Ví dụ: 100.000 đ/ngày' : 'Ví dụ: 100.000 đ/lần'
                    }
                  />
                </ContractEditField>
              ) : null}
              <Text className="text-xs leading-5 text-muted-foreground">
                {feeMode === 'FIXED_PER_DAY' && draftFeeAmount > 0
                  ? `Trễ 1 ngày: ${formatVnd(draftFeeAmount)} · Tối đa 5 ngày: ${formatVnd(draftFeeAmount * 5)} trên mỗi hóa đơn.`
                  : feeMode === 'FIXED_ONCE' && draftFeeAmount > 0
                    ? `Trễ 1 hay nhiều ngày: chỉ phạt một lần ${formatVnd(draftFeeAmount)}.`
                    : feeMode !== 'NONE'
                      ? 'Nhập mức tiền để xem ví dụ tính phí.'
                      : 'Không cộng phí chậm thanh toán vào hóa đơn.'}
              </Text>
              {feeError ? (
                <Text accessibilityRole="alert" className="text-sm text-danger">
                  {feeError}
                </Text>
              ) : null}
              <BillingSystemRuleLabels
                policies={{ ...p, latePaymentFeeMode: feeMode, latePaymentFeeAmount: feeAmount }}
              />
            </>
          ) : lateMode === 'NONE' ? (
            <Text className="text-sm text-primary">
              Không áp dụng phí phạt đóng trễ cho hợp đồng này.
            </Text>
          ) : (
            <>
              <View className="flex-row flex-wrap items-baseline gap-x-2 gap-y-1">
                <Text className="text-lg font-bold text-primary">{formatVnd(savedFeeAmount)}</Text>
                <Text className="text-sm font-semibold text-primary">
                  {lateMode === 'FIXED_PER_DAY' ? '/ mỗi ngày trễ' : '/ một lần duy nhất'}
                </Text>
              </View>
              <View className="self-start rounded-full bg-success-soft px-2.5 py-1">
                <Text className="text-xs font-semibold text-success">
                  {isDraft ? 'Đã lưu trong bản nháp' : 'Điều khoản đã chốt'}
                </Text>
              </View>
              <Text className="text-sm leading-5 text-foreground">
                Trễ 1 ngày: {formatVnd(feeAfterDays(p, 1))} · Trễ 5 ngày:{' '}
                {formatVnd(feeAfterDays(p, 5))}.
              </Text>
              <PolicyNotice
                tone="neutral"
                title="Thời điểm bắt đầu tính phạt"
                summary="Sau 5 ngày quá hạn, hệ thống nhắc chủ nhà quyết định hướng xử lý.">
                <NoticeText>
                  Bắt đầu tính{' '}
                  {savedGraceDays > 0
                    ? `sau ${savedGraceDays} ngày ân hạn kể từ hạn thanh toán ghi trên hóa đơn`
                    : 'từ ngày đầu tiên sau hạn thanh toán ghi trên hóa đơn'}
                  . Sau 5 ngày quá hạn, hệ thống nhắc chủ nhà quyết định hướng xử lý.
                </NoticeText>
              </PolicyNotice>
              {savedFeeCap > 0 ? (
                <Text className="text-sm text-muted-foreground">
                  Tổng phí phạt tối đa áp dụng:{' '}
                  {formatVnd(
                    lateMode === 'FIXED_PER_DAY'
                      ? Math.min(savedFeeCap, savedFeeAmount * 5)
                      : savedFeeCap
                  )}
                  .
                </Text>
              ) : null}
              {lateMode === 'FIXED_PER_DAY' ? (
                <PolicyNotice
                  tone="neutral"
                  title="Giới hạn tính phí phạt"
                  summary="Hệ thống chỉ tính phạt tối đa 5 ngày trên mỗi hóa đơn.">
                  <NoticeText>
                    Hệ thống chỉ tính phạt tối đa 5 ngày trên mỗi hóa đơn; tổng tối đa bằng mức phí
                    mỗi ngày nhân 5 và giữ trần tiền thấp hơn trong bản ký cũ nếu có. Không tự sửa
                    phí đã chốt hoặc chứng từ lịch sử.
                  </NoticeText>
                </PolicyNotice>
              ) : null}
            </>
          )}
        </View>

        <PolicyNotice
          tone="warning"
          title="Xử lý khi quá hạn 5 ngày"
          actionLabel="Xem quy tắc"
          text={
            p.overdueUnilateralTermination24h
              ? 'Sau đủ 5 ngày quá hạn, chủ nhà có thể chọn phương án xử lý. Nếu có quyết định đơn phương chấm dứt, người thuê có 24 giờ để khiếu nại theo điều khoản hệ thống.'
              : p.overdueLandlordTerminationAfterFiveDays
                ? 'Sau hơn 5 ngày quá hạn, chủ nhà có thể cho cộng nợ kỳ sau hoặc đề nghị chấm dứt. Nếu người thuê từ chối, chủ nhà có thể chọn chấm dứt theo điều khoản đã ký sau khi thông báo và thực tế nhận lại phòng; khi đó hệ thống ghi cọc cho chủ nhà và mở lại tin đăng. Hệ thống không tự chấm dứt.'
                : 'Hợp đồng này không có điều khoản chấm dứt sau 5 ngày quá hạn theo cấu trúc hiện hành; hệ thống không tự chấm dứt hoặc thu cọc.'
          }
        />

        {systemTerms ? (
          <PolicyNotice
            tone="neutral"
            title="Điều khoản hệ thống · Chỉ đọc"
            summary="Điều khoản hệ thống do HomeSpace áp dụng cho mọi hợp đồng. Chỉ đọc."
            actionLabel="Xem điều khoản hệ thống">
            <NoticeText>{systemTerms}</NoticeText>
          </PolicyNotice>
        ) : null}
        <View className="gap-2 rounded-xl border border-border bg-background p-3">
          <SubTitle>Điều khoản thỏa thuận khác</SubTitle>
          {draft?.additionalTerms !== undefined ? (
            <ContractEditField
              group="specialTerms"
              changed={
                draft.additionalTerms.trim() !== String(originalAdditionalTerms ?? '').trim()
              }>
              <View className={inputBoxClass(false, draftDisabled)}>
                <FieldTextColor.Consumer>
                  {(textColor) => (
                    <TextInput
                      accessibilityLabel="Điều khoản thỏa thuận khác"
                      multiline
                      numberOfLines={4}
                      maxLength={8000}
                      value={draft.additionalTerms}
                      editable={!draftDisabled}
                      onChangeText={(additionalTerms) => onDraftChange?.({ additionalTerms })}
                      placeholder="Nhập thỏa thuận bổ sung giữa hai bên nếu có…"
                      textAlignVertical="top"
                      className={`min-h-24 ${inputTextClass(draftDisabled, textColor)}`}
                    />
                  )}
                </FieldTextColor.Consumer>
              </View>
            </ContractEditField>
          ) : (
            otherTerms()
          )}
        </View>
      </Section>
    </Anchor>
  );
}
