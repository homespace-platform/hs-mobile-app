import { useState, type ComponentProps, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';

/** Policy codes like "RESERVATION_DEFAULT_V3" are internal; users only see "Phiên bản 3". */
function versionLabel(version?: string) {
  const n = version?.trim().match(/v?(\d+(?:\.\d+)*)$/i)?.[1];
  return n ? `Phiên bản ${n}` : null;
}

type IconName = ComponentProps<typeof Icon>['name'];

const TONES = {
  info: { box: 'border-primary-border bg-primary-soft', icon: 'text-primary' },
  warning: { box: 'border-warning bg-warning-soft', icon: 'text-warning' },
  neutral: { box: 'border-border bg-surface', icon: 'text-muted-foreground' },
} as const;

/** Splits on ". " only; every character is kept (the period stays with its sentence). */
function splitSentences(text: string) {
  const parts = text.split('. ');
  return parts.map((s, i) => (i < parts.length - 1 ? `${s}.` : s));
}

export type PolicyDialogProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  version?: string;
  icon?: IconName;
  children?: ReactNode;
  text?: string;
  /** Replaces the default "Đã hiểu" button (it must close the dialog itself). */
  footer?: ReactNode;
};

/** The one place full rules, terms and policies are shown: a scrollable bottom sheet. */
export function PolicyDialog({
  visible,
  onClose,
  title,
  subtitle,
  version,
  icon = 'document-text-outline',
  children,
  text,
  footer,
}: PolicyDialogProps) {
  const insets = useSafeAreaInsets();
  const sentences = text ? splitSentences(text) : [];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-overlay/65">
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          className="flex-1"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          className="max-h-[85%] w-full overflow-hidden rounded-t-3xl border border-border bg-surface">
          <View className="flex-row items-center px-5 pb-3 pt-5">
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft">
              <Icon name={icon} size={22} className="text-primary" />
            </View>
            <View className="ml-3 flex-1">
              <Text accessibilityRole="header" className="text-lg font-bold text-foreground">
                {title}
              </Text>
              {subtitle ? (
                <Text className="mt-0.5 text-xs text-muted-foreground">{subtitle}</Text>
              ) : null}
            </View>
            {versionLabel(version) ? (
              <View className="ml-2 rounded-full bg-primary-soft px-3 py-1">
                <Text className="text-xs font-bold text-primary">{versionLabel(version)}</Text>
              </View>
            ) : null}
          </View>
          <ScrollView contentContainerClassName="px-5 pb-3">
            {children}
            {sentences.length > 1 ? (
              sentences.map((s, i) => (
                <View key={i} className="mb-3 flex-row">
                  <Text className="w-6 text-sm font-bold leading-6 text-primary">{i + 1}.</Text>
                  <Text className="flex-1 text-sm leading-6 text-secondary">{s}</Text>
                </View>
              ))
            ) : sentences.length ? (
              <Text className="text-sm leading-6 text-secondary">{sentences[0]}</Text>
            ) : null}
          </ScrollView>
          <View className="px-5 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            {footer ?? (
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                className="min-h-12 items-center justify-center rounded-2xl bg-brand px-4 py-3">
                <Text className="text-sm font-bold text-on-brand">Đã hiểu</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** One-line summary + "Xem chi tiết" opening the full content in PolicyDialog. */
export function PolicyNotice({
  summary,
  title,
  subtitle,
  version,
  text,
  children,
  tone = 'info',
  actionLabel = 'Xem chi tiết',
  icon = 'information-circle-outline',
  className = '',
}: {
  summary: string;
  title: string;
  subtitle?: string;
  version?: string;
  text?: string;
  children?: ReactNode;
  tone?: keyof typeof TONES;
  actionLabel?: string;
  icon?: IconName;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = TONES[tone];
  return (
    <>
      <View className={`flex-row items-center rounded-2xl border px-3 ${t.box} ${className}`}>
        <Icon name={icon} size={20} className={t.icon} />
        <Text numberOfLines={2} className="ml-2 flex-1 py-2 text-sm leading-5 text-foreground">
          {summary}
        </Text>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
          className="ml-2 min-h-11 justify-center">
          <Text className="text-sm font-bold text-primary">{actionLabel}</Text>
        </Pressable>
      </View>
      <PolicyDialog
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
        subtitle={subtitle}
        version={version}
        icon={icon}
        text={text}>
        {children}
      </PolicyDialog>
    </>
  );
}

/** "Xem điều khoản" link for consent checkboxes. "Đã hiểu" never ticks; `onAgree` does. */
export function PolicyConsent({
  title,
  subtitle,
  version,
  text,
  children,
  label = 'Xem điều khoản',
  onAgree,
}: {
  title: string;
  subtitle?: string;
  version?: string;
  text?: string;
  children?: ReactNode;
  label?: string;
  onAgree?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="min-h-11 justify-center self-start">
        <Text className="text-sm font-bold text-primary">{label}</Text>
      </Pressable>
      <PolicyDialog
        visible={open}
        onClose={close}
        title={title}
        subtitle={subtitle}
        version={version}
        text={text}
        footer={
          onAgree ? (
            <View className="gap-2">
              <Pressable
                onPress={() => {
                  onAgree();
                  close();
                }}
                accessibilityRole="button"
                className="min-h-12 items-center justify-center rounded-2xl bg-brand px-4 py-3">
                <Text className="text-sm font-bold text-on-brand">Đồng ý & đóng</Text>
              </Pressable>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                className="min-h-12 items-center justify-center rounded-2xl border border-border px-4 py-3">
                <Text className="text-sm font-bold text-foreground">Đã hiểu</Text>
              </Pressable>
            </View>
          ) : undefined
        }>
        {children}
      </PolicyDialog>
    </>
  );
}
