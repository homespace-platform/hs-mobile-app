import { Text, View } from 'react-native';

import { listingStatus } from '@/lib/listing-manage';

const TONES = {
  success: { box: 'bg-success-soft', text: 'text-success' },
  warning: { box: 'bg-warning-soft', text: 'text-warning' },
  danger: { box: 'bg-danger-soft', text: 'text-danger' },
  primary: { box: 'bg-primary-soft', text: 'text-primary' },
  neutral: { box: 'bg-muted', text: 'text-secondary' },
};

export default function StatusBadge({ status }: { status: string }) {
  const { label, tone } = listingStatus(status);
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${TONES[tone].box}`}>
      <Text className={`text-xs font-bold ${TONES[tone].text}`}>{label}</Text>
    </View>
  );
}
