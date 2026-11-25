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
import { onSessionEnd, sessionGeneration } from '@/lib/session-end';

type Dialog = {
  title: string;
  message: string;
  buttons: AlertButton[];
  tone: 'info' | 'success' | 'warning';
  /** Offers an action that other notices must wait for. */
  keep?: boolean;
};

type ShowDialog = (
  title: string,
  message: string,
  buttons?: AlertButton[],
  tone?: Dialog['tone'],
  keep?: boolean
) => void;

/** A custom full-screen dialog drawn in the host's own Modal, above any message dialog. */
export type DialogLayer = {
  node: ReactNode;
  /** Android back, another layer taking its place, or the host going away. */
  onDismiss: () => void;
};

type DialogHost = {
  show: ShowDialog;
  enqueue: (dialog: Dialog) => void;
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
  const pending = useRef<Dialog[]>([]);
  const closingForAction = useRef(false);
  const layerRef = useRef<DialogLayer | null>(null);
  const nestedHosts = useRef<DialogHost[]>([]);
  const root = nested ? (parent?.root ?? parent) : null;

  const host = useMemo<DialogHost>(() => {
    const top = () => nestedHosts.current[nestedHosts.current.length - 1];
    const display = (next: Dialog) => {
      dialogRef.current = next;
      setDialog(next);
    };
    return {
      root,
      show(title, message, buttons, tone = 'info', keep) {
        const child = top();
        if (child) return child.show(title, message, buttons, tone, keep);
        const next = {
          title,
          message,
          buttons: buttons?.length ? buttons : [{ text: 'Đóng' }],
          tone,
          keep,
        };
        if (dialogRef.current?.keep || closingForAction.current || pending.current.length)
          pending.current.push(next);
        else display(next);
      },
      enqueue(next) {
        const child = top();
        if (child) return child.enqueue(next);
        if (dialogRef.current || closingForAction.current) pending.current.push(next);
        else display({ ...next, keep: true });
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

  useEffect(
    () =>
      onSessionEnd(() => {
        pending.current.length = 0;
        closingForAction.current = false;
        dialogRef.current = null;
        setDialog(null);
        const previous = layerRef.current;
        layerRef.current = null;
        setLayer(null);
        previous?.onDismiss();
      }),
    []
  );

  useEffect(() => {
    if (!nested || !parent) return;
    const leave = parent.adopt(host);
    const notices = pending.current;
    return () => {
      leave();
      layerRef.current?.onDismiss();
      // A message raised just before this Modal closed must not vanish with it.
      const left = dialogRef.current;
      dialogRef.current = null;
      const queued = notices.splice(0);
      if (left) queued.unshift(left);
      if (queued.length) {
        const generation = sessionGeneration();
        setTimeout(() => {
          if (generation === sessionGeneration())
            queued.forEach((notice) => host.root?.enqueue(notice));
        }, 500);
      }
    };
  }, [nested, parent, host]);

  function close(button?: AlertButton) {
    const showNext = () => {
      const next = pending.current.shift();
      dialogRef.current = next ? { ...next, keep: true } : null;
      setDialog(dialogRef.current);
    };
    if (!button?.onPress) return showNext();
    // Close the native modal before the action, including when another notice is queued.
    closingForAction.current = true;
    dialogRef.current = null;
    setDialog(null);
    const generation = sessionGeneration();
    setTimeout(() => {
      if (generation !== sessionGeneration()) return;
      try {
        button.onPress?.();
      } finally {
        setTimeout(() => {
          if (generation !== sessionGeneration()) return;
          closingForAction.current = false;
          showNext();
        }, 250);
      }
    }, 250);
  }

  const destructive = dialog?.buttons.some((button) => button.style === 'destructive');
  const warning = dialog?.tone === 'warning';
  const icon =
    dialog?.tone === 'success'
      ? 'checkmark-circle'
      : destructive || warning
        ? 'warning'
        : 'information-circle';
  const accent =
    dialog?.tone === 'success'
      ? 'text-success'
      : warning
        ? 'text-warning'
        : destructive
          ? 'text-danger'
          : 'text-primary';
  const soft =
    dialog?.tone === 'success'
      ? 'bg-success-soft'
      : warning
        ? 'bg-warning-soft'
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
