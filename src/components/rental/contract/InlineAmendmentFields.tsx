// Web: components/contract/detail/InlineAmendmentFields.tsx.
// ContractTermFields and BillingSystemRuleLabels serve both the draft (ContractDraftEditor context)
// and an addendum being composed (useAmendmentWorkspace().editing), as on the web.
// The default export is the rent/residents/rules inputs and the C-182 edit tables of an addendum.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { randomUUID } from 'expo-crypto';

import BankPicker from '@/components/bank/BankPicker';
import Icon from '@/components/Icon';
import { ChoiceButton } from '@/components/rental/onboarding/common';
import ActionButton from '@/components/rental/shared/ActionButton';
import DateField from '@/components/rental/shared/DateField';
import FieldFrame, {
  FieldTextColor,
  inputBoxClass,
  inputTextClass,
} from '@/components/rental/shared/FieldFrame';
import InfoRow from '@/components/rental/shared/InfoRow';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import VndMoneyInput from '@/components/rental/shared/VndMoneyInput';
import {
  amendmentDateInput,
  amendmentNumbers,
  squareMetresText,
} from '@/lib/rental/contract-amendment-input';
import { useContractDraftEditor } from '@/lib/rental/ContractDraftEditor';
import { formatVnd } from '@/lib/rental/ContractPoliciesSection';
import { bankAccountService } from '@/services/rental/bank-account.service';
import type { TermRow } from '@/types/rental/contract-amendment.type';
import type { Bank } from '@/types/rental/bank-account.type';

import {
  amendmentNumberError,
  canonicalFeeMode,
  feeLabels,
  feeModePatch,
  newTableRow,
  resetSection,
  tableCellRows,
  tableCellText,
  tableColumns,
  termFieldPatch,
  type TableGroup,
} from './amendmentLogic';
import { useAmendmentWorkspace } from './ContractAmendmentWorkspace';
import { ContractEditField, FieldRow, NoticeText } from './fields';

export type TermField = readonly [key: string, label: string, locked?: boolean, hint?: string];
export type AmendmentTableGroup =
  'rent' | 'residents' | 'charges' | 'equipments' | 'amenities' | 'rules';

/** Errors of the draft inputs after a refused "Lưu" (the web's reportValidity bubbles). */
export const DraftFieldErrors = createContext<Record<string, string>>({});

const text = (v: unknown) => String(v ?? '');

