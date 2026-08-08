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
  gold: string; // compatibility
  primary: string;
  teal: string; // compatibility
  success: string;
  red: string;
  text: string;
  themeText: string;
  muted: string;
  placeholder: string;
  input: string;
  themeInput: string;
  border: string;
  inputBorder: string;
  divider: string;
  goldButtonText: string;

  // New Tokens
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
  chartPrimary: string;
  chartSecondary: string;
  chartGrid: string;
}

export const darkColors: ThemeColors = {
  bg: '#0A0B10',
  themeBg: '#0A0B10',
  header: '#0A0B10',
  surface: '#1E1E1E',
  secondarySurface: '#252525',
  gold: '#8D6CE5',
  primary: '#8D6CE5',
  teal: '#44F1C6',
  success: '#10B981',
  red: '#EF4444',
  text: 'rgba(255, 255, 255, 0.92)',
  themeText: 'rgba(255, 255, 255, 0.92)',
  muted: '#A0A0A0',
  placeholder: '#8C8C8C',
  input: '#1E1E1E',
  themeInput: '#252525',
  border: '#333333',
  inputBorder: '#333333',
  divider: '#2C2C2C',
  goldButtonText: '#FFFFFF',

  // New Tokens
  card: '#1E1E1E',
  section: '#1E1E1E',
  modal: '#222222',
  primaryButtonBg: '#8D6CE5',
  primaryButtonText: '#FFFFFF',
  secondaryButtonBg: '#252525',
  secondaryButtonText: 'rgba(255, 255, 255, 0.92)',
  navBg: '#0A0B10',
  navActive: '#8D6CE5',
  navInactive: 'rgba(255, 255, 255, 0.60)',
  navBorder: '#333333',
  overlay: 'rgba(0, 0, 0, 0.6)',
  chartPrimary: '#8D6CE5',
  chartSecondary: 'rgba(141, 110, 229, 0.1)',
  chartGrid: '#2C2C2C',
};

export const lightColors: ThemeColors = {
  bg: '#F8FAFC',
  themeBg: '#F8FAFC',
  header: '#FFFFFF',
  surface: '#FFFFFF',
  secondarySurface: '#F1F5F9',
  gold: '#7C3AED',
  primary: '#7C3AED',
  teal: '#16A34A',
  success: '#16A34A',
  red: '#DC2626',
  text: '#0F172A',
  themeText: '#0F172A',
  muted: '#64748B',
  placeholder: '#94A3B8',
  input: '#FFFFFF',
  themeInput: '#F1F5F9',
  border: '#E2E8F0',
  inputBorder: '#CBD5E1',
  divider: '#E2E8F0',
  goldButtonText: '#FFFFFF',

  // New Tokens
  card: '#FFFFFF',
  section: '#FFFFFF',
  modal: '#FFFFFF',
  primaryButtonBg: '#7C3AED',
  primaryButtonText: '#FFFFFF',
  secondaryButtonBg: '#FFFFFF',
  secondaryButtonText: '#0F172A',
  navBg: '#FFFFFF',
  navActive: '#7C3AED',
  navInactive: '#475569',
  navBorder: '#E2E8F0',
  overlay: 'rgba(0, 0, 0, 0.4)',
  chartPrimary: '#7C3AED',
  chartSecondary: 'rgba(124, 58, 237, 0.1)',
  chartGrid: '#E2E8F0',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  theme: ThemeMode; // compatibility
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setTheme: (mode: ThemeMode) => void; // compatibility
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@bar_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeState] = useState<ThemeMode>('dark');

  // Load saved theme from storage on mount
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

  // Update system status bars whenever themeMode changes
  useEffect(() => {
    const isDark = themeMode === 'dark';
    const activeColors = isDark ? darkColors : lightColors;
    
    // Style: light-content for dark theme, dark-content for light theme
    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    
    // Background color (Android only)
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

