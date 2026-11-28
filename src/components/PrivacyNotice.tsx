import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDialog } from '@/components/AppDialog';
import Icon from '@/components/Icon';
import { webBaseUrl } from '@/config/env';

const NOTICE_KEY = 'hs:privacy-notice';
const NOTICE_VERSION = '1';
const policyBaseUrl = (webBaseUrl || 'https://www.homespace.id.vn').replace(/\/+$/, '');
const policies = [
  { path: '/privacy', label: 'Chính sách quyền riêng tư' },
  { path: '/terms', label: 'Điều khoản sử dụng' },
];

export function PrivacyPolicyLinks() {
  const showDialog = useDialog();

  return (
    <View className="divide-y divide-border">
      {policies.map(({ path, label }) => (
        <Pressable
          key={path}
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL(`${policyBaseUrl}${path}`).catch(() => {
              showDialog('Không mở được liên kết', 'Vui lòng thử lại sau.');
            });
          }}
          className="min-h-11 flex-row items-center gap-3 px-4 py-2">
          <Text className="flex-1 text-sm font-semibold text-primary">{label}</Text>
          <Icon name="open-outline" size={16} className="text-subtle" />
        </Pressable>
      ))}
    </View>
  );
}

export default function PrivacyNotice({
  loading,
  signedIn,
}: {
  loading: boolean;
  signedIn: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(NOTICE_KEY)
      .catch(() => null)
      .then((version) => {
        if (active) setVisible(version !== NOTICE_VERSION);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading || !visible) return null;

  function acknowledge() {
    setVisible(false);
    void AsyncStorage.setItem(NOTICE_KEY, NOTICE_VERSION).catch(() => undefined);
  }

  return (
    <SafeAreaView
      pointerEvents="box-none"
      className="absolute inset-0 z-30 items-center justify-end px-3 py-3">
      <ScrollView
        bounces={false}
        className={`w-full max-w-md shrink grow-0 rounded-2xl border border-border bg-surface shadow-lg ${signedIn ? 'mb-16' : ''}`}
        contentContainerClassName="p-4">
        <View className="flex-row items-start gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
            <Icon name="shield-outline" size={19} className="text-primary" />
          </View>
          <View className="flex-1 gap-1">
            <Text accessibilityRole="header" className="text-base font-bold text-foreground">
              Quyền riêng tư và điều khoản
            </Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              Xem cách HomeSpace xử lý dữ liệu cá nhân và quy định sử dụng dịch vụ.
            </Text>
          </View>
        </View>
        <View className="mt-3 overflow-hidden rounded-xl border border-border">
          <PrivacyPolicyLinks />
        </View>
        <View className="mt-3 flex-row flex-wrap justify-end gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => setVisible(false)}
            className="min-h-11 justify-center rounded-xl px-3 py-2">
            <Text className="text-sm font-semibold text-foreground">Để sau</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={acknowledge}
            className="min-h-11 justify-center rounded-xl bg-brand px-4 py-2">
            <Text className="text-sm font-semibold text-on-brand">Tôi đã hiểu</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
