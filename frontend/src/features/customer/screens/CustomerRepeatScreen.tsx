import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { useCustomer } from '../../../context/CustomerContext';
import { VegBadge } from '../../../components/customer/VegBadge';
import { EmptyState } from '../../../components/common/EmptyState';

interface CustomerRepeatScreenProps {
  onExploreMenu: () => void;
  onOpenCustomizer: (item: any) => void;
}

export const CustomerRepeatScreen: React.FC<CustomerRepeatScreenProps> = ({
  onExploreMenu,
  onOpenCustomizer,
}) => {
  const { colors, isDark } = useTheme();
  const {
    orderHistory,
    menu,
    cart,
    addToCart,
    updateCartQuantity,
    isOrderingLocked,
  } = useCustomer();

  // Deduplicate ordered items
  const deduplicatedItems = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      unitPrice: number;
      foodType?: string;
      station?: string;
      orderCount: number;
      catalogItem?: any;
    }>();

    for (const ordItem of orderHistory) {
      const menuItemId = ordItem.menuItemId || ordItem.id;
      const catalogItem = menu.find((m) => m.id === menuItemId);

      const existing = map.get(menuItemId);
      if (existing) {
        existing.orderCount += ordItem.quantity || 1;
      } else {
        map.set(menuItemId, {
          id: menuItemId,
          name: ordItem.name || catalogItem?.name || 'Dish Item',
          unitPrice: Number(catalogItem?.finalPrice ?? catalogItem?.basePrice ?? ordItem.unitPrice ?? ordItem.price ?? 0),
          foodType: ordItem.foodType || catalogItem?.foodType,
          station: ordItem.station || catalogItem?.station,
          orderCount: ordItem.quantity || 1,
          catalogItem,
        });
      }
    }

    return Array.from(map.values());
  }, [orderHistory, menu]);

  const handleReorder = (item: any) => {
    if (isOrderingLocked) return;

    const catalog = item.catalogItem;
    const hasModifiers =
      catalog &&
      ((catalog.variants && catalog.variants.length > 0) ||
        (catalog.modifierGroups && catalog.modifierGroups.length > 0));

    if (hasModifiers) {
      onOpenCustomizer(catalog);
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
        sectionSlug: catalog?.sectionSlug || 'eat',
        variantId: null,
        variantName: null,
        modifiers: [],
        quantity: 1,
        unitPrice: item.unitPrice,
        station: item.station,
        foodType: item.foodType,
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-2">
        <Text style={{ color: colors.textPrimary }} className="text-base font-black">
          Quick Reorder
        </Text>
        <Text style={{ color: colors.textMuted }} className="text-xs font-medium mt-0.5">
          Order your favorite items again with one tap
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
        className="flex-1"
      >
        {deduplicatedItems.length === 0 ? (
          <EmptyState
            title="No Items Ordered Yet"
            description="Once you place orders for food or drinks, they will appear here for fast one-tap reordering."
            actionLabel="Explore Menu"
            onAction={onExploreMenu}
          />
        ) : (
          <View className="space-y-3">
            {deduplicatedItems.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="p-3.5 rounded-2xl flex-row items-center justify-between shadow-xs"
              >
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center gap-1.5">
                    {item.foodType && <VegBadge type={item.foodType} size="sm" />}
                    <Text
                      style={{ color: colors.textPrimary }}
                      className="text-xs font-bold flex-1"
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <Text style={{ color: colors.textMuted }} className="text-[11px] font-mono mt-0.5">
                    ₹{item.unitPrice.toFixed(0)} • Ordered {item.orderCount}x previously
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleReorder(item)}
                  disabled={isOrderingLocked}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: isOrderingLocked
                      ? colors.border
                      : isDark
                      ? '#D4AF37'
                      : '#7C3AED',
                  }}
                  className="px-3.5 py-2 rounded-xl flex-row items-center gap-1.5 shadow-xs"
                >
                  <AppIcon
                    name="plus"
                    size={14}
                    color={isOrderingLocked ? colors.textMuted : isDark ? '#000000' : '#FFFFFF'}
                  />
                  <Text
                    style={{
                      color: isOrderingLocked ? colors.textMuted : isDark ? '#000000' : '#FFFFFF',
                    }}
                    className="text-xs font-extrabold"
                  >
                    Add Again
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};