function Term({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View>
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="mt-0.5 text-sm font-semibold leading-5 text-foreground">{value}</Text>
      {hint ? <Text className="mt-0.5 text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

/** Plain labels, not disabled inputs. Only the backend supplies the workflow constants. */
export function BillingSystemRuleLabels({
  policies,
  rules,
  deadlineOnly = false,
}: {
  policies?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  deadlineOnly?: boolean;
}) {
  const w = useAmendmentWorkspace();
  const p = policies ?? w?.values.policies ?? {};
  const r = (rules ?? w?.data?.currentTerms.billingRules ?? p.billingRules) as
    Record<string, unknown> | undefined;
  if (!r)
    return (
      <PolicyNotice
        tone="neutral"
        title="Mốc thanh toán và giới hạn phạt"
        summary="Mốc thanh toán và giới hạn phạt do hệ thống quản lý.">
        <NoticeText>
          Mốc thanh toán và giới hạn phạt do hệ thống quản lý, không phải nội dung chủ nhà được
          chỉnh. Lưu/tải lại bản nháp để nhận mô tả quy trình hiện hành.
        </NoticeText>
      </PolicyNotice>
    );
  const mode = canonicalFeeMode(p.latePaymentFeeMode);
  const amount = Number(p.latePaymentFeeAmount ?? 0);
  const days = Math.min(5, Number(r.maximumPenaltyDays ?? 5));
  const valid =
    mode === 'NONE' ||
    (['FIXED_ONCE', 'FIXED_PER_DAY'].includes(mode) &&
      Number.isSafeInteger(amount) &&
      amount > 0 &&
      amount <= 1_000_000_000);
  const maximum = mode === 'NONE' ? 0 : mode === 'FIXED_PER_DAY' ? amount * days : amount;
  const original = w?.data?.currentTerms.policies;
  const changed =
    original &&
    (canonicalFeeMode(original.latePaymentFeeMode) !== mode ||
      Number(original.latePaymentFeeAmount ?? 0) !== amount);
  const legacy =
    !changed &&
    (Number(p.latePaymentFeeGraceDays ?? 0) > Number(r.lateFeeGraceDays) ||
      (Number(p.latePaymentFeeCap ?? 0) > 0 && Number(p.latePaymentFeeCap) < maximum));
  return (
    <View
      accessibilityLabel={
        deadlineOnly ? 'Hạn thanh toán do hệ thống quản lý' : 'Quy tắc phạt do hệ thống quản lý'
      }
      className="gap-3 rounded-xl border border-border bg-muted p-3">
      <Text className="text-sm font-semibold text-foreground">
        Quy tắc hệ thống · Không chỉnh sửa
      </Text>
      {deadlineOnly ? (
        <>
          <Term
            label="Thời gian thanh toán"
            value={`${String(r.paymentWindowDays)} ngày lịch, tính cả ngày chốt kỳ`}
          />
          <PolicyNotice
            tone="neutral"
            title="Cách tính hạn thanh toán"
            summary="Hạn thanh toán tính từ ngày chốt kỳ; hạn cụ thể hiển thị trên hóa đơn.">
            <NoticeText>
              Hệ thống lấy ngày chốt kỳ cộng {String(r.paymentDueOffsetDays)} ngày để tính hạn
              23:59. Đây không phải ngày kết thúc toàn bộ hợp đồng. Hạn cụ thể hiển thị trên hóa
              đơn.
            </NoticeText>
          </PolicyNotice>
        </>
      ) : (
        <>
          <PolicyNotice
            tone="neutral"
            title="Phí phạt chậm thanh toán"
            summary="Chủ nhà chỉ chọn cách tính và mức phí.">
            <NoticeText>
              Chủ nhà chỉ chọn cách tính và mức phí. Các mốc dưới đây được đưa tự động vào Word,
              không phải ô cần nhập hay đề xuất thay đổi.
            </NoticeText>
          </PolicyNotice>
          <Term
            label="Bắt đầu tính phạt"
            value={
              legacy && Number(p.latePaymentFeeGraceDays) > 0
                ? `Theo bản ký cũ: sau ${Number(p.latePaymentFeeGraceDays)} ngày ân hạn`
                : 'Từ ngày đầu tiên sau hạn thanh toán; không cộng thêm ngày ân hạn'
            }
          />
          <Term
            label="Giới hạn tính phạt mỗi hóa đơn"
            value={
              mode === 'NONE'
                ? 'Không áp dụng phí phạt'
                : mode === 'FIXED_ONCE'
                  ? 'Chỉ thu một lần, không nhân số ngày'
                  : `Tối đa ${String(days)} ngày tính phạt`
            }
          />
          <Term
            label="Tổng phí phạt tối đa · Hệ thống tính"
            value={
              valid
                ? formatVnd(
                    legacy ? Math.min(maximum, Number(p.latePaymentFeeCap) || maximum) : maximum
                  )
                : 'Nhập cách tính và mức phí hợp lệ'
            }
            hint={
              valid && mode === 'FIXED_PER_DAY'
                ? `${formatVnd(amount)}/ngày × ${days} ngày = ${formatVnd(maximum)}`
                : undefined
            }
          />
          <Term
            label="Mốc xử lý quá hạn"
            value={`Sau hết ${String(r.overdueActionDays)} ngày quá hạn: mở các phương án xử lý. Sau hết ${String(r.autoRolloverDays ?? 10)} ngày: chốt công nợ nếu chưa có phương án và còn kỳ sau. Quyết định đơn phương có cửa sổ khiếu nại ${String(r.terminationReviewHours ?? 24)} giờ.`}
          />
          {legacy ? (
            <PolicyNotice
              tone="warning"
              title="Điều khoản theo bản ký cũ"
              summary="Bản ký cũ giữ đúng điều khoản cũ nếu chưa đổi phí.">
              <NoticeText>
                Bản ký cũ có {Number(p.latePaymentFeeGraceDays ?? 0)} ngày ân hạn hoặc trần tiền
                thấp hơn; tiếp tục giữ đúng điều khoản cũ nếu chưa đổi phí. Khi đề nghị đổi cách
                tính/mức phí, hệ thống tính lại giới hạn theo quy tắc trên cho phụ lục mới.
              </NoticeText>
            </PolicyNotice>
          ) : null}
          <PolicyNotice
            tone="neutral"
            title="Mức phí tối đa"
            summary="Đây là mức tối đa, không phải phí luôn phải trả.">
            <NoticeText>
              Đây là mức tối đa, không phải phí luôn phải trả. Phí thực tế tùy số ngày trễ và trạng
              thái thanh toán/đối soát/gia hạn.
            </NoticeText>
          </PolicyNotice>
        </>
      )}
    </View>
  );
}

/** Web hooks/useBanks.ts. */
function useBanks() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    bankAccountService
      .getBanks()
      .then((list) => active && setBanks(list))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setError(false);
    setAttempt((n) => n + 1);
  }, []);
  return { banks, loading: !error && banks.length === 0, error, retry };
}

