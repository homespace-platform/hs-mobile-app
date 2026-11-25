// Listing thumbnail with the web's URL rule (http(s) or "/path", which web serves from its own origin).
import { Image, View } from 'react-native';

import Icon from '@/components/Icon';
import { webBaseUrl } from '@/config/env';

import { validImage } from './logic';

export default function RequestThumbnail({
  url,
  className,
  label = 'Ảnh bài đăng',
}: {
  url?: string | null;
  /** Size classes. */
  className: string;
  label?: string;
}) {
  const path = validImage(url) ? url!.trim() : null;
  const uri = path?.startsWith('/')
    ? webBaseUrl && `${webBaseUrl.replace(/\/$/, '')}${path}`
    : path;
  return uri ? (
    <Image
      source={{ uri }}
      accessibilityLabel={label}
      className={`rounded-xl border border-border bg-muted ${className}`}
    />
  ) : (
    <View
      className={`items-center justify-center rounded-xl border border-border bg-muted ${className}`}>
      <Icon name="home-outline" size={24} className="text-muted-foreground" />
    </View>
  );
}
