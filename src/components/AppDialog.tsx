import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View, type AlertButton } from 'react-native';
import Icon from '@/components/Icon';

type Dialog = {
  title: string;
  message: string;
  buttons: AlertButton[];
  tone: 'info' | 'success';
};

type ShowDialog = (
  title: string,
  message: string,
  buttons?: AlertButton[],
  tone?: Dialog['tone']
) => void;

const DialogContext = createContext<ShowDialog | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const showDialog = useCallback<ShowDialog>((title, message, buttons, tone = 'info') => {
    setDialog({ title, message, buttons: buttons?.length ? buttons : [{ text: 'Đóng' }], tone });
  }, []);

  function close(button?: AlertButton) {
    setDialog(null);
    // Let the native modal close before an action opens another native screen.
    if (button?.onPress) setTimeout(() => button.onPress?.(), 250);
  }

  const destructive = dialog?.buttons.some((button) => button.style === 'destructive');
  const icon =
    dialog?.tone === 'success'
      ? 'checkmark-circle'
      : destructive
        ? 'warning'
        : 'information-circle';
  const accent =
    dialog?.tone === 'success' ? 'text-success' : destructive ? 'text-danger' : 'text-primary';
  const soft =
    dialog?.tone === 'success'
      ? 'bg-success-soft'
      : destructive
        ? 'bg-danger-soft'
        : 'bg-primary-soft';

  return (
    <DialogContext.Provider value={showDialog}>
      {children}
      <Modal
        visible={Boolean(dialog)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => close()}>
        <View className="flex-1 items-center justify-center bg-overlay/65 px-5 py-8">
          <Pressable
            onPress={() => close()}
            accessibilityRole="button"
            accessibilityLabel="Đóng thông báo"
            className="absolute inset-0"
          />
          {dialog ? (
            <View
              accessibilityViewIsModal
              className="max-h-[85%] w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface">
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerClassName="items-center px-5 pb-2 pt-6">
                <View className={`mb-4 h-16 w-16 items-center justify-center rounded-2xl ${soft}`}>
                  <Icon name={icon} size={34} className={accent} />
                </View>
                <Text
                  accessibilityRole="header"
                  className="text-center text-xl font-bold text-foreground">
                  {dialog.title}
                </Text>
                <Text
                  className={`mt-3 w-full text-sm leading-6 text-secondary ${dialog.message.length > 160 ? 'text-left' : 'text-center'}`}>
                  {dialog.message}
                </Text>
              </ScrollView>
              <View
                className={`gap-3 px-5 pb-5 pt-5 ${dialog.buttons.length === 2 ? 'flex-row' : ''}`}>
                {dialog.buttons.map((button, index) => {
                  const cancel = button.style === 'cancel';
                  const danger = button.style === 'destructive';
                  return (
                    <Pressable
                      key={`${button.text ?? 'OK'}-${index}`}
                      onPress={() => close(button)}
                      accessibilityRole="button"
                      className={`min-h-12 items-center justify-center rounded-2xl px-4 py-3 ${dialog.buttons.length === 2 ? 'flex-1' : ''} ${cancel ? 'border border-border bg-surface' : danger ? 'bg-danger-soft' : 'bg-brand'}`}>
                      <Text
                        className={`text-center text-sm font-bold ${cancel ? 'text-secondary' : danger ? 'text-danger' : 'text-on-brand'}`}>
                        {button.text ?? 'OK'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const dialog = useContext(DialogContext);
  if (!dialog) throw new Error('useDialog must be used inside DialogProvider');
  return dialog;
}
