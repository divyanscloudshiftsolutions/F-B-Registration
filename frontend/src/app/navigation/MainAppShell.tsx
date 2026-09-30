import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  BackHandler,
  useWindowDimensions,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBar } from '../../context/BarContext';
import { UserRole } from '../../types/bar_types';
import { useTheme } from '../../context/ThemeContext';
import { AppIcon } from '../../components/common/AppIcon';
import { AnimatedToast } from '../../components/common/AnimatedToast';
import { AlertModal } from '../../components/common/AlertModal';
import { SystemHeader } from '../../components/common/SystemHeader';

// Screen imports
import { SplashScreen } from '../../features/auth/screens/SplashScreen';
import { LoginScreen } from '../../features/auth/screens/LoginScreen';
import { CheckInWizard } from '../../features/checkin/screens/CheckInWizard';
import { BartenderPortal } from '../../features/bartender/screens/BartenderPortal';
import { TablesPortal } from '../../features/tables/screens/TablesPortal';
import { AdminPortal } from '../../features/admin/screens/AdminPortal';
import { QuickAttendanceScreen } from '../../features/checkin/screens/QuickAttendanceScreen';
import { WaiterStationScreen } from '../../features/waiter/screens/WaiterStationScreen';
import { KitchenKDSScreen } from '../../features/kds/screens/KitchenKDSScreen';

// Customer Flow Screens
import { CustomerLandingScreen } from '../../features/customer/screens/CustomerLandingScreen';
import { CustomerAccessScreen } from '../../features/customer/screens/CustomerAccessScreen';

