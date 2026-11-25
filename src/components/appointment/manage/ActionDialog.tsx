// The web reason/note dialogs: owner approve, reject, cancel, reject change; renter cancel.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BOOKING_LIMITS } from '@/lib/appointment';

import Overlay from './Overlay';

/** Give it a new `key` per appointment and action so the input resets on open. */
export default function ActionDialog({
  title,
  message,
  placeholder,
  confirmLabel,
  busyLabel,
  danger,
  busy,
  error,
  onBack,
  onConfirm,
}: {
  title: string;
  message: ReactNode;
  placeholder: string;
  confirmLabel: string;
  busyLabel: string;
  danger: boolean;
  busy: boolean;
  /** Validation or server error, inline so it is visible over this layer. */
  error: string | null;
  onBack: () => void;
  onConfirm: (input: string) => void;
}) {
  const [input, setInput] = useState('');
  return (
    <Overlay>
      <View className="max-h-full w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="p-5">
          <Text accessibilityRole="header" className="text-base font-bold text-foreground">
            {title}
          </Text>
          <Text className="mt-3 text-sm leading-5 text-muted-foreground">{message}</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={placeholder}
            accessibilityLabel={title}
            editable={!busy}
            multiline
            numberOfLines={3}
            maxLength={BOOKING_LIMITS.reasonLength}
            textAlignVertical="top"
            className="mt-3 min-h-24 rounded-xl border border-border bg-surface p-3 text-sm text-foreground selection:text-primary placeholder:text-subtle"
          />
          {error ? (
            <Text accessibilityRole="alert" className="mt-2 text-sm text-danger">
              {error}
            </Text>
          ) : null}
          <View className="mt-4 flex-row flex-wrap justify-end gap-2">
            <Pressable
              onPress={onBack}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              className={`min-h-11 justify-center rounded-xl px-4 ${busy ? 'opacity-50' : ''}`}>
              <Text className="text-sm font-semibold text-muted-foreground">Quay lại</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(input)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              className={`min-h-11 justify-center rounded-xl px-4 ${danger ? 'border border-danger bg-danger-soft' : 'bg-brand'} ${busy ? 'opacity-50' : ''}`}>
              <Text className={`text-sm font-bold ${danger ? 'text-danger' : 'text-on-brand'}`}>
                {busy ? busyLabel : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Overlay>
  );
}
