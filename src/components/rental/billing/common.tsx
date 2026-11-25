// Small device pieces shared by the billing components.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import ActionButton from '@/components/rental/shared/ActionButton';
import EvidencePicker from '@/components/rental/shared/EvidencePicker';
import Icon from '@/components/Icon';
import { openUrl, useToast } from '@/components/rental/onboarding/common';
import { getApiErrorMessage } from '@/lib/rental/apiError';
import storageService from '@/services/rental/storage.service';
import type { PaymentRequest } from '@/types/rental/payment-request.type';

import { bindProof, createActionLock, PROOF_STALE, proofFor, type BoundProof } from './logic';

export { Checkbox, ToneBox, useToast } from '@/components/rental/onboarding/common';

/** False once the component is gone: late answers are dropped and nothing more is sent. */
export function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return useCallback(() => alive.current, []);
}

/** A stable single-action lock plus the state that disables the buttons while it is held. */
export function useActionLock() {
  const [lock] = useState(createActionLock);
  return lock;
}

/**
 * Web `window.open(viewUrl)` for a private storage object. The browser is not opened when the answer
 * comes after the link's screen was left or `isCurrent` turned false.
 */
export function useOpenStorage() {
  const toast = useToast();
  const isAlive = useAlive();
  return useCallback(
    async (storageId: string, fallback: string, isCurrent: () => boolean) => {
      const wanted = () => isAlive() && isCurrent();
      try {
        const url = await storageService.getViewUrl(storageId);
        if (wanted()) await openUrl(url);
      } catch (error) {
        if (wanted()) toast.error(getApiErrorMessage(error, fallback));
      }
    },
    [toast, isAlive]
  );
}

/** A text-like link button, 44pt tall. */
export function LinkButton({
  label,
  onPress,
  disabled,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={`min-h-11 justify-center self-start active:opacity-70 ${disabled ? 'opacity-50' : ''}`}>
      <Text className={`text-sm font-bold underline ${danger ? 'text-danger' : 'text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Numbered "view this file" buttons: "Xem chứng từ 1", "Xem chứng cứ 2"… */
export function StorageLinks({
  ids,
  label,
  fallback,
  suffix = '',
}: {
  ids?: string[];
  label: string;
  fallback: string;
  suffix?: string;
}) {
  const open = useOpenStorage();
  const shown = useRef(ids);
  useEffect(() => {
    shown.current = ids;
  });
  if (!ids?.length) return null;
  return (
    <View className="flex-row flex-wrap gap-x-4">
      {ids.map((id, index) => (
        <LinkButton
          key={`${id}:${index}`}
          label={`${label} ${index + 1}${suffix}`}
          onPress={() => void open(id, fallback, () => !!shown.current?.includes(id))}
        />
      ))}
    </View>
  );
}

/** Multi-line text with the web's maxLength and placeholder. */
export function TextArea({
  className = '',
  disabled,
  ...props
}: Omit<ComponentProps<typeof TextInput>, 'className' | 'editable'> & {
  accessibilityLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <TextInput
      multiline
      textAlignVertical="top"
      editable={!disabled}
      {...props}
      className={`min-h-24 rounded-xl border border-border bg-background p-3 text-base text-foreground selection:text-primary placeholder:text-subtle ${disabled ? 'opacity-60' : ''} ${className}`}
    />
  );
}

/** A one-line input. */
export function LineInput({
  disabled,
  className = '',
  ...props
}: Omit<ComponentProps<typeof TextInput>, 'className' | 'editable'> & {
  accessibilityLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <TextInput
      editable={!disabled}
      {...props}
      className={`min-h-12 rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground selection:text-primary placeholder:text-subtle ${disabled ? 'opacity-60' : ''} ${className}`}
    />
  );
}

/** Days (web type=number min=1 max=30). Keeps the text as typed or pasted; see `parseDays`. */
export function DaysInput({
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  return (
    <LineInput
      value={value}
      onChangeText={onChange}
      // No maxLength: it would cut a pasted value into a different, valid one.
      keyboardType="number-pad"
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      className="w-28"
    />
  );
}

/**
 * One transfer proof (image or PDF) and its send button. The button stays locked while a picker is
 * open (RB-01). Give it `key={payment.id}`: a late pick then can never reach another payment.
 * The file is bound to the transfer data it was picked for: after a change it must be picked again.
 */
export function ProofField({
  payment,
  proof,
  onProof,
  label,
  sizeMessage,
  busy,
  onSend,
}: {
  payment: PaymentRequest;
  proof: BoundProof | undefined;
  onProof: (proof: BoundProof | undefined) => void;
  label: string;
  sizeMessage: string;
  busy: boolean;
  onSend: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const file = proofFor(proof, payment);
  return (
    <View className="gap-3">
      <EvidencePicker
        label={label}
        value={file ? [file] : []}
        // The picker keeps the callbacks of the render that opened it, so `payment` is that one.
        onChange={(files) => onProof(bindProof(files[0], payment))}
        // A refused replacement must not leave the earlier file ready to send.
        onError={() => onProof(undefined)}
        error={proof && !file ? PROOF_STALE : null}
        messages={sizeMessage}
        types={['image/jpeg', 'image/png', 'image/webp', 'application/pdf']}
        onPickingChange={setPicking}
        disabled={busy}
        camera
        documentLabel="Chọn tệp (PDF)"
      />
      <ActionButton
        label="Tôi đã chuyển khoản"
        icon="send-outline"
        busy={busy}
        disabled={picking}
        onClick={onSend}
      />
    </View>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <Text className="text-sm leading-6 text-secondary">{children}</Text>;
}

export function SectionHeading({
  title,
  icon,
  refreshLabel,
  onRefresh,
}: {
  title: string;
  icon?: ComponentProps<typeof Icon>['name'];
  refreshLabel?: string;
  onRefresh?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2">
      {icon ? <Icon name={icon} size={20} className="text-primary" /> : null}
      <Text accessibilityRole="header" className="flex-1 text-lg font-bold text-foreground">
        {title}
      </Text>
      {onRefresh ? (
        <Pressable
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel={refreshLabel}
          className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface active:bg-muted">
          <Icon name="refresh" size={18} className="text-foreground" />
        </Pressable>
      ) : null}
    </View>
  );
}