export const MainAppShell: React.FC = () => {
  const { colors, isDark } = useTheme();
  const {
    currentScreen,
    activeTab,
    toasts,
    user,
    logout,
    setTab,
    markNotificationsAsRead,
    isOverlayActive,
    swipeLocked,
    fetchLatestState,
    setScreen,
  } = useBar();

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [showSplash, setShowSplash] = useState(true);
  const [isNotifsOpen, setIsNotifsOpen] = useState(false);
  const [customerToken, setCustomerToken] = useState<string | null>(null);

  // App mode: 'CUSTOMER_LANDING' | 'CUSTOMER_SESSION' | 'STAFF'
  const [appMode, setAppMode] = useState<'CUSTOMER_LANDING' | 'CUSTOMER_SESSION' | 'STAFF'>('CUSTOMER_LANDING');

  const scrollViewRef = useRef<ScrollView>(null);

  // Sync state on tab change
  useEffect(() => {
    if (currentScreen === 'app' && user) {
      fetchLatestState().catch(() => {});
    }
  }, [activeTab, currentScreen, user, fetchLatestState]);

  // Roles determination
  const isUserRecep = user?.role === UserRole.RECEPTIONIST;
  const isUserAdmin = user?.role === UserRole.ADMIN;
  const isUserManager = user?.role === UserRole.MANAGER;
  const isUserBartender = user?.role === UserRole.BARTENDER;
  const isUserWaiter = (user?.role as string) === 'WAITER';
  const isUserChef = (user?.role as string) === 'CHEF' || (user?.role as string) === 'KITCHEN';

  const allowedTabs = useMemo(() => {
    const tabs: ('checkin' | 'bartender' | 'tables' | 'admin' | 'waiter' | 'kds')[] = [];
    if (isUserAdmin || isUserRecep) tabs.push('checkin');
    if (isUserAdmin || isUserBartender || isUserRecep) tabs.push('bartender');
    if (isUserAdmin || isUserRecep || isUserManager) tabs.push('tables');
    if (isUserAdmin || isUserWaiter) tabs.push('waiter');
    if (isUserAdmin || isUserChef) tabs.push('kds');
    if (isUserAdmin || isUserManager) tabs.push('admin');

    if (tabs.length === 0) {
      tabs.push('checkin', 'tables');
    }
    return tabs;
  }, [user, isUserAdmin, isUserRecep, isUserManager, isUserBartender, isUserWaiter, isUserChef]);

  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user && activeTab) {
      setVisitedTabs(new Set([activeTab]));
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (activeTab && allowedTabs.length > 0) {
      setVisitedTabs((prev) => {
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
    }
  }, [activeTab, allowedTabs]);

  const handleScrollEnd = (e: any) => {
    const contentOffset = e.nativeEvent.contentOffset.x;
    const tabIndex = Math.round(contentOffset / width);
    if (tabIndex >= 0 && tabIndex < allowedTabs.length) {
      const targetTab = allowedTabs[tabIndex];
      if (targetTab !== activeTab) {
        setTab(targetTab);
      }
    }
  };

  const renderTabContent = (tab: string, isSelected: boolean) => {
    switch (tab) {
      case 'checkin':
        return <CheckInWizard isActive={isSelected} />;
      case 'bartender':
        return <BartenderPortal isActive={isSelected} />;
      case 'tables':
        return <TablesPortal isActive={isSelected} />;
      case 'waiter':
        return <WaiterStationScreen onLogout={logout} />;
      case 'kds':
        return <KitchenKDSScreen onLogout={logout} />;
      case 'admin':
        return <AdminPortal isActive={isSelected} />;
      default:
        return <View style={{ flex: 1 }} />;
    }
  };

  // 1. Splash Screen
  if (showSplash && currentScreen === 'splash') {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // 2. Customer Landing Mode
  if (appMode === 'CUSTOMER_LANDING') {
    return (
      <CustomerLandingScreen
        onSessionFound={(token) => {
          setCustomerToken(token);
          setAppMode('CUSTOMER_SESSION');
        }}
        onStaffLoginPress={() => setAppMode('STAFF')}
      />
    );
  }

  // 3. Customer Active Session Mode
  if (appMode === 'CUSTOMER_SESSION' && customerToken) {
    return (
      <CustomerAccessScreen
        tokenNumber={customerToken}
        onExitSession={() => {
          setCustomerToken(null);
          setAppMode('CUSTOMER_LANDING');
        }}
      />
    );
  }

  // 4. Staff Flow (Login or Portals)
  if (currentScreen === 'quick_attendance') {
    return <QuickAttendanceScreen />;
  }

  if (currentScreen === 'login' || !user) {
    return (
      <LoginScreen
        onCustomerModePress={() => setAppMode('CUSTOMER_LANDING')}
      />
    );
  }

  // If specific staff direct views
  if (isUserWaiter && allowedTabs.length === 1 && allowedTabs[0] === 'waiter') {
    return <WaiterStationScreen onLogout={logout} />;
  }

  if (isUserChef && allowedTabs.length === 1 && allowedTabs[0] === 'kds') {
    return <KitchenKDSScreen onLogout={logout} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* TOP HEADER */}
      <SystemHeader
        onOpenNotifs={() => {
          markNotificationsAsRead();
          setIsNotifsOpen(true);
        }}
      />

      {/* CORE APP VIEWS SWITCHER */}
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEnabled={allowedTabs.length > 1 && !isOverlayActive && !swipeLocked}
          contentContainerStyle={{ width: width * allowedTabs.length }}
        >
          {allowedTabs.map((tab) => {
            const isSelected = activeTab === tab;
            const isMounted = visitedTabs.has(tab);

            return (
              <View key={tab} style={{ width, flex: 1 }}>
                {isMounted ? renderTabContent(tab, isSelected) : <View style={{ flex: 1 }} />}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* BOTTOM TAB BAR */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: Math.max(10, insets.bottom),
          height: 60 + Math.max(10, insets.bottom),
        }}
        className="flex-row justify-around items-center px-1"
      >
        {allowedTabs.map((tab) => {
          const isActive = activeTab === tab;
          let iconName = 'layout-dashboard';
          let label = 'TAB';

          if (tab === 'checkin') {
            iconName = 'calendar-check';
            label = 'CHECK-IN';
          } else if (tab === 'bartender') {
            iconName = 'wine';
            label = 'BARTENDER';
          } else if (tab === 'tables') {
            iconName = 'layout-grid';
            label = 'TABLES';
          } else if (tab === 'waiter') {
            iconName = 'chef-hat';
            label = 'WAITER';
          } else if (tab === 'kds') {
            iconName = 'flame';
            label = 'KITCHEN';
          } else if (tab === 'admin') {
            iconName = 'shield-alert';
            label = 'ADMIN';
          }

          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setTab(tab as any)}
              activeOpacity={0.7}
              className="items-center justify-center py-1 px-1 flex-1"
            >
              <AppIcon
                name={iconName}
                size={18}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text
                style={{
                  color: isActive ? colors.primary : colors.textMuted,
                  fontWeight: isActive ? '800' : '600',
                }}
                className="text-[9px] uppercase tracking-wider mt-0.5 text-center"
              >
                {label}
              </Text>
              <View
                style={{
                  backgroundColor: isActive ? colors.primary : 'transparent',
                }}
                className="w-1.5 h-1.5 rounded-full mt-0.5"
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Toast Notifications */}
      {toasts && toasts.length > 0 && (
        <View className="absolute top-12 left-4 right-4 z-50">
          {toasts.map((toast) => (
            <AnimatedToast key={toast.id} toast={toast} />
          ))}
        </View>
      )}
    </SafeAreaView>
  );
};

export default MainAppShell;