/** The stored value is the bank's full name; a value outside the catalog stays as it is. */
function BankNameSelect({
  label,
  raw,
  disabled,
  onPick,
}: {
  label: string;
  raw: string;
  disabled: boolean;
  onPick: (name: string) => void;
}) {
  const { banks, loading, error, retry } = useBanks();
  const bank = banks.find((b) => b.name === raw || b.shortName === raw || b.code === raw);
  // Web option text: "{code} - {shortName} ({name})"; the picker draws the name on its second line.
  const options = banks.map((b) => ({ ...b, shortName: `${b.code} - ${b.shortName}` }));
  const current = {
    bin: '__CURRENT__',
    code: '',
    name: raw || 'Chọn ngân hàng',
    shortName: raw || 'Chọn ngân hàng',
    logo: null,
  };
  if (disabled) return <InfoRow label={label} value={raw || 'Chọn ngân hàng'} stacked />;
  return (
    <FieldFrame label={label}>
      {error ? <Text className="mb-1 text-sm text-foreground">{current.name}</Text> : null}
      <BankPicker
        banks={loading || error ? [] : bank ? options : [current, ...options]}
        value={bank?.bin ?? current.bin}
        onChange={(bin) => {
          if (bin === (bank?.bin ?? current.bin)) return;
          const chosen = banks.find((b) => b.bin === bin);
          if (chosen) onPick(chosen.name);
        }}
        loading={loading}
        error={error}
        onRetry={retry}
      />
    </FieldFrame>
  );
}

function TextField({
  label,
  ariaLabel,
  value,
  onChangeText,
  disabled,
  hint,
  error,
  maxLength,
  keyboardType,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled: boolean;
  hint?: string;
  error?: string;
  maxLength: number;
  keyboardType: KeyboardTypeOptions;
}) {
  const textColor = useContext(FieldTextColor);
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <View className={inputBoxClass(Boolean(error), disabled)}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          accessibilityLabel={ariaLabel}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : undefined}
          className={inputTextClass(disabled, textColor)}
        />
      </View>
    </FieldFrame>
  );
}

/** Its own component: the text colour comes from the ContractEditField around it. */
function SpecialTermsInput({
  value,
  onChangeText,
  disabled,
}: {
  value: string;
  onChangeText: (value: string) => void;
  disabled: boolean;
}) {
  const textColor = useContext(FieldTextColor);
  return (
    <FieldFrame label="Điều khoản thỏa thuận khác">
      <View className={inputBoxClass(false, disabled)}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          multiline
          maxLength={8000}
          textAlignVertical="top"
          accessibilityLabel="Điều khoản thỏa thuận khác"
          className={`min-h-36 ${inputTextClass(disabled, textColor)}`}
        />
      </View>
    </FieldFrame>
  );
}

