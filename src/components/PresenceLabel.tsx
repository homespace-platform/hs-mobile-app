import { Text } from 'react-native';

import { presenceLabel, type ChatPresence } from '@/lib/chat-presence';
import { useMinuteClock } from '@/lib/use-chat-presence';

export default function PresenceLabel({
  presence,
  className = 'text-xs',
}: {
  presence?: ChatPresence;
  className?: string;
}) {
  const now = useMinuteClock();
  return (
    <Text
      numberOfLines={1}
      className={`${className} ${presence?.online ? 'text-success' : 'text-muted-foreground'}`}>
      {presenceLabel(presence, now)}
    </Text>
  );
}
