import { Pressable, Text, TextInput, View } from 'react-native';

import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import { QUICK_SUGGESTIONS, type RentProperty } from '@/lib/rent-detail';

// Landlord card with quick chat input (web "Card 2" of the visitor column).
export function VisitorOwnerCard({
  landlord,
  message,
  onChangeMessage,
  sending,
  onSend,
}: {
  landlord: RentProperty['landlord'];
  message: string;
  onChangeMessage: (value: string) => void;
  sending: boolean;
  onSend: () => void;
}) {
  const canSend = Boolean(message.trim()) && !sending;
  return (
    <View className="gap-4 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <Avatar uri={landlord.avatar} name={landlord.name} size={56} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-base font-bold text-foreground">
            {landlord.name}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1">
            <Icon name="person-outline" size={12} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">{landlord.role || 'Cá nhân'}</Text>
          </View>
        </View>
      </View>

      <View className="gap-2">
        <View className="min-h-11 flex-row items-center rounded-xl border border-border bg-muted px-3 py-1.5">
          <Icon name="chatbubble-outline" size={16} className="text-muted-foreground" />
          <TextInput
            value={message}
            onChangeText={onChangeMessage}
            placeholder="Nhắn hỏi thông tin"
            accessibilityLabel="Nội dung tin nhắn"
            returnKeyType="send"
            onSubmitEditing={() => canSend && onSend()}
            className="flex-1 px-2.5 py-1 text-sm text-foreground placeholder:text-subtle"
          />
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            className={`rounded-full px-3 py-1.5 ${canSend ? 'bg-brand' : 'bg-disabled'}`}>
            <Text className={`text-xs font-bold ${canSend ? 'text-on-brand' : 'text-on-disabled'}`}>
              Gửi
            </Text>
          </Pressable>
        </View>
        <View className="flex-row flex-wrap gap-2 pt-0.5">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => onChangeMessage(suggestion)}
              accessibilityRole="button"
              className="rounded-full border border-border bg-muted px-2.5 py-1">
              <Text className="text-xs text-muted-foreground">{suggestion}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() =>
              onChangeMessage(
                QUICK_SUGGESTIONS[Math.floor(Math.random() * QUICK_SUGGESTIONS.length)]
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Gợi ý khác"
            className="items-center justify-center rounded-full border border-border bg-surface px-1.5 py-1">
            <Icon name="chevron-forward" size={14} className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>

      <View className="gap-2 border-t border-border pt-3">
        <View className="flex-row items-start gap-1.5">
          <Icon name="shield-checkmark-outline" size={14} className="mt-0.5 text-primary" />
          <Text className="flex-1 text-xs leading-5 text-muted-foreground">
            Thông tin chủ nhà và điều khoản thuê cần được xác nhận trước khi đặt cọc.
          </Text>
        </View>
        <View className="flex-row items-start gap-1.5">
          <Icon name="checkmark-circle-outline" size={14} className="mt-0.5 text-primary" />
          <Text className="flex-1 text-xs leading-5 text-muted-foreground">
            Ưu tiên trao đổi trực tiếp qua kênh liên hệ chính thức của HomeSpace.
          </Text>
        </View>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: 'create-outline' | 'layers-outline';
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3 ${primary ? 'bg-brand' : 'border border-border bg-surface'}`}>
      <Icon name={icon} size={18} className={primary ? 'text-on-brand' : 'text-foreground'} />
      <Text className={`text-sm font-bold ${primary ? 'text-on-brand' : 'text-foreground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

// Own-listing card (web "Chính chủ (Bài đăng của bạn)").
export function OwnListingCard({
  landlord,
  canEdit,
  onEdit,
  onManage,
}: {
  landlord: RentProperty['landlord'];
  canEdit: boolean;
  onEdit: () => void;
  onManage: () => void;
}) {
  return (
    <View className="gap-4 rounded-2xl border border-primary-border bg-primary-soft p-4">
      <View className="flex-row items-center gap-3">
        <Avatar uri={landlord.avatar} name={landlord.name} size={48} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-bold text-foreground">
            {landlord.name}
          </Text>
          <Text className="text-xs font-semibold text-primary">Chính chủ (Bài đăng của bạn)</Text>
        </View>
      </View>
      <View className="gap-1 rounded-xl border border-border bg-surface p-3.5">
        <Text className="text-sm font-bold text-foreground">
          Bạn đang xem bài đăng của chính mình
        </Text>
        <Text className="text-xs leading-5 text-muted-foreground">
          Các nút liên hệ, đặt lịch xem nhà sẽ tự động ẩn với bạn và chỉ hiển thị đối với khách tìm
          thuê.
        </Text>
      </View>
      <View className="gap-2">
        {canEdit ? (
          <ActionButton icon="create-outline" label="Chỉnh sửa bài đăng" primary onPress={onEdit} />
        ) : null}
        <ActionButton icon="layers-outline" label="Quản lý tin đăng" onPress={onManage} />
      </View>
    </View>
  );
}
