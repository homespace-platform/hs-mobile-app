import { useMemo, useRef, type ComponentProps } from 'react';
import { ActivityIndicator, Animated, PanResponder, Pressable, Text, View } from 'react-native';
import Icon from '@/components/Icon';
import BankLogo from '@/components/bank/BankLogo';
import type { Bank, BankAccount } from '@/services/bankAccountApi';

type IconName = ComponentProps<typeof Icon>['name'];

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`min-h-9 flex-row items-center rounded-lg px-2.5 ${danger ? '' : 'border border-border'} ${disabled ? 'opacity-50' : ''}`}>
      <Icon name={icon} size={15} className={danger ? 'text-danger' : 'text-foreground'} />
      <Text className={`ml-1 text-xs font-medium ${danger ? 'text-danger' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One bank account: masked/revealed number, holder, default badges, edit / set-default / delete actions. */
export default function BankAccountCard({
  account,
  bank,
  revealedNumber,
  revealing,
  busy,
  onToggleReveal,
  onEdit,
  onSetIncoming,
  onSetRefund,
  onDelete,
}: {
  account: BankAccount;
  bank?: Bank;
  /** Full number while revealed (auto re-masked by the screen), else null. */
  revealedNumber: string | null;
  revealing: boolean;
  busy: boolean;
  onToggleReveal: () => void;
  onEdit: () => void;
  onSetIncoming: () => void;
  onSetRefund: () => void;
  onDelete: () => void;
}) {
  const offset = useRef(new Animated.Value(0)).current;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderMove: (_, gesture) => offset.setValue(Math.max(-88, Math.min(0, gesture.dx))),
        onPanResponderRelease: (_, gesture) => {
          Animated.spring(offset, {
            toValue: gesture.dx < -38 ? -88 : 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [offset]
  );
  const revealed = revealedNumber !== null;

  return (
    <View className="mt-3 overflow-hidden rounded-2xl bg-danger-soft">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xóa tài khoản ngân hàng"
        disabled={busy}
        onPress={onDelete}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 88,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="bg-danger-soft">
        <Icon name="trash-outline" size={22} className="text-danger" />
        <Text className="mt-1 text-xs font-bold text-danger">Xóa</Text>
      </Pressable>
      <Animated.View
        {...pan.panHandlers}
        style={{ transform: [{ translateX: offset }] }}
        className="rounded-2xl border border-border bg-surface p-4">
        <View className="flex-row items-center">
          <BankLogo logo={bank?.logo} code={account.bankCode} />
          <View className="ml-3 min-w-0 flex-1">
            <Text numberOfLines={2} className="text-sm font-bold text-foreground">
              {bank?.shortName ?? account.bankCode}
            </Text>
            <Text numberOfLines={2} className="text-xs text-muted-foreground">
              {account.bankName}
            </Text>
            {account.status === 'ACTIVE' ? (
              <View className="mt-1 flex-row items-center self-start rounded-full bg-success-soft px-2 py-0.5">
                <Icon name="checkmark-circle" size={12} className="text-success" />
                <Text className="ml-1 text-[11px] font-semibold text-success">Hoạt động</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="my-3 gap-1.5 border-y border-border py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">Số tài khoản</Text>
            <View className="ml-3 min-w-0 flex-1 flex-row items-center justify-end">
              <Text
                selectable={revealed}
                numberOfLines={1}
                className="shrink font-mono text-sm font-bold tracking-wider text-foreground">
                {revealedNumber ?? account.accountNumber}
              </Text>
              <Pressable
                onPress={onToggleReveal}
                disabled={revealing}
                accessibilityRole="button"
                accessibilityLabel={revealed ? 'Ẩn số tài khoản' : 'Hiện số tài khoản'}
                className={`h-10 w-10 items-center justify-center ${revealing ? 'opacity-50' : ''}`}>
                {revealing ? (
                  <ActivityIndicator size="small" className="text-primary" />
                ) : (
                  <Icon
                    name={revealed ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    className="text-muted-foreground"
                  />
                )}
              </Pressable>
            </View>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">Chủ tài khoản</Text>
            <Text
              numberOfLines={1}
              className="ml-3 min-w-0 flex-1 text-right text-xs font-bold uppercase text-foreground">
              {account.accountHolderName}
            </Text>
          </View>
        </View>

        <View className="min-h-6 flex-row flex-wrap gap-1.5">
          {account.defaultForIncomingPayments ? (
            <View className="rounded-lg bg-success-soft px-2 py-0.5">
              <Text className="text-[11px] font-semibold text-success">Nhận tiền mặc định</Text>
            </View>
          ) : null}
          {account.defaultForRefunds ? (
            <View className="rounded-lg bg-primary-soft px-2 py-0.5">
              <Text className="text-[11px] font-semibold text-primary">Hoàn tiền mặc định</Text>
            </View>
          ) : null}
        </View>

        <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
          <ActionButton icon="create-outline" label="Sửa" onPress={onEdit} disabled={busy} />
          {!account.defaultForIncomingPayments ? (
            <ActionButton
              icon="arrow-down-circle-outline"
              label="Đặt nhận tiền"
              onPress={onSetIncoming}
              disabled={busy}
            />
          ) : null}
          {!account.defaultForRefunds ? (
            <ActionButton
              icon="arrow-undo-outline"
              label="Đặt hoàn tiền"
              onPress={onSetRefund}
              disabled={busy}
            />
          ) : null}
          <View className="ml-auto">
            <ActionButton
              icon="trash-outline"
              label="Xóa"
              onPress={onDelete}
              disabled={busy}
              danger
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
