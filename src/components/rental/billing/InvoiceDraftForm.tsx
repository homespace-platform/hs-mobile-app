// Web MonthlyInvoicesSection.tsx:389-424: the landlord's draft (closing meters and extra charges).
import { Pressable, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import ActionButton from '@/components/rental/shared/ActionButton';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import VndMoneyInput from '@/components/rental/shared/VndMoneyInput';
import { dateTime, type Extra } from '@/lib/rental/MonthlyInvoicesSection';
import type { MonthlyInvoice } from '@/types/rental/monthly-invoice.type';

import { LineInput, Notice, ToneBox } from './common';
import { canIssueNow } from './logic';
import { MeterReadingInput } from './MeterReading';

export default function InvoiceDraftForm({
  invoice,
  electricityRequired,
  waterRequired,
  unsupportedWaterRate,
  previousElectricity,
  previousWater,
  electricity,
  water,
  rows,
  onElectricity,
  onWater,
  onRows,
  busy,
  onIssue,
  onSave,
}: {
  invoice: MonthlyInvoice;
  electricityRequired: boolean;
  waterRequired: boolean;
  unsupportedWaterRate: boolean;
  previousElectricity?: string | number;
  previousWater?: string | number;
  electricity: string;
  water: string;
  rows: Extra[];
  onElectricity: (value: string) => void;
  onWater: (value: string) => void;
  onRows: (rows: Extra[]) => void;
  busy: boolean;
  onIssue: () => void;
  onSave: () => void;
}) {
  const edit = (index: number, patch: Partial<Extra>) =>
    onRows(rows.map((row, n) => (n === index ? { ...row, ...patch } : row)));
  return (
    <View className="gap-3 rounded-2xl border border-border bg-muted p-3">
      <Text accessibilityRole="header" className="text-sm font-bold text-foreground">
        Chỉ số cuối kỳ & phí phát sinh
      </Text>
      <PolicyNotice
        tone="neutral"
        title="Nhập chỉ số cuối kỳ"
        summary="Chủ nhà có 24 giờ từ đầu ngày cuối kỳ để nhập chỉ số cuối kỳ.">
        <Notice>
          Chủ nhà có 24 giờ từ đầu ngày cuối kỳ để nhập chỉ số cuối kỳ. Có thể chốt và phát hành
          ngay; nếu chỉ lưu bản nháp, hệ thống tự phát hành từ {dateTime(invoice.meterDeadlineAt)}{' '}
          và tạm dùng chỉ số đầu kỳ cho phần chưa nhập. Đơn giá lấy từ hợp đồng đã ký.
        </Notice>
      </PolicyNotice>
      {unsupportedWaterRate ? (
        <ToneBox tone="warning">
          Biểu phí nước theo giá nhà nước chưa có đơn giá số cố định trong hợp đồng. Chưa thể phát
          hành tự động để tránh tính sai; vui lòng liên hệ quản trị viên.
        </ToneBox>
      ) : null}
      {electricityRequired ? (
        <MeterReadingInput
          name="điện"
          unit="kWh"
          start={previousElectricity}
          end={electricity}
          onChange={onElectricity}
          disabled={busy}
        />
      ) : null}
      {waterRequired ? (
        <MeterReadingInput
          name="nước"
          unit="m³"
          start={previousWater}
          end={water}
          onChange={onWater}
          disabled={busy}
        />
      ) : null}
      {rows.map((row, index) => (
        <View key={index} className="gap-2 rounded-2xl border border-border bg-surface p-3">
          <View className="flex-row items-center gap-2">
            <LineInput
              value={row.description}
              onChangeText={(description) => edit(index, { description })}
              disabled={busy}
              accessibilityLabel="Tên khoản phát sinh"
              placeholder="Tên khoản phát sinh"
              className="flex-1"
            />
            <Pressable
              onPress={() => onRows(rows.filter((_, n) => n !== index))}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Xóa khoản phát sinh"
              className="h-12 w-12 items-center justify-center rounded-xl border border-border active:bg-muted">
              <Icon name="trash-outline" size={18} className="text-danger" />
            </Pressable>
          </View>
          <VndMoneyInput
            ariaLabel="Số tiền phát sinh"
            min={1}
            max={Number.MAX_SAFE_INTEGER}
            placeholder="Số tiền (đ)"
            value={row.amount}
            onValueChange={(amount) => edit(index, { amount })}
            disabled={busy}
          />
        </View>
      ))}
      <ActionButton
        label="Thêm phí phát sinh"
        icon="add"
        variant="secondary"
        disabled={busy}
        onClick={() => onRows([...rows, { description: '', amount: '' }])}
      />
      <ActionButton
        label="Chốt và phát hành ngay"
        disabled={busy || unsupportedWaterRate || !canIssueNow(invoice)}
        onClick={onIssue}
      />
      <ActionButton
        label="Lưu bản nháp"
        variant="secondary"
        disabled={busy || unsupportedWaterRate}
        onClick={onSave}
      />
    </View>
  );
}
