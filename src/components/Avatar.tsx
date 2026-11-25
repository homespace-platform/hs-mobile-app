import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { OFFLINE_LABEL, ONLINE_LABEL } from '@/lib/chat-presence';

// `online` (true/false) adds a presence dot in the corner; leave it undefined for a plain avatar.
export default function Avatar({
  online,
  ...props
}: {
  uri?: string | null;
  name: string;
  size?: number;
  online?: boolean;
}) {
  if (online === undefined) return <AvatarImage {...props} />;
  const dot = Math.max(10, Math.round((props.size ?? 48) * 0.26));
  return (
    <View>
      <AvatarImage {...props} />
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={online ? ONLINE_LABEL : OFFLINE_LABEL}
        style={{ width: dot, height: dot, borderRadius: dot / 2 }}
        className={`absolute bottom-0 right-0 border-2 border-background ${online ? 'bg-success' : 'bg-subtle'}`}
      />
    </View>
  );
}

function AvatarImage({
  uri,
  name,
  size = 48,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className="bg-muted"
      />
    );
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center bg-primary-soft">
      <Text style={{ fontSize: size * 0.32 }} className="font-extrabold text-primary">
        {initials || 'HS'}
      </Text>
    </View>
  );
}
