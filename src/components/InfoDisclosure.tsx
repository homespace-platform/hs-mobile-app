import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Icon from '@/components/Icon';

const TONES = {
  info: {
    box: 'border-primary-border bg-primary-soft',
    icon: 'text-primary',
    link: 'text-primary',
  },
  warning: { box: 'border-warning bg-warning-soft', icon: 'text-warning', link: 'text-warning' },
} as const;

/** Short notice; the full text expands in place on demand. */
export function InfoDisclosure({
  summary,
  details,
  tone = 'info',
  className = '',
}: {
  summary: string;
  details: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = TONES[tone];
  return (
    <View className={`rounded-2xl border p-3 ${t.box} ${className}`}>
      <View className="flex-row items-start">
        <Icon name="information-circle-outline" size={20} className={`mt-0.5 ${t.icon}`} />
        <Text className="ml-2 flex-1 text-sm leading-5 text-foreground">{summary}</Text>
      </View>
      {open ? <Text className="mt-2 text-sm leading-6 text-secondary">{details}</Text> : null}
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="mt-1 min-h-11 justify-center self-start">
        <Text className={`text-sm font-bold ${t.link}`}>{open ? 'Thu gọn' : 'Xem chi tiết'}</Text>
      </Pressable>
    </View>
  );
}

/** "Xem điều khoản" link opening the full terms in a scrollable modal. */
export function TermsLink({
  title,
  text,
  label = 'Xem điều khoản',
}: {
  title: string;
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="min-h-11 justify-center self-start">
        <Text className="text-sm font-bold text-primary">{label}</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}>
        <View className="flex-1 items-center justify-center bg-overlay/65 px-5 py-8">
          <View
            accessibilityViewIsModal
            className="max-h-[85%] w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface">
            <ScrollView contentContainerClassName="px-5 pb-2 pt-6">
              <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
                {title}
              </Text>
              <Text className="mt-3 text-sm leading-6 text-secondary">{text}</Text>
            </ScrollView>
            <View className="px-5 pb-5 pt-4">
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                className="min-h-12 items-center justify-center rounded-2xl bg-brand px-4 py-3">
                <Text className="text-sm font-bold text-on-brand">Đã hiểu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
