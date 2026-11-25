// Contact, negotiable deposit, note and policy consent (RentalRequestModal.tsx:987-1158).
import { Pressable, Text, TextInput, View } from 'react-native';

import Icon from '@/components/Icon';
import FieldFrame from '@/components/rental/shared/FieldFrame';
import { PolicyConsent, PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import { numberVi } from '@/lib/rental/format';
import { formatVND } from '@/lib/rental/rental-request.helper';
import { splitSentences } from '@/lib/rental/split-sentences';

import { FormLabel, SuffixInput } from './RequestFormControls';
import type { RentalRequestForm } from './useRentalRequestForm';

export function ContactFields({ form }: { form: RentalRequestForm }) {
  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
        Thông tin liên hệ của bạn
      </Text>
      <FieldFrame label="Họ và tên *">
        <SuffixInput
          value={form.renterName}
          onChangeText={form.setRenterName}
          placeholder="Nguyễn Văn A"
          accessibilityLabel="Họ và tên"
          autoComplete="name">
          <Icon name="person-outline" size={16} className="text-muted-foreground" />
        </SuffixInput>
      </FieldFrame>
      <FieldFrame label="Số điện thoại *">
        <SuffixInput
          value={form.renterPhone}
          onChangeText={form.setRenterPhone}
          placeholder="0912345678"
          accessibilityLabel="Số điện thoại"
          keyboardType="phone-pad"
          autoComplete="tel">
          <Icon name="call-outline" size={16} className="text-muted-foreground" />
        </SuffixInput>
      </FieldFrame>
      <FieldFrame label="Địa chỉ Email (để nhận hợp đồng & thông báo)">
        <SuffixInput
          value={form.renterEmail}
          onChangeText={form.setRenterEmail}
          placeholder="email@example.com"
          accessibilityLabel="Địa chỉ Email (để nhận hợp đồng & thông báo)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email">
          <Icon name="mail-outline" size={16} className="text-muted-foreground" />
        </SuffixInput>
      </FieldFrame>
    </View>
  );
}

function Suggestion({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-11 justify-center rounded-lg border border-border bg-surface px-3 active:bg-muted">
      <Text className="text-xs font-semibold text-foreground">{label}</Text>
    </Pressable>
  );
}

/** Only for listings with a negotiable deposit. */
export function NegotiableDeposit({
  form,
  listingPrice,
}: {
  form: RentalRequestForm;
  listingPrice: number;
}) {
  if (!form.deposit.isNegotiable) return null;
  return (
    <View className="gap-3 rounded-2xl border border-warning bg-warning-soft p-3">
      <FormLabel
        icon="cash-outline"
        title="Tiền cọc đề xuất (Thỏa thuận)"
        aside={formatVND(form.depositAmount)}
      />
      <SuffixInput
        suffix="VNĐ"
        keyboardType="number-pad"
        value={form.customDepositInput}
        placeholder={`VD: ${formatVND(listingPrice)}`}
        accessibilityLabel="Tiền cọc đề xuất (Thỏa thuận)"
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '');
          form.setCustomDepositInput(digits ? numberVi(Number(digits)) : '');
        }}
      />
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs text-muted-foreground">Gợi ý nhanh:</Text>
        <Suggestion
          label={`1 tháng (${formatVND(listingPrice)})`}
          onPress={() => form.setCustomDepositInput(numberVi(listingPrice))}
        />
        {listingPrice > 0 ? (
          <Suggestion
            label={`2 tháng (${formatVND(listingPrice * 2)})`}
            onPress={() => form.setCustomDepositInput(numberVi(listingPrice * 2))}
          />
        ) : null}
        <Suggestion label="Miễn cọc (0 đ)" onPress={() => form.setCustomDepositInput('0')} />
      </View>
      <PolicyNotice
        tone="neutral"
        title="Thỏa thuận tiền cọc"
        summary="* Bài đăng cho phép thỏa thuận tiền cọc.">
        <Text className="text-sm leading-6 text-secondary">
          * Bài đăng cho phép thỏa thuận tiền cọc. Mức tiền cọc bạn đề xuất sẽ được gửi đến chủ nhà
          xem xét duyệt.
        </Text>
      </PolicyNotice>
    </View>
  );
}

export function NoteField({ form }: { form: RentalRequestForm }) {
  return (
    <View className="gap-2">
      <View className="flex-row justify-between gap-2">
        <Text className="shrink text-sm font-semibold text-foreground">
          Lời nhắn gửi chủ nhà (tuỳ chọn)
        </Text>
        <Text className="text-xs text-muted-foreground">{form.renterNote.length}/500</Text>
      </View>
      <TextInput
        value={form.renterNote}
        onChangeText={form.setRenterNote}
        multiline
        maxLength={500}
        textAlignVertical="top"
        placeholder="VD: Tôi muốn thuê lâu dài, hiện đang làm việc tại quận 1, có nuôi 1 chú mèo nhỏ ngoan..."
        accessibilityLabel="Lời nhắn gửi chủ nhà (tuỳ chọn)"
        numberOfLines={3}
        // Fixed at three 24pt lines + padding + border (web rows={3}, no resize); more text scrolls.
        className="h-[98px] rounded-xl border border-border bg-surface p-3 text-base leading-6 text-foreground selection:text-primary placeholder:text-subtle"
      />
    </View>
  );
}

/** Words of the checkbox label (web `<label>`); screen readers use the checkbox itself. */
function LabelText({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled: boolean;
  children: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessible={false}>
      <Text className="text-sm font-bold text-foreground">{children}</Text>
    </Pressable>
  );
}

export function PolicyAgreement({ form }: { form: RentalRequestForm }) {
  const { policy, accepted } = form;
  const disabled = !policy;
  const toggle = () => form.setAccepted(!accepted);
  return (
    <View className="flex-row gap-1 rounded-xl border border-border bg-surface py-2 pl-1 pr-3">
      <Pressable
        onPress={toggle}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityLabel="Tôi đã đọc và đồng ý điều kiện giữ chỗ (bắt buộc)"
        accessibilityState={{ checked: accepted, disabled }}
        className={`h-11 w-11 items-center justify-center ${disabled ? 'opacity-40' : ''}`}>
        <Icon
          name={accepted ? 'checkbox' : 'square-outline'}
          size={24}
          className={accepted ? 'text-primary' : 'text-muted-foreground'}
        />
      </Pressable>
      <View className="flex-1 justify-center">
        <LabelText onPress={toggle} disabled={disabled}>
          Tôi đã đọc và đồng ý
        </LabelText>
        {policy ? (
          <PolicyConsent
            label="điều kiện giữ chỗ"
            title="Điều kiện giữ chỗ"
            version={policy.version}
            // The sheet splits on ". " only; re-joining gives it the web's sentences (newlines too).
            text={splitSentences(
              (policy.text ?? '').replace(/^./, (letter) => letter.toUpperCase())
            ).join(' ')}
            onAgree={() => form.setAccepted(true)}
          />
        ) : (
          <Text className="py-1 text-sm text-muted-foreground">điều kiện giữ chỗ (đang tải…)</Text>
        )}
        <LabelText onPress={toggle} disabled={disabled}>
          (bắt buộc)
        </LabelText>
      </View>
    </View>
  );
}
