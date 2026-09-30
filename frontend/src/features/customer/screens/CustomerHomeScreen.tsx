import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { useCustomer } from '../../../context/CustomerContext';
import { MenuItemCard } from '../../../components/customer/MenuItemCard';
import { CustomerNavTab } from '../../../components/customer/CustomerBottomNav';

interface CustomerHomeScreenProps {
  onNavigateTab: (tab: CustomerNavTab) => void;
  onOpenItemCustomizer: (item: any) => void;
  onItemImagePress: (url: string, name: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CustomerHomeScreen: React.FC<CustomerHomeScreenProps> = ({
  onNavigateTab,
  onOpenItemCustomizer,
  onItemImagePress,
}) => {
  const { colors, isDark } = useTheme();
  const {
    menu,
    categories,
    promotions,
    tableNumber,
    cart,
    addToCart,
    updateCartQuantity,
    isOrderingLocked,
    isSessionWarning,
  } = useCustomer();

  // Filter items
  const popularItems = menu.filter((i) => i.isAvailable !== false).slice(0, 6);
  const drinkItems = menu.filter((i) => i.sectionSlug === 'drink' && i.isAvailable !== false).slice(0, 4);
  const specials = promotions && promotions.length > 0 ? promotions : [];

  const handleCardIncrement = (item: any) => {
    const hasModifiers =
      (item.variants && item.variants.length > 0) ||
      (item.modifierGroups && item.modifierGroups.length > 0);

    if (hasModifiers) {
      onOpenItemCustomizer(item);
      return;
    }

    const matchingCartItems = cart.filter((ci) => ci.menuItemId === item.id);
    if (matchingCartItems.length > 0) {
      const target = matchingCartItems[matchingCartItems.length - 1];
      updateCartQuantity(target.id, 1);
    } else {
      addToCart({
        menuItemId: item.id,
        name: item.name,
        sectionSlug: item.sectionSlug || 'eat',
        variantId: null,
        variantName: null,
        modifiers: [],
        quantity: 1,
        unitPrice: Number(item.finalPrice ?? item.basePrice),
        station: item.station,
        foodType: item.foodType,
      });
    }
  };

  const handleCardDecrement = (item: any) => {
    const matchingCartItems = cart.filter((ci) => ci.menuItemId === item.id);
    if (matchingCartItems.length > 0) {
      const target = matchingCartItems[matchingCartItems.length - 1];
      updateCartQuantity(target.id, -1);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 100 }}
      className="flex-1"
    >
      {/* 1. Dining Session Banner / Welcome */}
      <View className="px-4 pt-3 pb-2">
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="rounded-2xl p-4 flex-row items-center justify-between shadow-xs"
        >
          <View>
            <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
              Table {tableNumber || '--'}
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-[11px] font-medium mt-0.5">
              Welcome to Pegs N Bottles
            </Text>
          </View>
          <View
            style={{
              backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(124,58,237,0.1)',
              borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(124,58,237,0.2)',
              borderWidth: 1,
            }}
            className="px-2.5 py-1 rounded-full flex-row items-center gap-1"
          >
            <AppIcon name="sparkles" size={12} color={isDark ? '#D4AF37' : '#7C3AED'} />
            <Text
              style={{ color: isDark ? '#D4AF37' : '#7C3AED' }}
              className="text-[10px] font-black"
            >
              TableFlow Live
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Quick Section Navigation Shortcuts */}
      <View className="px-4 py-2 flex-row gap-2.5">
        <TouchableOpacity
          onPress={() => onNavigateTab('eat')}
          activeOpacity={0.8}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="flex-1 p-3.5 rounded-2xl items-center shadow-xs"
        >
          <View
            style={{
              backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(124,58,237,0.08)',
            }}
            className="w-10 h-10 rounded-xl items-center justify-center mb-1.5"
          >
            <AppIcon name="utensils-crossed" size={20} color={colors.primary} />
          </View>
          <Text style={{ color: colors.textPrimary }} className="text-xs font-black">
            Food Menu
          </Text>
          <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium">
            Dishes & Mains
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onNavigateTab('drink')}
          activeOpacity={0.8}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="flex-1 p-3.5 rounded-2xl items-center shadow-xs"
        >
          <View
            style={{
              backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(124,58,237,0.08)',
            }}
            className="w-10 h-10 rounded-xl items-center justify-center mb-1.5"
          >
            <AppIcon name="wine" size={20} color={colors.primary} />
          </View>
          <Text style={{ color: colors.textPrimary }} className="text-xs font-black">
            Bar Menu
          </Text>
          <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium">
            Cocktails & Brews
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onNavigateTab('merch')}
          activeOpacity={0.8}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="flex-1 p-3.5 rounded-2xl items-center shadow-xs"
        >
          <View
            style={{
              backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(124,58,237,0.08)',
            }}
            className="w-10 h-10 rounded-xl items-center justify-center mb-1.5"
          >
            <AppIcon name="shopping-bag" size={20} color={colors.primary} />
          </View>
          <Text style={{ color: colors.textPrimary }} className="text-xs font-black">
            Merch
          </Text>
          <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium">
            Gear & Gifts
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Specials & Offers Carousel */}
      {specials.length > 0 && (
        <View className="pt-4 pb-2">
          <View className="flex-row items-center justify-between px-4 mb-2.5">
            <View className="flex-row items-center gap-1.5">
              <AppIcon name="flame" size={16} color="#E11D48" />
              <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
                Today's Specials & Offers
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
          >
            {specials.map((spec: any, idx: number) => (
              <View
                key={spec.id || idx}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  width: SCREEN_WIDTH * 0.72,
                  maxWidth: 280,
                }}
                className="rounded-2xl p-3.5 shadow-xs"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text
                    style={{ color: colors.primary }}
                    className="text-xs font-black uppercase tracking-wider"
                  >
                    {spec.title || 'Special Deal'}
                  </Text>
                  {spec.discountValue && (
                    <View className="bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      <Text className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                        {spec.discountValue}% OFF
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{ color: colors.textPrimary }}
                  className="text-xs font-bold mt-0.5"
                  numberOfLines={1}
                >
                  {spec.description || spec.name || 'Exclusive table offer'}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 4. Chef's Recommendations / Popular Dishes Grid */}
      <View className="px-4 pt-5">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-1.5">
            <AppIcon name="sparkles" size={16} color={colors.primary} />
            <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
              Popular Selections
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onNavigateTab('eat')}
            className="flex-row items-center gap-1"
          >
            <Text style={{ color: colors.primary }} className="text-xs font-bold">
              View All
            </Text>
            <AppIcon name="chevron-right" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap justify-between">
          {popularItems.map((item) => {
            const inCart = cart
              .filter((ci) => ci.menuItemId === item.id)
              .reduce((sum, ci) => sum + (ci.quantity || 1), 0);

            return (
              <View key={item.id} style={{ width: '48.5%' }} className="mb-3">
                <MenuItemCard
                  item={item}
                  cartQuantity={inCart}
                  onAdd={() => handleCardIncrement(item)}
                  onIncrement={() => handleCardIncrement(item)}
                  onDecrement={() => handleCardDecrement(item)}
                  onImagePress={() => {
                    const url = item.imageUrl || item.image;
                    if (url) onItemImagePress(url, item.name);
                  }}
                  isOrderingDisabled={isOrderingLocked}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* 5. Recommended Drinks Preview */}
      {drinkItems.length > 0 && (
        <View className="px-4 pt-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-1.5">
              <AppIcon name="wine" size={16} color={colors.primary} />
              <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
                Bar & Cocktails
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onNavigateTab('drink')}
              className="flex-row items-center gap-1"
            >
              <Text style={{ color: colors.primary }} className="text-xs font-bold">
                View Bar
              </Text>
              <AppIcon name="chevron-right" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {drinkItems.map((item) => {
              const inCart = cart
                .filter((ci) => ci.menuItemId === item.id)
                .reduce((sum, ci) => sum + (ci.quantity || 1), 0);

              return (
                <View key={item.id} style={{ width: '48.5%' }} className="mb-3">
                  <MenuItemCard
                    item={item}
                    cartQuantity={inCart}
                    onAdd={() => handleCardIncrement(item)}
                    onIncrement={() => handleCardIncrement(item)}
                    onDecrement={() => handleCardDecrement(item)}
                    onImagePress={() => {
                      const url = item.imageUrl || item.image;
                      if (url) onItemImagePress(url, item.name);
                    }}
                    isOrderingDisabled={isOrderingLocked}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
};
