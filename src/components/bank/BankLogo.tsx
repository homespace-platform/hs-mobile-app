import { useState } from 'react';
import { Image, Text, View } from 'react-native';

/** Bank logo from the catalog's `logo` URL; falls back to the bank code if missing or failed to load. */
export default function BankLogo({
  logo,
  code,
  className = 'h-10 w-14',
}: {
  logo?: string | null;
  code: string;
  className?: string;
}) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const showImage = !!logo && failedLogo !== logo;
  return (
    <View
      className={`items-center justify-center overflow-hidden rounded-xl border border-border bg-logo p-0.5 ${className}`}>
      {showImage ? (
        <Image
          source={{ uri: logo }}
          resizeMode="contain"
          onError={() => setFailedLogo(logo)}
          className="h-full w-full"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text className="text-[10px] font-black text-primary">{code}</Text>
      )}
    </View>
  );
}
