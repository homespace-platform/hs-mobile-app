// Web components/membership/MembershipRules.
import { Text, View } from 'react-native';

import Accordion from '@/components/rental/shared/Accordion';
import { membershipRules } from '@/lib/membership';
import type { MembershipPlan } from '@/services/membershipApi';

export default function MembershipRules({ freePlan }: { freePlan?: MembershipPlan }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
        Quy tắc sử dụng lượt đăng
      </Text>
      {membershipRules(freePlan).map((rule) => (
        <Accordion key={rule.title} title={rule.title}>
          <View className="gap-2">
            {rule.items.map((item) => (
              <View key={item} className="flex-row gap-2">
                <Text className="text-sm text-muted-foreground">•</Text>
                <Text className="flex-1 text-sm leading-5 text-muted-foreground">{item}</Text>
              </View>
            ))}
          </View>
        </Accordion>
      ))}
    </View>
  );
}
