// Mobile counterpart of hs-web-app components/rental/DetailTabs.tsx.
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  /** Small count/dot on the tab, e.g. the number of things waiting for the viewer. */
  badge?: number | string | null;
  /** Hide tabs that do not apply to the current state instead of showing them empty. */
  hidden?: boolean;
}

/** testID of a tab button. */
export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;

/** Sideways-scrolling tab bar; the screen renders only the active section below it. */
export default function DetailTabs<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix = 'detail',
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  idPrefix?: string;
}) {
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  const reveal = (id: string) =>
    scroll.current?.scrollTo({ x: Math.max(0, (offsets.current[id] ?? 0) - 48) });
  // A deep link can select a tab that is off screen.
  useEffect(() => reveal(active), [active]);

  return (
    <View className="border-b border-border">
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel="Các mục của hồ sơ">
        {tabs
          .filter((tab) => !tab.hidden)
          .map((tab) => {
            const selected = tab.id === active;
            return (
              <Pressable
                key={tab.id}
                testID={tabId(idPrefix, tab.id)}
                onPress={() => onChange(tab.id)}
                onLayout={(event) => {
                  offsets.current[tab.id] = event.nativeEvent.layout.x;
                  if (selected) reveal(tab.id);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className="min-h-12 flex-row items-center gap-2 px-4 active:bg-muted">
                <Text
                  className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                  {tab.label}
                </Text>
                {tab.badge ? (
                  <View className="min-w-5 items-center rounded-full bg-danger-solid px-1.5">
                    <Text className="text-xs font-bold leading-5 text-on-danger-solid">
                      {tab.badge}
                    </Text>
                  </View>
                ) : null}
                <View
                  className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full ${selected ? 'bg-primary' : 'bg-transparent'}`}
                />
              </Pressable>
            );
          })}
      </ScrollView>
    </View>
  );
}
