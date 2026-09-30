import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { CustomerProvider, useCustomer } from '../../../context/CustomerContext';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { CustomerBottomNav, CustomerNavTab } from '../../../components/customer/CustomerBottomNav';
import { CustomerSessionTimer } from '../../../components/customer/CustomerSessionTimer';
import { LiveNotificationStack } from '../../../components/customer/LiveNotificationStack';
import { ProductCustomizer, CustomizerItem } from '../../../components/customer/ProductCustomizer';
import { CallWaiterSheet } from '../../../components/customer/CallWaiterSheet';
import { MaximizedImageViewer } from '../../../components/customer/MaximizedImageViewer';

import { CustomerHomeScreen } from './CustomerHomeScreen';
import { CustomerMenuScreen } from './CustomerMenuScreen';
import { CustomerCartScreen } from './CustomerCartScreen';
import { CustomerOrdersScreen } from './CustomerOrdersScreen';
import { CustomerRepeatScreen } from './CustomerRepeatScreen';
import { CustomerBillScreen } from './CustomerBillScreen';
import { CustomerAccountScreen } from './CustomerAccountScreen';

interface CustomerPortalInnerProps {
  onExit: () => void;
}

const CustomerPortalInner: React.FC<CustomerPortalInnerProps> = ({ onExit }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const {
    tableNumber,
    tokenNumber,
    cartCount,
    cart,
    addToCart,
    activeRequests,
    setActiveRequests,
    activeOrders,
    isCallWaiterOpen,
    setIsCallWaiterOpen,
    isSessionClosed,
    notifications,
    activeNotification,
    dismissActiveNotification,
    isOrderingLocked,
    sessionData,
  } = useCustomer();

  const [activeTab, setActiveTab] = useState<CustomerNavTab>('home');
  const [activeMenuSection, setActiveMenuSection] = useState<'eat' | 'drink' | 'merch'>('eat');

  // Customizer state
  const [customizingItem, setCustomizingItem] = useState<CustomizerItem | null>(null);

  // Image viewer state
  const [imageModal, setImageModal] = useState<{ url: string; name: string } | null>(null);

  const startTime = sessionData?.token?.startTime || sessionData?.startTime;
  const endTime = sessionData?.token?.endTime || sessionData?.endTime;

  const handleSelectTab = (tab: CustomerNavTab) => {
    if (tab === 'eat' || tab === 'drink' || tab === 'merch') {
      setActiveMenuSection(tab);
      setActiveTab(tab);
    } else {
      setActiveTab(tab);
    }
  };

  const handleOpenCustomizer = (item: CustomizerItem) => {
    setCustomizingItem(item);
  };

  const handleItemImagePress = (url: string, name: string) => {
    setImageModal({ url, name });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* Global Realtime Live Notification Stack */}
      <LiveNotificationStack
        notifications={notifications}
        activeNotification={activeNotification}
        onDismissActive={dismissActiveNotification}
        onNotificationPress={(notif) => {
          if (notif.type.startsWith('order')) {
            setActiveTab('orders');
          } else if (notif.type.startsWith('bill')) {
            setActiveTab('bill');
          }
        }}
      />

      {/* Top Customer Header Bar */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        }}
        className="px-4 py-2.5 flex-row items-center justify-between shadow-xs z-20"
      >
        {/* Table & Brand Badge */}
        <TouchableOpacity
          onPress={() => setActiveTab('account')}
          activeOpacity={0.7}
          className="flex-row items-center gap-2"
        >
          <View
            style={{
              backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(124,58,237,0.1)',
              borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(124,58,237,0.2)',
              borderWidth: 1,
            }}
            className="w-8 h-8 rounded-xl items-center justify-center"
          >
            <AppIcon
              name="sparkles"
              size={16}
              color={isDark ? '#D4AF37' : '#7C3AED'}
            />
          </View>
          <View>
            <Text style={{ color: colors.textPrimary }} className="text-xs font-black">
              Table {tableNumber || '--'}
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium">
              Pegs N Bottles
            </Text>
          </View>
        </TouchableOpacity>

        {/* Center Live Session Timer */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="px-2.5 py-1 rounded-xl"
        >
          <CustomerSessionTimer endTime={endTime} startTime={startTime} />
        </View>

        {/* Right Actions: Theme toggle & Cart button */}
        <View className="flex-row items-center gap-2">
          {/* Cart Icon Button */}
          <TouchableOpacity
            onPress={() => setActiveTab('cart')}
            activeOpacity={0.7}
            style={{
              backgroundColor: activeTab === 'cart'
                ? isDark
                  ? '#D4AF37'
                  : '#7C3AED'
                : isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.04)',
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-9 h-9 rounded-xl items-center justify-center relative"
          >
            <AppIcon
              name="shopping-cart"
              size={17}
              color={
                activeTab === 'cart'
                  ? isDark
                    ? '#000000'
                    : '#FFFFFF'
                  : colors.textPrimary
              }
            />
            {cartCount > 0 && (
              <View
                style={{
                  backgroundColor: isDark ? '#7C3AED' : '#D4AF37',
                }}
                className="absolute -top-1 -right-1 min-w-[17px] h-4 px-1 rounded-full items-center justify-center"
              >
                <Text
                  style={{ color: isDark ? '#FFFFFF' : '#000000' }}
                  className="text-[9px] font-black"
                >
                  {cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Account Profile / Settings */}
          <TouchableOpacity
            onPress={() => setActiveTab('account')}
            activeOpacity={0.7}
            style={{
              backgroundColor: activeTab === 'account'
                ? isDark
                  ? '#D4AF37'
                  : '#7C3AED'
                : isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.04)',
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-9 h-9 rounded-xl items-center justify-center"
          >
            <AppIcon
              name="user"
              size={17}
              color={
                activeTab === 'account'
                  ? isDark
                    ? '#000000'
                    : '#FFFFFF'
                  : colors.textPrimary
              }
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Body Router */}
      <View style={{ flex: 1 }}>
        {activeTab === 'home' && (
          <CustomerHomeScreen
            onNavigateTab={handleSelectTab}
            onOpenItemCustomizer={handleOpenCustomizer}
            onItemImagePress={handleItemImagePress}
          />
        )}

        {(activeTab === 'eat' || activeTab === 'drink' || activeTab === 'merch') && (
          <CustomerMenuScreen
            sectionSlug={activeMenuSection}
            onSectionChange={(sec) => {
              setActiveMenuSection(sec);
              setActiveTab(sec);
            }}
            onOpenItemCustomizer={handleOpenCustomizer}
            onItemImagePress={handleItemImagePress}
          />
        )}

        {activeTab === 'cart' && (
          <CustomerCartScreen
            onExploreMenu={() => handleSelectTab('eat')}
            onOrderSuccess={() => setActiveTab('orders')}
          />
        )}

        {activeTab === 'orders' && (
          <CustomerOrdersScreen
            onExploreMenu={() => handleSelectTab('eat')}
          />
        )}

        {activeTab === 'repeat' && (
          <CustomerRepeatScreen
            onExploreMenu={() => handleSelectTab('eat')}
            onOpenCustomizer={handleOpenCustomizer}
          />
        )}

        {activeTab === 'bill' && (
          <CustomerBillScreen
            onCallWaiterPress={() => setIsCallWaiterOpen(true)}
            onExploreMenu={() => handleSelectTab('eat')}
          />
        )}

        {activeTab === 'account' && (
          <CustomerAccountScreen
            onCallWaiterPress={() => setIsCallWaiterOpen(true)}
            onExitSession={onExit}
          />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <CustomerBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onCallWaiterPress={() => setIsCallWaiterOpen(true)}
        activeRequestsCount={activeRequests.length}
        pendingOrdersCount={activeOrders.length}
      />

      {/* Product Customizer Sheet */}
      <ProductCustomizer
        item={customizingItem}
        open={Boolean(customizingItem)}
        onClose={() => setCustomizingItem(null)}
        onAddToCart={addToCart}
        existingCartQuantity={
          customizingItem
            ? cart
                .filter((ci) => ci.menuItemId === customizingItem.id)
                .reduce((sum, ci) => sum + (ci.quantity || 1), 0)
            : 0
        }
        isOrderingDisabled={isOrderingLocked}
      />

      {/* Call Waiter Sheet */}
      <CallWaiterSheet
        open={isCallWaiterOpen}
        onClose={() => setIsCallWaiterOpen(false)}
        tokenNumber={tokenNumber}
        tableId={sessionData?.token?.tableId}
        activeRequests={activeRequests}
        onRequestSubmitted={(newReq) => {
          setActiveRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
        }}
      />

      {/* Maximized Image Viewer */}
      <MaximizedImageViewer
        visible={Boolean(imageModal)}
        imageUrl={imageModal?.url || null}
        title={imageModal?.name}
        onClose={() => setImageModal(null)}
      />

      {/* Session Closed Modal */}
      {isSessionClosed && (
        <View className="absolute inset-0 bg-black/85 items-center justify-center p-6 z-50">
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-full max-w-sm rounded-3xl p-6 items-center shadow-2xl space-y-4"
          >
            <View className="w-14 h-14 rounded-2xl bg-emerald-500/10 items-center justify-center">
              <AppIcon name="check-circle-2" size={28} color="#10B981" />
            </View>
            <Text style={{ color: colors.textPrimary }} className="text-lg font-black text-center">
              Session Concluded
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-xs text-center leading-relaxed">
              Your dining session at Pegs N Bottles has concluded. Thank you for visiting!
            </Text>
            <TouchableOpacity
              onPress={onExit}
              style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
              className="w-full py-3 rounded-xl items-center justify-center shadow-md mt-2"
            >
              <Text
                style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                className="text-xs font-black"
              >
                Return to Welcome Page
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export const CustomerPortal: React.FC<{ tokenNumber: string; onExit: () => void }> = ({
  tokenNumber,
  onExit,
}) => {
  return (
    <CustomerProvider tokenNumber={tokenNumber}>
      <CustomerPortalInner onExit={onExit} />
    </CustomerProvider>
  );
};
