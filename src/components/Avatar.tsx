import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

export default function Avatar({
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
