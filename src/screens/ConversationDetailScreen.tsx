import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Avatar from '@/components/Avatar';
import { updateParticipantRole, type ChatConversation } from '@/services/chatApi';
import { listingImage } from '@/services/listingApi';

const ROLE_OPTIONS = [
  { value: 'TENANT' as const, label: 'Người hỏi thuê', icon: 'person-outline' as const },
  { value: 'LANDLORD' as const, label: 'Chủ thuê', icon: 'home-outline' as const },
];

function roleLabel(role?: ChatConversation['participantRole']) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? 'Chưa gán nhãn';
}

export default function ConversationDetailScreen({
  conversation,
  onBack,
  onUpdated,
}: {
  conversation: ChatConversation;
  onBack: () => void;
  onUpdated: (conversation: ChatConversation) => void;
}) {
  const [role, setRole] = useState(conversation.participantRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(nextRole: 'TENANT' | 'LANDLORD') {
    if (nextRole === role || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateParticipantRole(conversation.id, nextRole);
      setRole(updated.participantRole);
      onUpdated({ ...conversation, ...updated });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể cập nhật nhãn');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-slate-200 bg-white px-4 py-3">
        <Pressable onPress={onBack} className="mr-3 px-1 py-2">
          <Ionicons name="chevron-back" size={26} color="#1e293b" />
        </Pressable>
        <Text className="text-lg font-bold text-slate-900">Chi tiết trò chuyện</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 py-6">
        <View className="items-center rounded-3xl border border-slate-200 bg-white p-6">
          <Avatar
            uri={conversation.participantAvatar}
            name={conversation.participantName || conversation.participantEmail || 'HomeSpace'}
            size={76}
          />
          <Text className="mt-3 text-xl font-bold text-slate-900">
            {conversation.participantName ||
              conversation.participantEmail ||
              'Người dùng HomeSpace'}
          </Text>
          {conversation.participantEmail ? (
            <Text className="mt-1 text-sm text-slate-500">{conversation.participantEmail}</Text>
          ) : null}
          <View className="mt-3 rounded-full bg-blue-50 px-3 py-1.5">
            <Text className="text-xs font-bold text-blue-700">{roleLabel(role)}</Text>
          </View>
        </View>

        <View className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
          <Text className="text-base font-bold text-slate-900">Nhãn participant</Text>
          <Text className="mt-1 text-sm leading-5 text-slate-500">
            Gán vai trò để dễ phân loại người hỏi thuê và chủ thuê.
          </Text>
          <View className="mt-4 gap-3">
            {ROLE_OPTIONS.map((option) => {
              const selected = option.value === role;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => handleRoleChange(option.value)}
                  className={`flex-row items-center rounded-2xl border p-4 ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <Ionicons name={option.icon} size={21} color={selected ? '#2563eb' : '#64748b'} />
                  <Text
                    className={`ml-3 flex-1 text-sm font-bold ${selected ? 'text-blue-700' : 'text-slate-700'}`}>
                    {option.label}
                  </Text>
                  {saving && selected ? (
                    <ActivityIndicator color="#2563eb" />
                  ) : selected ? (
                    <Ionicons name="checkmark-circle" size={21} color="#2563eb" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {error ? <Text className="mt-3 text-xs text-red-600">{error}</Text> : null}
        </View>

        {conversation.listing ? (
          <View className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
            <Text className="text-base font-bold text-slate-900">Bài đăng liên quan</Text>
            <View className="mt-3 flex-row">
              <Image
                source={{ uri: listingImage(conversation.listing.image) }}
                className="h-20 w-24 rounded-2xl bg-slate-100"
              />
              <View className="ml-3 flex-1 justify-center">
                <Text className="text-sm font-bold text-slate-900" numberOfLines={2}>
                  {conversation.listing.title}
                </Text>
                <Text className="mt-1 text-xs font-bold text-blue-700">
                  {conversation.listing.price}
                </Text>
                <Text className="mt-1 text-xs text-slate-500" numberOfLines={1}>
                  {conversation.listing.location}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
