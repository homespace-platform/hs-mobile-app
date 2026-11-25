// Web ContractLifecyclePanel.tsx:217-228 and issueSupplement (:141-160): costs not yet billed.
import { useState } from 'react';
import { Text, View } from 'react-native';

import Accordion from '@/components/rental/shared/Accordion';
import ActionButton from '@/components/rental/shared/ActionButton';
import { PolicyNotice } from '@/components/rental/shared/PolicyNotice';
import VndMoneyInput from '@/components/rental/shared/VndMoneyInput';
import { contractLifecycleService } from '@/services/rental/contract-lifecycle.service';
import type { FinalCostsPayload } from '@/types/rental/contract-lifecycle.type';

import { LineInput, Notice, useToast } from './common';
import { supplementPayload, type Bill, type createRetryId } from './logic';
import { MeterReadingInput } from './MeterReading';

export default function FinalCostsForm({
  contractId,
  noDeposit,
  lastBilled,
  retry,
  busy,
  perform,
}: {
  contractId: string;
  noDeposit: boolean;
  lastBilled: Bill | undefined;
  /** Owned by the panel: the same body keeps its request id across retries. */
  retry: ReturnType<typeof createRetryId>;
  busy: boolean;
  perform: (action: () => Promise<unknown>) => void;
}) {
  const [electricity, setElectricity] = useState('');
  const [water, setWater] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const toast = useToast();

  function issue() {
    const result = supplementPayload({ electricity, water, description, amount }, lastBilled);
    if (result.error !== undefined) {
      toast.error(result.error);
      return;
    }
    const body: FinalCostsPayload = { ...result.payload, requestId: retry.idFor(result.payload) };
    perform(async () => {
      await contractLifecycleService.finalCosts(contractId, body);
      retry.clear();
      setElectricity('');
      setWater('');
      setDescription('');
      setAmount('');
    });
  }

  return (
    <Accordion title="Ngoại lệ · Bổ sung chi phí chưa thu (không bắt buộc)">
      <View className="gap-3">
        <PolicyNotice
          tone="warning"
          title="Ngoại lệ · Bổ sung chi phí chưa thu"
          text={
            noDeposit
              ? 'Nếu đã thanh toán đủ chi phí kỳ cuối, tiếp tục đề xuất trả nhà và quyết toán. Khoản bồi thường hoặc phải trả khác cần có căn cứ và hai bên đồng ý; không thu hai lần.'
              : 'Nếu đã thanh toán đủ chi phí kỳ cuối, bỏ qua mục này và lập đề xuất hoàn cọc. Hư hại tài sản đưa vào khấu trừ cọc bên dưới, không thu hai lần. Phát hành bổ sung sẽ yêu cầu thanh toán hóa đơn mới và lập lại đề xuất cọc nếu đã gửi.'
          }
        />
        <PolicyNotice
          tone="neutral"
          title="Cách nhập chi phí chưa thu"
          summary="Chỉ nhập phần chưa thu; hệ thống chỉ thu phần tăng so với hóa đơn gần nhất.">
          <Notice>
            Chỉ nhập phần chưa thu. Chỉ số mới là số công tơ thực tế; hệ thống chỉ thu phần tăng so
            với số đã tính trên hóa đơn gần nhất. Không sửa bill cũ hoặc thu lại tiền phòng.
          </Notice>
        </PolicyNotice>
        <MeterReadingInput
          name="điện"
          unit="kWh"
          variant="supplement"
          start={lastBilled?.electricityEnd}
          end={electricity}
          onChange={setElectricity}
          disabled={busy}
        />
        <MeterReadingInput
          name="nước"
          unit="m³"
          variant="supplement"
          start={lastBilled?.waterEnd}
          end={water}
          onChange={setWater}
          disabled={busy}
        />
        <View className="gap-1">
          <Text className="text-sm font-semibold text-foreground">Chi phí phát sinh chưa thu</Text>
          <LineInput
            value={description}
            onChangeText={setDescription}
            maxLength={150}
            disabled={busy}
            accessibilityLabel="Mô tả chi phí bổ sung"
          />
        </View>
        <VndMoneyInput
          label="Số tiền phát sinh (đ)"
          ariaLabel="Số tiền chi phí bổ sung"
          max={Number.MAX_SAFE_INTEGER}
          value={amount}
          onValueChange={setAmount}
          disabled={busy}
        />
        <ActionButton
          label="Phát hành hóa đơn bổ sung kỳ cuối"
          variant="secondary"
          disabled={busy}
          onClick={issue}
        />
      </View>
    </Accordion>
  );
}
