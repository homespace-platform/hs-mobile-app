import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';

import Icon from '@/components/Icon';
import type { RentOption } from '@/lib/rent-filter';

const GAP = 4;
const MENU_MIN_WIDTH = 220;
const MARGIN = 12;

// A select-like control (like the web "Tin mới nhất ▾"): the menu opens right under the button and closes on
// pick or outside tap. Measured in window coordinates; statusBarTranslucent keeps Android's y offset consistent.
export default function SortDropdown({
  options,
  value,
  onChange,
  accessibilityLabel = 'Sắp xếp',
}: {
  options: RentOption[];
  value: string;
  onChange: (id: string) => void;
  accessibilityLabel?: string;
}) {
  const button = useRef<View>(null);
  const { width: screenWidth } = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number } | null>(null);
  const selected = options.find((item) => item.id === value) ?? options[0];

  const open = () =>
    button.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ x, y: y + height + GAP, width })
    );
  const close = () => setAnchor(null);

  const menuWidth = anchor ? Math.max(anchor.width, MENU_MIN_WIDTH) : MENU_MIN_WIDTH;
  const left = anchor ? Math.max(MARGIN, Math.min(anchor.x, screenWidth - menuWidth - MARGIN)) : 0;

  return (
    <>
      <Pressable
        ref={button}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${selected?.label ?? ''}`}
        accessibilityState={{ expanded: anchor !== null }}
        className="min-h-11 flex-1 flex-row items-center rounded-xl border border-border bg-surface px-3">
        <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-foreground">
          {selected?.label}
        </Text>
        <Icon
          name={anchor ? 'chevron-up' : 'chevron-down'}
          size={16}
          className="ml-1 text-muted-foreground"
        />
      </Pressable>

      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={close}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Đóng danh sách sắp xếp"
          className="flex-1">
          {anchor ? (
            <View
              accessibilityViewIsModal
              className="absolute overflow-hidden rounded-xl border border-border bg-surface"
              style={{ top: anchor.y, left, width: menuWidth }}>
              {options.map((item, index) => {
                const active = item.id === value;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      close();
                      if (!active) onChange(item.id);
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    className={`min-h-12 flex-row items-center px-4 ${index ? 'border-t border-border' : ''} ${active ? 'bg-primary-soft' : ''}`}>
                    <Text
                      className={`flex-1 text-sm ${active ? 'font-bold text-primary' : 'text-foreground'}`}>
                      {item.label}
                    </Text>
                    {active ? <Icon name="checkmark" size={18} className="text-primary" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
