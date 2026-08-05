import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from './src/context/ThemeContext';
import { BarProvider } from './src/context/BarContext';
import MainAppShell from './src/app/navigation/MainAppShell';
import './global.css';

export default function App() {
  useEffect(() => {
    if (Platform.OS !== 'web' && !__DEV__) {
      const checkForUpdates = async () => {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        } catch (err) {
          console.warn('OTA update check error:', err);
        }
      };
      checkForUpdates();
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ThemeProvider>
        <BarProvider>
          <MainAppShell />
        </BarProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
