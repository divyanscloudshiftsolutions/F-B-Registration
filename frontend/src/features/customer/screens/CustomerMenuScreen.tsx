import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { useCustomer } from '../../../context/CustomerContext';
import { MenuItemCard } from '../../../components/customer/MenuItemCard';
import { EmptyState } from '../../../components/common/EmptyState';

interface CustomerMenuScreenProps {
  sectionSlug: 'eat' | 'drink' | 'merch';
  onSectionChange: (section: 'eat' | 'drink' | 'merch') => void;
  onOpenItemCustomizer: (item: any) => void;
  onItemImagePress: (url: string, name: string) => void;
}

export const CustomerMenuScreen: React.FC<CustomerMenuScreenProps> = ({
  sectionSlug,
  onSectionChange,
  onOpenItemCustomizer,
  onItemImagePress,
}) => {
  const { colors, isDark } = useTheme();
  const {
    menu,
    categories,
    cart,
    addToCart,
    updateCartQuantity,
    isOrderingLocked,
  } = useCustomer();

  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG' | 'EGG'>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);

  // Filtered categories belonging to active section
  const sectionCategories = useMemo(() => {
    return categories.filter((c) => {
      const slug = (c.sectionSlug || c.section || 'eat').toLowerCase();
      return slug === sectionSlug;
    });
  }, [categories, sectionSlug]);

  // Derive items for active section
  const filteredItems = useMemo(() => {
    return menu.filter((item) => {
      // 1. Section match
      const itemSection = (item.sectionSlug || 'eat').toLowerCase();
      if (itemSection !== sectionSlug) return false;

      // 2. Dietary filter match
      if (dietaryFilter !== 'ALL') {
        if (dietaryFilter === 'VEG' && item.foodType !== 'VEG') return false;
        if (dietaryFilter === 'NON_VEG' && item.foodType !== 'NON_VEG') return false;
        if (dietaryFilter === 'EGG' && item.foodType !== 'EGG') return false;
      }

      // 3. Category match
      if (selectedCategoryId !== 'ALL') {
        if (item.categoryId !== selectedCategoryId) return false;
      }

      // 4. Subcategory match
      if (selectedSubcategoryId) {
        if (item.subcategoryId !== selectedSubcategoryId) return false;
      }

      // 5. Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [menu, sectionSlug, dietaryFilter, selectedCategoryId, selectedSubcategoryId, searchQuery]);

  // Derive subcategories for active category
  const availableSubcategories = useMemo(() => {
    if (selectedCategoryId === 'ALL') return [];
    const activeCat = sectionCategories.find((c) => c.id === selectedCategoryId);
    if (!activeCat || !activeCat.subcategories) return [];
    return activeCat.subcategories;
  }, [sectionCategories, selectedCategoryId]);

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

  const resetFilters = () => {
    setSearchQuery('');
    setDietaryFilter('ALL');
    setSelectedCategoryId('ALL');
    setSelectedSubcategoryId(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 1. Top Section Toggle (Eat / Drink / Merch) */}
      <View className="px-4 pt-3 pb-2">
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="p-1 rounded-2xl flex-row items-center justify-between"
        >
          {(['eat', 'drink', 'merch'] as const).map((slug) => {
            const isActive = sectionSlug === slug;
            const label = slug === 'eat' ? 'Food' : slug === 'drink' ? 'Bar & Drinks' : 'Merch';
            const iconName = slug === 'eat' ? 'utensils-crossed' : slug === 'drink' ? 'wine' : 'shopping-bag';

            return (
              <TouchableOpacity
                key={slug}
                onPress={() => {
                  onSectionChange(slug);
                  setSelectedCategoryId('ALL');
                  setSelectedSubcategoryId(null);
                }}
                activeOpacity={0.8}
                style={{
                  backgroundColor: isActive ? (isDark ? '#D4AF37' : '#7C3AED') : 'transparent',
                }}
                className="flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5"
              >
                <AppIcon
                  name={iconName}
                  size={14}
                  color={isActive ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted}
                />
                <Text
                  style={{
                    color: isActive ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted,
                    fontWeight: isActive ? '800' : '600',
                  }}
                  className="text-xs"
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Search & Dietary Filter Row */}
      <View className="px-4 py-1.5 flex-row gap-2 items-center">
        {/* Search Bar */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="flex-1 h-10 px-3 rounded-xl flex-row items-center gap-2"
        >
          <AppIcon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search ${sectionSlug === 'eat' ? 'food' : sectionSlug === 'drink' ? 'drinks' : 'items'}...`}
            placeholderTextColor={colors.textMuted}
            style={{ color: colors.textPrimary }}
            className="flex-1 text-xs font-medium h-full p-0"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
              <AppIcon name="x" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dietary Filters (Only for Food) */}
        {sectionSlug === 'eat' && (
          <View className="flex-row gap-1">
            {(['ALL', 'VEG', 'NON_VEG'] as const).map((diet) => {
              const isActive = dietaryFilter === diet;
              const label = diet === 'ALL' ? 'All' : diet === 'VEG' ? 'Veg' : 'Non-Veg';
              const dotColor = diet === 'VEG' ? '#16A34A' : diet === 'NON_VEG' ? '#DC2626' : undefined;

              return (
                <TouchableOpacity
                  key={diet}
                  onPress={() => setDietaryFilter(diet)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: isActive
                      ? isDark
                        ? '#D4AF37'
                        : '#7C3AED'
                      : colors.surface,
                    borderColor: isActive
                      ? isDark
                        ? '#D4AF37'
                        : '#7C3AED'
                      : colors.border,
                    borderWidth: 1,
                  }}
                  className="px-2.5 h-10 rounded-xl items-center justify-center flex-row gap-1"
                >
                  {dotColor && (
                    <View
                      style={{ backgroundColor: dotColor }}
                      className="w-2 h-2 rounded-full"
                    />
                  )}
                  <Text
                    style={{
                      color: isActive ? (isDark ? '#000000' : '#FFFFFF') : colors.textPrimary,
                      fontWeight: isActive ? '800' : '600',
                    }}
                    className="text-[11px]"
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 3. Categories Horizontal Carousel */}
      {sectionCategories.length > 0 && (
        <View className="py-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {/* All Category Pill */}
            <TouchableOpacity
              onPress={() => {
                setSelectedCategoryId('ALL');
                setSelectedSubcategoryId(null);
              }}
              activeOpacity={0.7}
              style={{
                backgroundColor: selectedCategoryId === 'ALL'
                  ? isDark
                    ? '#D4AF37'
                    : '#7C3AED'
                  : colors.surface,
                borderColor: selectedCategoryId === 'ALL'
                  ? isDark
                    ? '#D4AF37'
                    : '#7C3AED'
                  : colors.border,
                borderWidth: 1,
              }}
              className="px-3.5 py-1.5 rounded-full items-center justify-center"
            >
              <Text
                style={{
                  color: selectedCategoryId === 'ALL'
                    ? isDark
                      ? '#000000'
                      : '#FFFFFF'
                    : colors.textPrimary,
                  fontWeight: selectedCategoryId === 'ALL' ? '800' : '600',
                }}
                className="text-xs"
              >
                All Categories
              </Text>
            </TouchableOpacity>

            {/* Individual Category Pills */}
            {sectionCategories.map((cat) => {
              const isCatActive = selectedCategoryId === cat.id;

              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setSelectedCategoryId(cat.id);
                    setSelectedSubcategoryId(null);
                  }}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: isCatActive
                      ? isDark
                        ? '#D4AF37'
                        : '#7C3AED'
                      : colors.surface,
                    borderColor: isCatActive
                      ? isDark
                        ? '#D4AF37'
                        : '#7C3AED'
                      : colors.border,
                    borderWidth: 1,
                  }}
                  className="px-3.5 py-1.5 rounded-full items-center justify-center"
                >
                  <Text
                    style={{
                      color: isCatActive
                        ? isDark
                          ? '#000000'
                          : '#FFFFFF'
                        : colors.textPrimary,
                      fontWeight: isCatActive ? '800' : '600',
                    }}
                    className="text-xs"
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 4. Subcategory Filter Chips (if any) */}
      {availableSubcategories.length > 0 && (
        <View className="pb-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
          >
            <TouchableOpacity
              onPress={() => setSelectedSubcategoryId(null)}
              activeOpacity={0.7}
              style={{
                backgroundColor: selectedSubcategoryId === null
                  ? isDark
                    ? 'rgba(212,175,55,0.2)'
                    : 'rgba(124,58,237,0.15)'
                  : colors.surface,
                borderColor: selectedSubcategoryId === null
                  ? colors.primary
                  : colors.border,
                borderWidth: 1,
              }}
              className="px-2.5 py-1 rounded-lg"
            >
              <Text
                style={{
                  color: selectedSubcategoryId === null ? colors.primary : colors.textMuted,
                  fontWeight: selectedSubcategoryId === null ? '700' : '500',
                }}
                className="text-[11px]"
              >
                All Subcategories
              </Text>
            </TouchableOpacity>

            {availableSubcategories.map((sub: any) => {
              const isSubActive = selectedSubcategoryId === sub.id;

              return (
                <TouchableOpacity
                  key={sub.id}
                  onPress={() => setSelectedSubcategoryId(sub.id)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: isSubActive
                      ? isDark
                        ? 'rgba(212,175,55,0.2)'
                        : 'rgba(124,58,237,0.15)'
                      : colors.surface,
                    borderColor: isSubActive ? colors.primary : colors.border,
                    borderWidth: 1,
                  }}
                  className="px-2.5 py-1 rounded-lg"
                >
                  <Text
                    style={{
                      color: isSubActive ? colors.primary : colors.textMuted,
                      fontWeight: isSubActive ? '700' : '500',
                    }}
                    className="text-[11px]"
                  >
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 5. Menu Items Grid (2 columns) */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 110 }}
        className="flex-1"
      >
        {filteredItems.length === 0 ? (
          <EmptyState
            title="No items found"
            description={
              searchQuery
                ? `No dishes matched "${searchQuery}". Try clearing search or resetting filters.`
                : 'No dishes available matching the selected dietary or category filters.'
            }
            actionLabel="Reset Filters"
            onAction={resetFilters}
          />
        ) : (
          <View className="flex-row flex-wrap justify-between">
            {filteredItems.map((item) => {
              const inCart = cart
                .filter((ci) => ci.menuItemId === item.id)
                .reduce((sum, ci) => sum + (ci.quantity || 1), 0);

              return (
                <View key={item.id} style={{ width: '48.5%' }} className="mb-3.5">
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
        )}
      </ScrollView>
    </View>
  );
};
