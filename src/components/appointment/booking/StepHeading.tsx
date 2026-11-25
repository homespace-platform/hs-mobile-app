import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';

export default function StepHeading({
  icon,
  title,
  required,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  title: string;
  required?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon name={icon} size={15} className="text-primary" />
      <Text accessibilityRole="header" className="flex-1 text-xs font-bold text-foreground">
        <Text className="uppercase">{title}</Text>
        {required ? <Text className="text-danger"> *</Text> : null}
      </Text>
    </View>
  );
}
