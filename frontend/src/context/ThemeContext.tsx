import React, { createContext, useContext, useState, useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  themeBg: string;
  header: string;
  surface: string;
  secondarySurface: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryBorder: string;
  gold: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  red: string; // compatibility
  info: string;
  infoBg: string;
  text: string;
  themeText: string;
  textSecondary: string;
  muted: string;
  placeholder: string;
  input: string;
  themeInput: string;
  border: string;
  inputBorder: string;
  divider: string;
  card: string;
  section: string;
  modal: string;
  primaryButtonBg: string;
  primaryButtonText: string;
  secondaryButtonBg: string;
  secondaryButtonText: string;
  navBg: string;
  navActive: string;
  navInactive: string;
  navBorder: string;
  overlay: string;
}

export const darkColors: ThemeColors = {
  bg: '#18181B',
  themeBg: '#18181B',
  header: '#111114',
  surface: '#1E1E1E',
  secondarySurface: '#27272A',
  primary: '#D4AF37', // Luxury Gold
  primaryHover: '#E5C158',
  primaryLight: 'rgba(212, 175, 55, 0.15)',
  primaryBorder: 'rgba(212, 175, 55, 0.3)',
  gold: '#D4AF37',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.15)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.15)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.15)',
  red: '#EF4444',
  info: '#D4AF37',
  infoBg: 'rgba(212, 175, 55, 0.15)',
  text: '#FFFFFF',
  themeText: '#FFFFFF',
  textSecondary: '#D4D4D8',
  muted: '#A1A1AA',
  placeholder: '#71717A',
  input: '#1E1E1E',
  themeInput: '#27272A',
  border: 'rgba(255, 255, 255, 0.08)',
  inputBorder: 'rgba(255, 255, 255, 0.12)',
  divider: 'rgba(255, 255, 255, 0.08)',
  card: '#1E1E1E',
  section: '#18181B',
  modal: '#18181B',
  primaryButtonBg: '#D4AF37',
  primaryButtonText: '#000000',
  secondaryButtonBg: '#27272A',
  secondaryButtonText: '#FFFFFF',
  navBg: 'rgba(24, 24, 27, 0.95)',
  navActive: '#D4AF37',
  navInactive: '#A1A1AA',
  navBorder: 'rgba(255, 255, 255, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.75)',
};

export const lightColors: ThemeColors = {
  bg: '#F3F4F6',
  themeBg: '#F3F4F6',
  header: '#FAFAFB',
  surface: '#FAFAFB',
  secondarySurface: '#EAECEF',
  primary: '#7C3AED', // Brand Purple
  primaryHover: '#6D28D9',
  primaryLight: '#EDE9FE',
  primaryBorder: '#DDD6FE',
  gold: '#7C3AED', // mapped to brand primary
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  red: '#EF4444',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  text: '#18181B',
  themeText: '#18181B',
  textSecondary: '#52525B',
  muted: '#71717A',
  placeholder: '#71717A',
  input: '#FFFFFF',
  themeInput: '#F3F4F6',
  border: '#E2E4E8',
  inputBorder: '#CBD5E1',
  divider: '#E2E4E8',
  card: '#FAFAFB',
  section: '#FFFFFF',
  modal: '#FFFFFF',
  primaryButtonBg: '#7C3AED',
  primaryButtonText: '#FFFFFF',
  secondaryButtonBg: '#EAECEF',
  secondaryButtonText: '#18181B',
  navBg: 'rgba(255, 255, 255, 0.95)',
  navActive: '#7C3AED',
  navInactive: '#71717A',
  navBorder: '#E2E4E8',
  overlay: 'rgba(0, 0, 0, 0.45)',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = '@bar_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeState] = useState<ThemeMode>('light');

  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setThemeState(saved);
        }
      } catch (e) {
        console.warn('Failed to load theme mode from AsyncStorage', e);
      }
    };
    loadSavedTheme();
  }, []);

  useEffect(() => {
    const isDark = themeMode === 'dark';
    const activeColors = isDark ? darkColors : lightColors;
    
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(activeColors.bg, true);
    }
  }, [themeMode]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save theme mode to AsyncStorage', e);
    }
  };

  const toggleTheme = () => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  };

  const isDark = themeMode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ 
      themeMode, 
      theme: themeMode, 
      isDark, 
      colors, 
      toggleTheme, 
      setThemeMode, 
      setTheme: setThemeMode 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const useAppTheme = useTheme;
export default ThemeProvider;