export function ContractTermFields({
  group,
  fields,
}: {
  group: 'landlord' | 'tenant' | 'property' | 'lease' | 'financial' | 'policies';
  fields: readonly TermField[];
}) {
  const amendment = useAmendmentWorkspace();
  const draft = useContractDraftEditor();
  const errors = useContext(DraftFieldErrors);
  const w = draft ?? (amendment?.editing ? amendment : null);
  if (!w) return null;
  const values = w.values[group] ?? {};
  return (
    <View className="gap-3">
      {fields.map(([key, label, locked, hint]) => {
        const date = key.endsWith('DateText');
        const numeric = amendmentNumbers[key];
        const area = group === 'property' && key === 'areaText';
        const raw = text(values[key]);
        if (draft && locked) return <FieldRow key={key} label={label} value={values[key]} />;
        const ariaLabel =
          draft && (group === 'landlord' || group === 'tenant')
            ? label + (group === 'landlord' ? ' Bên A' : ' Bên B')
            : label;
        const disabled = Boolean(w.busy || locked);
        if (key === 'bankName') {
          return (
            <ContractEditField key={key} group={group} field={key}>
              <BankNameSelect
                label={label}
                raw={raw}
                disabled={disabled}
                onPick={(name) => w.patch(group, { ...values, bankName: name })}
              />
            </ContractEditField>
          );
        }
        const value = date
          ? amendmentDateInput(raw)
          : area
            ? raw.replace(/\s*(m²|m2|mét vuông)\s*$/i, '')
            : key === 'unitNumber'
              ? raw || 'Toàn bộ căn'
              : key === 'latePaymentFeeMode'
                ? (feeLabels[raw] ?? raw)
                : squareMetresText(raw);
        const change = (typed: string) => {
          // The web's date input reports changes only; re-picking would recompute the lease end.
          if (date && typed === value) return;
          w.patch(group, termFieldPatch(group, values, key, typed));
        };
        const help =
          hint || locked
            ? (hint ?? 'Giữ nguyên dữ liệu đã xác nhận; không ghi đè lịch sử.')
            : undefined;
        return (
          <ContractEditField key={key} group={group} field={key} readonly={locked}>
            {date ? (
              <DateField
                label={label}
                ariaLabel={ariaLabel}
                value={value}
                onChange={change}
                disabled={disabled}
                hint={help}
              />
            ) : (
              <TextField
                label={label}
                ariaLabel={ariaLabel}
                value={value}
                onChangeText={change}
                disabled={disabled}
                hint={help}
                error={draft ? errors[`${group}.${key}`] : amendmentNumberError(key, value)}
                maxLength={
                  key === 'idNumber'
                    ? 12
                    : key === 'bankAccountNumber'
                      ? 34
                      : draft
                        ? key === 'phone'
                          ? 10
                          : key === 'email'
                            ? 100
                            : 1000
                        : 2000
                }
                keyboardType={
                  area
                    ? 'decimal-pad'
                    : numeric || ['idNumber', 'bankAccountNumber'].includes(key)
                      ? 'number-pad'
                      : draft && key === 'email'
                        ? 'email-address'
                        : draft && key === 'phone'
                          ? 'phone-pad'
                          : 'default'
                }
              />
            )}
          </ContractEditField>
        );
      })}
    </View>
  );
}

