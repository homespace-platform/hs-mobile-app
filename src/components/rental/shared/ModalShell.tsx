// Mobile counterpart of hs-web-app components/rental-request/ModalShell.tsx.
import type { ComponentProps, ReactNode, Ref } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DialogProvider } from '@/components/AppDialog';
import Icon from '@/components/Icon';

export type ModalShellProps = {
  title: ReactNode;
  icon?: ComponentProps<typeof Icon>['name'];
  headerExtra?: ReactNode;
  onClose: () => void;
  /** True while a request is running: the X, the backdrop and Android back do nothing. */
  closeDisabled?: boolean;
  /** Accepted for web parity; a phone always uses the full-height sheet. */
  size?: 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  children: ReactNode;
  scrollRef?: Ref<ScrollView>;
};

/**
 * Full-height bottom sheet, open for as long as it is mounted (as on web). A second ModalShell, or
 * any other RN Modal opened from it, must be rendered inside its children or footer (iOS).
 */
export default function ModalShell({
  title,
  icon,
  headerExtra,
  onClose,
  closeDisabled = false,
  footer,
  children,
  scrollRef,
}: ModalShellProps) {
  const insets = useSafeAreaInsets();
  const close = () => {
    if (!closeDisabled) onClose();
  };
  const bottom = Math.max(insets.bottom, 12);

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <DialogProvider nested>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-overlay/65">
          <Pressable
            onPress={close}
            accessible={false}
            importantForAccessibility="no"
            style={{ height: insets.top + 12 }}
          />
          <View
            accessibilityViewIsModal
            className="flex-1 overflow-hidden rounded-t-3xl border border-border bg-background">
            <View className="flex-row items-center gap-3 border-b border-border bg-surface py-2 pl-4 pr-2">
              {icon ? (
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                  <Icon name={icon} size={20} className="text-primary" />
                </View>
              ) : null}
              <View className="flex-1 flex-row flex-wrap items-center gap-2 py-1">
                {typeof title === 'string' ? (
                  <Text
                    accessibilityRole="header"
                    numberOfLines={2}
                    className="shrink text-base font-bold text-foreground">
                    {title}
                  </Text>
                ) : (
                  title
                )}
                {headerExtra}
              </View>
              <Pressable
                onPress={close}
                disabled={closeDisabled}
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                accessibilityState={{ disabled: closeDisabled }}
                className={`h-11 w-11 items-center justify-center rounded-full active:bg-muted ${closeDisabled ? 'opacity-40' : ''}`}>
                <Icon name="close" size={24} className="text-muted-foreground" />
              </Pressable>
            </View>
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-4 pt-4">
              {children}
              <View style={{ height: footer ? 16 : bottom + 8 }} />
            </ScrollView>
            {footer ? (
              <View
                className="flex-row flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-4 pt-3"
                style={{ paddingBottom: bottom }}>
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </DialogProvider>
    </Modal>
  );
}
