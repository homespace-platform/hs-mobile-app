// Web components/common/PolicyDialog.tsx props on top of the app's PolicyDialog sheet.
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PolicyDialog, PolicyNotice as BaseNotice } from '@/components/PolicyDialog';
import { splitSentences } from '@/lib/rental/split-sentences';

import ActionButton from './ActionButton';

export { PolicyDialog };

type BaseProps = ComponentProps<typeof BaseNotice>;

/** As web: without `summary`, the first sentence of `text` is the summary row. */
export function PolicyNotice({
  summary,
  text,
  tone = 'info',
  icon,
  ...props
}: Omit<BaseProps, 'summary'> & { summary?: string }) {
  return (
    <BaseNotice
      {...props}
      text={text}
      tone={tone}
      icon={icon ?? (tone === 'warning' ? 'warning-outline' : 'information-circle-outline')}
      summary={summary ?? (text ? splitSentences(text)[0] : '')}
    />
  );
}

/** Inline terms link. "Đồng ý & đóng" calls onAgree (tick the same checkbox); "Đã hiểu" never does. */
export function PolicyConsent({
  label,
  title,
  version,
  text,
  children,
  onAgree,
}: {
  label: string;
  title: string;
  version?: string;
  text?: string;
  children?: ReactNode;
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
        <Text className="text-sm font-bold text-primary underline">{label}</Text>
      </Pressable>
      <PolicyDialog
        visible={open}
        onClose={close}
        title={title}
        subtitle="Vui lòng đọc kỹ trước khi đồng ý"
        version={version}
        text={text}
        footer={
          <View className="gap-2">
            <Text className="text-xs text-muted-foreground">
              Bạn vẫn cần tích ô đồng ý trong biểu mẫu
            </Text>
            {onAgree ? (
              <ActionButton
                label="Đồng ý & đóng"
                icon="checkmark"
                onClick={() => {
                  onAgree();
                  close();
                }}
              />
            ) : null}
            <ActionButton label="Đã hiểu" variant="secondary" onClick={close} />
          </View>
        }>
        {children}
      </PolicyDialog>
    </>
  );
}