/** IAF:127-132, one card per row instead of the 680px table. */
function EditTable({
  group,
  rows,
  busy,
  patch,
}: {
  group: TableGroup;
  rows: TermRow[];
  busy: boolean;
  patch: (key: TableGroup, rows: TermRow[]) => void;
}) {
  const add = group === 'charges' ? 'phí' : group === 'equipments' ? 'nội thất' : 'tiện ích';
  return (
    <>
      {rows.map((row, i) => (
        // The count is in the key so that removing a row never hands its input state to another one.
        <View key={`${rows.length}:${i}`} className="gap-3 rounded-xl border border-border p-3">
          {tableColumns[group].map(([key, label]) => (
            <ContractEditField key={key} group={group} field={key} index={i}>
              {key === 'unitAmount' ? (
                <VndMoneyInput
                  label={label}
                  ariaLabel={'Đơn giá ' + text(row.name) + ' (đ)'}
                  value={row.unitAmount}
                  disabled={busy}
                  onValueChange={(v) => patch(group, tableCellRows(rows, i, key, v))}
                />
              ) : (
                <TextField
                  label={label}
                  ariaLabel={label + ' ' + (i + 1)}
                  value={tableCellText(row, key)}
                  onChangeText={(v) => patch(group, tableCellRows(rows, i, key, v))}
                  disabled={busy}
                  maxLength={key === 'name' ? 150 : 1000}
                  keyboardType={key === 'quantity' ? 'number-pad' : 'default'}
                />
              )}
            </ContractEditField>
          ))}
          <Pressable
            onPress={() =>
              patch(
                group,
                rows.filter((_, j) => j !== i)
              )
            }
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={'Xóa dòng ' + group + ' ' + (i + 1)}
            accessibilityState={{ disabled: busy }}
            className={`min-h-11 flex-row items-center gap-2 self-end rounded-xl border border-border px-4 ${busy ? 'opacity-50' : ''}`}>
            <Icon name="remove-circle-outline" size={18} className="text-danger" />
            <Text className="text-sm font-semibold text-danger">Xóa</Text>
          </Pressable>
        </View>
      ))}
      <ActionButton
        label={'Thêm dòng ' + add}
        icon="add"
        variant="secondary"
        disabled={busy || rows.length >= 50}
        onClick={() => patch(group, [...rows, newTableRow(group, randomUUID)])}
      />
      {group === 'charges' ? (
        <PolicyNotice
          tone="neutral"
          title="Cách nhập phí dịch vụ"
          actionLabel="Xem hướng dẫn"
          summary="Hệ thống tính lại tổng tiền khi đối chiếu.">
          <NoticeText>
            Nhập cách tính: Tháng, Người / tháng, Xe máy / tháng, Ô tô / tháng, kWh, m³, mét vuông /
            tháng, Miễn phí, Bao gồm hoặc Không áp dụng. Hệ thống tính lại tổng tiền khi đối chiếu.
          </NoticeText>
        </PolicyNotice>
      ) : null}
    </>
  );
}

