import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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

/** A custom full-screen dialog drawn in the host's own Modal, above any message dialog. */
export type DialogLayer = {
  node: ReactNode;
  /** Android back, another layer taking its place, or the host going away. */
  onDismiss: () => void;
};

type DialogHost = {
  show: ShowDialog;
  /** Returns a function that removes the layer. */
  present: (layer: DialogLayer) => () => void;
  adopt: (child: DialogHost) => () => void;
  root: DialogHost | null;
};

const DialogContext = createContext<DialogHost | null>(null);

/**
 * `nested` is for a provider inside an open RN Modal (iOS cannot show a root Modal above it): while
 * mounted, every dialog raised through an outer provider is drawn here instead.
 */
export function DialogProvider({
  children,
  nested = false,
}: {
  children: ReactNode;
  nested?: boolean;
}) {
  const parent = useContext(DialogContext);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [layer, setLayer] = useState<DialogLayer | null>(null);
  // Mirrors of the state for the host methods, which must be stable and current at once.
  const dialogRef = useRef<Dialog | null>(null);
  const layerRef = useRef<DialogLayer | null>(null);
  const nestedHosts = useRef<DialogHost[]>([]);
  const root = nested ? (parent?.root ?? parent) : null;

  const host = useMemo<DialogHost>(() => {
    const top = () => nestedHosts.current[nestedHosts.current.length - 1];
    return {
      root,
      show(title, message, buttons, tone = 'info') {
        const child = top();
        if (child) return child.show(title, message, buttons, tone);
        dialogRef.current = {
          title,
          message,
          buttons: buttons?.length ? buttons : [{ text: 'Đóng' }],
          tone,
        };
        setDialog(dialogRef.current);
      },
      present(next) {
        const child = top();
        if (child) return child.present(next);
        const previous = layerRef.current;
        layerRef.current = next;
        setLayer(next);
        previous?.onDismiss();
        return () => {
          if (layerRef.current !== next) return;
          layerRef.current = null;
          setLayer(null);
        };
      },
      adopt(child) {
        nestedHosts.current = [...nestedHosts.current, child];
        return () => {
          nestedHosts.current = nestedHosts.current.filter((item) => item !== child);
        };
      },
    };
  }, [root]);

  useEffect(() => {
    if (!nested || !parent) return;
    const leave = parent.adopt(host);
    return () => {
      leave();
      layerRef.current?.onDismiss();
      // A message raised just before this Modal closed must not vanish with it.
      const left = dialogRef.current;
      dialogRef.current = null;
      if (left)
        setTimeout(() => host.root?.show(left.title, left.message, left.buttons, left.tone), 500);
    };
  }, [nested, parent, host]);

  function close(button?: AlertButton) {
    dialogRef.current = null;
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
    <DialogContext.Provider value={host}>
      {children}
      <Modal
        visible={Boolean(dialog || layer)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => (layer ? layer.onDismiss() : close())}>
        {layer ? (
          layer.node
        ) : (
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
                  <View
                    className={`mb-4 h-16 w-16 items-center justify-center rounded-2xl ${soft}`}>
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
        )}
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialogHost() {
  const host = useContext(DialogContext);
  if (!host) throw new Error('useDialog must be used inside DialogProvider');
  return host;
}

export function useDialog() {
  return useDialogHost().show;
}
