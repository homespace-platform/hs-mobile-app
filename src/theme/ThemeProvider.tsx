import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme } from 'nativewind';

export type ThemePreference = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'homespace.theme';
const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const changed = useRef(false);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((value) => {
        if (!active || changed.current) return;
        const saved = value === 'light' || value === 'dark' ? value : 'system';
        setPreferenceState(saved);
        setColorScheme(saved);
      })
      .catch(() => {
        // Theme still follows the system when native storage is unavailable.
      });
    return () => {
      active = false;
    };
    // Restore once; NativeWind's setter is recreated on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setPreference(value: ThemePreference) {
    changed.current = true;
    setPreferenceState(value);
    setColorScheme(value);
    SecureStore.setItemAsync(STORAGE_KEY, value).catch(() => {
      console.warn('Không lưu được giao diện; lựa chọn chỉ áp dụng trong phiên này.');
    });
  }

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      <View className="flex-1 bg-background">
        {children}
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside ThemeProvider');
  return theme;
}
