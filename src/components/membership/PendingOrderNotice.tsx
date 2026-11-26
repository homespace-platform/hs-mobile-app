// A checkout error, with the link to the order that still blocks a new one.
import { View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import { ErrorNotice } from '@/components/Screen';

export default function PendingOrderNotice({
  message,
  orderId,
  onOpenOrder,
}: {
  message: string;
  orderId: string | null;
  onOpenOrder: (orderId: string) => void;
}) {
  return (
    <View>
      <ErrorNotice message={message} />
      {orderId ? (
        <ActionButton
          label={`Kiểm tra trạng thái đơn đang chờ (#${orderId.slice(0, 8)}...)`}
          variant="secondary"
          onClick={() => onOpenOrder(orderId)}
        />
      ) : null}
    </View>
  );
}