export default function InlineAmendmentFields({ group }: { group: AmendmentTableGroup }) {
  const amendment = useAmendmentWorkspace();
  const draft = useContractDraftEditor();
  const w = draft ?? (amendment?.editing ? amendment : null);
  const base = draft?.base ?? amendment?.data?.currentTerms;
  if (!w || !base) return null;
  const values = w.values;
  const busy = Boolean(w.busy);

  if (group === 'residents')
    return (
      <ContractTermFields
        group="tenant"
        fields={[
          ['occupantCount', 'Số người cư trú'],
          ['motorbikeCount', 'Xe máy đăng ký'],
          ['carCount', 'Ô tô đăng ký'],
        ]}
      />
    );

  const heading = (
    <View className="gap-1">
      <Text className="text-xs leading-5 text-muted-foreground">
        {draft
          ? 'Dữ liệu sẽ được đưa vào PDF khi lưu bản nháp'
          : 'Nhập nội dung đã thỏa thuận · Chưa có hiệu lực'}
      </Text>
      <Pressable
        onPress={() => resetSection(group, base, w.patch)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        className={`min-h-11 flex-row items-center gap-2 self-start ${busy ? 'opacity-50' : ''}`}>
        <Icon name="refresh-outline" size={16} className="text-primary" />
        <Text className="text-sm font-bold text-primary">Khôi phục mục này</Text>
      </Pressable>
    </View>
  );

  if (group === 'rent')
    return (
      <View className="gap-2">
        {heading}
        <ContractEditField group="financial" field="amountValue">
          <VndMoneyInput
            label="Tiền thuê hàng tháng (đ)"
            min={1}
            disabled={busy}
            value={values.financial.amountValue}
            onValueChange={(amountValue) =>
              w.patch('financial', { ...values.financial, amountValue })
            }
          />
        </ContractEditField>
        <Text className="text-xs leading-5 text-muted-foreground">
          Bằng chữ được tính lại từ số tiền; tiền cọc đã nhận giữ nguyên.
        </Text>
      </View>
    );

  if (group === 'rules') {
    const sourcePolicies = (amendment?.listingSync?.terms.policies ?? values.policies)
      .listingPolicies;
    const policyRows = Array.isArray(sourcePolicies) ? (sourcePolicies as TermRow[]) : [];
    const mode = canonicalFeeMode(values.policies.latePaymentFeeMode);
    const selected = mode || 'NONE';
    const none = mode === 'NONE';
    const systemTerms = 'systemTerms' in values ? values.systemTerms : undefined;
    return (
      <View className="gap-4">
        {heading}
        <View className="gap-2 rounded-xl border border-border p-3">
          <Text className="text-sm font-semibold text-foreground">
            Nội quy lấy từ bài đăng đã duyệt
          </Text>
          {policyRows.map((row) => (
            <Text key={text(row.code)} className="text-sm leading-6 text-foreground">
              <Text className="font-bold">{text(row.label)}</Text> ·{' '}
              {text(row.displayValue ?? row.value)}
            </Text>
          ))}
        </View>
        <ContractEditField group="policies" field="latePaymentFeeMode">
          <FieldFrame label="Cách tính phí chậm trả">
            <View accessibilityLabel="Cách tính phí chậm trả" className="gap-2">
              {Object.entries(feeLabels).map(([value, label]) => (
                <ChoiceButton
                  key={value}
                  label={label}
                  selected={selected === value}
                  disabled={busy}
                  // A web <select> reports a change only: "Một lần" must not be rewritten as its code.
                  onPress={() => {
                    if (selected !== value)
                      w.patch('policies', feeModePatch(values.policies, value));
                  }}
                />
              ))}
            </View>
          </FieldFrame>
          <PolicyNotice
            tone="neutral"
            title="Hiệu lực phụ lục"
            summary="Phụ lục phải được hai bên ký đủ và đến kỳ áp dụng.">
            <NoticeText>
              Phụ lục phải được hai bên ký đủ và đến kỳ áp dụng. Không tính lại phí của hóa đơn đã
              phát hành.
            </NoticeText>
          </PolicyNotice>
        </ContractEditField>
        <ContractEditField group="policies" field="latePaymentFeeAmount" readonly={none}>
          <VndMoneyInput
            label="Mức phí chậm trả (đ)"
            min={none ? 0 : 1}
            disabled={busy || none}
            value={values.policies.latePaymentFeeAmount}
            onValueChange={(latePaymentFeeAmount) =>
              w.patch('policies', { ...values.policies, latePaymentFeeAmount })
            }
          />
        </ContractEditField>
        <BillingSystemRuleLabels />
        {systemTerms ? (
          <View
            accessibilityLabel="Điều khoản quy trình hệ thống không chỉnh sửa"
            className="gap-2 rounded-xl border border-border bg-muted p-3">
            <Text className="text-sm font-semibold text-foreground">
              Quy trình xử lý quá hạn · Nhãn chỉ đọc
            </Text>
            <Text selectable className="text-sm leading-6 text-muted-foreground">
              {systemTerms}
            </Text>
            <PolicyNotice
              tone="neutral"
              title="Quy trình xử lý quá hạn"
              summary="Hệ thống tự giữ nội dung này trong Word.">
              <NoticeText>
                Hệ thống tự giữ nội dung này trong Word. Ô bên dưới chỉ dành cho thỏa thuận bổ sung
                của hai bên.
              </NoticeText>
            </PolicyNotice>
          </View>
        ) : null}
        <ContractEditField group="specialTerms">
          <SpecialTermsInput
            value={values.specialTerms}
            onChangeText={(specialTerms) => w.patch('specialTerms', specialTerms)}
            disabled={busy}
          />
        </ContractEditField>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {heading}
      <EditTable group={group} rows={values[group] ?? []} busy={busy} patch={w.patch} />
    </View>
  );
}
