// Mobile counterpart of hs-web-app components/rental-request/OnboardingStepper.tsx (phone layout).
import { Text, View } from 'react-native';

import Icon from '@/components/Icon';
import type { PreTenancyStep } from '@/lib/rental/rental-request-presentation';

const STATE_TEXT: Record<PreTenancyStep['state'], string> = {
  done: 'Đã xong',
  current: 'Đang ở bước này',
  skipped: 'Không yêu cầu',
  upcoming: 'Sắp tới',
};

/** The four steps before a tenancy starts, as a vertical list. */
export default function OnboardingStepper({
  steps,
  caption,
}: {
  steps: PreTenancyStep[];
  caption?: string;
}) {
  return (
    <View
      accessibilityLabel="Các bước trước khi thuê"
      className="rounded-2xl border border-border bg-surface p-4">
      {steps.map((step, index) => {
        const done = step.state === 'done';
        const current = step.state === 'current';
        const passed = done || step.state === 'skipped';
        return (
          <View
            key={step.id}
            accessible
            accessibilityLabel={`${index + 1}. ${step.label}: ${STATE_TEXT[step.state]}`}
            accessibilityState={{ selected: current }}
            className="flex-row gap-3">
            <View className="items-center">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full border ${done ? 'border-success bg-success-soft' : current ? 'border-brand bg-brand' : 'border-border bg-muted'}`}>
                {passed ? (
                  <Icon
                    name={done ? 'checkmark' : 'remove'}
                    size={16}
                    className={done ? 'text-success' : 'text-muted-foreground'}
                  />
                ) : (
                  <Text
                    className={`text-sm font-bold ${current ? 'text-on-brand' : 'text-muted-foreground'}`}>
                    {index + 1}
                  </Text>
                )}
              </View>
              {index < steps.length - 1 ? (
                <View
                  className={`my-1 min-h-3 w-0.5 flex-1 rounded-full ${passed ? 'bg-success' : 'bg-border'}`}
                />
              ) : null}
            </View>
            <View className={`flex-1 ${index < steps.length - 1 ? 'pb-3' : ''}`}>
              <Text
                className={`text-sm font-semibold ${step.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'}`}>
                {step.label}
              </Text>
              <Text
                className={`text-xs ${current ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                {STATE_TEXT[step.state]}
              </Text>
            </View>
          </View>
        );
      })}
      {caption ? (
        <Text className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
