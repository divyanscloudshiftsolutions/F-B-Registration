import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
} from 'react-native';
import { X, Check, AlertCircle, Plus, Minus } from 'lucide-react-native';
import { VegBadge } from './VegBadge';
import { useTheme } from '../../context/ThemeContext';
import type { MenuItemData } from './MenuItemCard';

export interface ProductCustomizerInitialConfig {
  variantId?: string | null;
  variantName?: string | null;
  modifiers?: Array<{
    groupId?: string;
    groupName?: string;
    optionId?: string;
    optionName?: string;
    name?: string;
    priceDelta?: number;
  }>;
  specialInstructions?: string;
  quantity?: number;
}

interface ProductCustomizerProps {
  item: MenuItemData | null;
  open: boolean;
  initialConfig?: ProductCustomizerInitialConfig | null;
  existingCartQuantity?: number;
  isOrderingDisabled?: boolean;
  onClose: () => void;
  onAddToCart: (configuredItem: {
    menuItemId: string;
    name: string;
    sectionSlug?: string;
    variantId?: string | null;
    variantName?: string | null;
    modifiers: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      priceDelta: number;
    }>;
    specialInstructions?: string;
    quantity: number;
    unitPrice: number;
    station: string;
    foodType: string;
  }) => void;
}

export const ProductCustomizer: React.FC<ProductCustomizerProps> = ({
  item,
  open,
  initialConfig,
  existingCartQuantity = 0,
  isOrderingDisabled = false,
  onClose,
  onAddToCart,
}) => {
  const { colors, isDark } = useTheme();

  const [variantId, setVariantId] = useState<string | null>(null);
  const [mods, setMods] = useState<Record<string, string[]>>({});
  const [instructions, setInstructions] = useState('');
  const [qty, setQty] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open && item) {
      // 1. Resolve initial variant
      let resolvedVariantId: string | null = null;
      if (item.variants && item.variants.length > 0) {
        if (initialConfig?.variantId) {
          const match = item.variants.find((v) => v.id === initialConfig.variantId);
          if (match) resolvedVariantId = match.id;
        }
        if (!resolvedVariantId && initialConfig?.variantName) {
          const match = item.variants.find(
            (v) => v.name.toLowerCase() === initialConfig.variantName?.toLowerCase()
          );
          if (match) resolvedVariantId = match.id;
        }
        if (!resolvedVariantId) {
          resolvedVariantId = item.variants[0].id;
        }
      }
      setVariantId(resolvedVariantId);

      // 2. Resolve initial modifiers
      const initialModsMap: Record<string, string[]> = {};
      if (initialConfig?.modifiers && item.modifierGroups) {
        if (Array.isArray(initialConfig.modifiers)) {
          initialConfig.modifiers.forEach((mod) => {
            const targetGroup = item.modifierGroups?.find(
              (g) =>
                (mod.groupId && g.id === mod.groupId) ||
                (mod.groupName && g.name.toLowerCase() === mod.groupName.toLowerCase())
            );
            if (targetGroup) {
              const optName = mod.optionName || mod.name;
              const matchedOption = targetGroup.options.find(
                (o) =>
                  (mod.optionId && o.id === mod.optionId) ||
                  (optName && o.name.toLowerCase() === optName.toLowerCase())
              );
              if (matchedOption) {
                if (!initialModsMap[targetGroup.id]) {
                  initialModsMap[targetGroup.id] = [];
                }
                if (!initialModsMap[targetGroup.id].includes(matchedOption.id)) {
                  initialModsMap[targetGroup.id].push(matchedOption.id);
                }
              }
            }
          });
        }
      }
      setMods(initialModsMap);

      // 3. Resolve instructions & quantity
      setInstructions(initialConfig?.specialInstructions || '');
      setQty(initialConfig?.quantity && initialConfig.quantity > 0 ? initialConfig.quantity : 1);
      setValidationError(null);
    }
  }, [open, item, initialConfig]);

  if (!open || !item) return null;

  const variants = item.variants || [];
  const modifierGroups = item.modifierGroups || [];
  const selectedVariant = variants.find((v) => v.id === variantId);

  const missingRequiredGroups = modifierGroups.filter(
    (g) => g.isRequired && (!mods[g.id] || mods[g.id].length === 0)
  );
  const isFormValid = missingRequiredGroups.length === 0;

  const toggleModifier = (
    group: { id: string; isRequired?: boolean; isMulti?: boolean },
    optionId: string
  ) => {
    setValidationError(null);
    setMods((prev) => {
      const current = prev[group.id] || [];
      const isMulti = group.isMulti ?? true;

      if (!isMulti) {
        if (current.includes(optionId)) {
          return group.isRequired ? prev : { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [optionId] };
      } else {
        if (current.includes(optionId)) {
          return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
        } else {
          return { ...prev, [group.id]: [...current, optionId] };
        }
      }
    });
  };

  const modAdditions = modifierGroups.reduce((sum, g) => {
    const selectedOptionIds = mods[g.id] || [];
    const groupSum = selectedOptionIds.reduce((gSum, optId) => {
      const opt = g.options.find((o) => o.id === optId);
      return gSum + (opt ? Number(opt.priceDelta || 0) : 0);
    }, 0);
    return sum + groupSum;
  }, 0);

  const effectiveBasePrice = Number(item.finalPrice ?? item.basePrice) || 0;
  const variantDelta = selectedVariant ? Number(selectedVariant.priceDelta || 0) : 0;
  const unitPrice = Math.round((effectiveBasePrice + variantDelta + modAdditions) * 100) / 100;
  const grandTotal = Math.round(unitPrice * qty * 100) / 100;

  const physicalStock = item.stockQuantity !== undefined ? Number(item.stockQuantity) : 50;
  const rawAvailable = item.availableStock !== undefined ? Number(item.availableStock) : physicalStock;
  const effectivePurchasable = Math.min(physicalStock, rawAvailable + existingCartQuantity);
  const isPhysicalOutOfStock = item.isAvailable === false || physicalStock <= 0;
  const isReservedOut = !isPhysicalOutOfStock && effectivePurchasable <= 0;

  const handleAdd = () => {
    if (isOrderingDisabled || isPhysicalOutOfStock || isReservedOut) return;
    if (!isFormValid) {
      const names = missingRequiredGroups.map((g) => g.name).join(', ');
      setValidationError(`Please make a selection for: ${names}`);
      return;
    }

    const selectedMods = modifierGroups.flatMap((g) => {
      const selectedOptionIds = mods[g.id] || [];
      return selectedOptionIds
        .map((optId) => {
          const opt = g.options.find((o) => o.id === optId);
          if (!opt) return null;
          return {
            groupId: g.id,
            groupName: g.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: Number(opt.priceDelta || 0),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    });

    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      sectionSlug: item.sectionSlug || 'eat',
      variantId: selectedVariant ? selectedVariant.id : null,
      variantName: selectedVariant ? selectedVariant.name : null,
      modifiers: selectedMods,
      specialInstructions: instructions.trim() ? instructions.trim() : undefined,
      quantity: qty,
      unitPrice,
      station: item.station,
      foodType: item.foodType,
    });

    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.modal,
              borderTopColor: colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Top Drag Handle */}
          <View style={styles.dragHandleWrapper}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? '#52525B' : '#D1D5DB' }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View style={styles.headerLeft}>
              <VegBadge type={item.foodType} size="md" />
              <View style={styles.headerTextContainer}>
                <Text style={[styles.title, { color: colors.text }]}>{item.name}</Text>
                {item.description ? (
                  <Text numberOfLines={2} style={[styles.desc, { color: colors.muted }]}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Variants / Sizes */}
            {variants.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.muted }]}>CHOOSE PORTION / SIZE</Text>
                <View style={styles.optionList}>
                  {variants.map((v) => {
                    const isSelected = variantId === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => setVariantId(v.id)}
                        style={[
                          styles.optionCard,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                          },
                        ]}
                      >
                        <View style={styles.optionLeft}>
                          <View
                            style={[
                              styles.radioCircle,
                              {
                                borderColor: isSelected ? colors.primary : colors.border,
                                backgroundColor: isSelected ? colors.primary : 'transparent',
                              },
                            ]}
                          >
                            {isSelected && <View style={styles.innerDot} />}
                          </View>
                          <Text style={[styles.optionName, { color: colors.text }]}>{v.name}</Text>
                        </View>
                        <Text style={[styles.priceDelta, { color: colors.muted }]}>
                          {Number(v.priceDelta) === 0 ? `₹${Number(item.basePrice).toFixed(0)}` : `+₹${Number(v.priceDelta).toFixed(0)}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Modifier Groups */}
            {modifierGroups.map((g) => {
              const isMulti = g.isMulti ?? true;
              const selectedIds = mods[g.id] || [];
              return (
                <View key={g.id} style={styles.section}>
                  <View style={styles.modHeaderRow}>
                    <View style={styles.modHeaderTitle}>
                      <Text style={[styles.sectionTitle, { color: colors.text }]}>{g.name}</Text>
                      {g.isRequired && (
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: selectedIds.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: selectedIds.length > 0 ? '#10B981' : '#EF4444' },
                            ]}
                          >
                            {selectedIds.length > 0 ? 'Selected' : 'Required'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.modSubtext, { color: colors.muted }]}>
                      {isMulti ? 'Choose multiple' : 'Select 1'}
                    </Text>
                  </View>

                  <View style={styles.optionList}>
                    {g.options.map((opt) => {
                      const isSelected = selectedIds.includes(opt.id);
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          onPress={() => toggleModifier(g, opt.id)}
                          style={[
                            styles.optionCard,
                            {
                              borderColor: isSelected ? colors.primary : colors.border,
                              backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                            },
                          ]}
                        >
                          <View style={styles.optionLeft}>
                            <View
                              style={[
                                isMulti ? styles.checkboxSquare : styles.radioCircle,
                                {
                                  borderColor: isSelected ? colors.primary : colors.border,
                                  backgroundColor: isSelected ? colors.primary : 'transparent',
                                },
                              ]}
                            >
                              {isSelected && (
                                isMulti ? <Check size={10} color="#FFFFFF" strokeWidth={3} /> : <View style={styles.innerDot} />
                              )}
                            </View>
                            <Text style={[styles.optionName, { color: colors.text }]}>{opt.name}</Text>
                          </View>
                          <Text style={[styles.priceDelta, { color: colors.muted }]}>
                            {Number(opt.priceDelta) > 0 ? `+₹${Number(opt.priceDelta).toFixed(0)}` : 'Free'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Special Instructions */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.muted }]}>SPECIAL INSTRUCTIONS</Text>
              <TextInput
                value={instructions}
                onChangeText={setInstructions}
                placeholder="e.g. Less spicy, no onions, extra chilled..."
                placeholderTextColor={colors.placeholder}
                maxLength={200}
                multiline
                numberOfLines={2}
                style={[
                  styles.textInput,
                  {
                    color: colors.text,
                    backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>

            {/* Quantity Stepper */}
            <View style={[styles.qtyRow, { backgroundColor: isDark ? '#27272A' : '#F3F4F6', borderColor: colors.border }]}>
              <Text style={[styles.qtyLabel, { color: colors.text }]}>Quantity</Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                  style={[styles.stepperBtn, { borderColor: colors.border }]}
                >
                  <Minus size={14} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.qtyCount, { color: colors.primary }]}>{qty}</Text>
                <TouchableOpacity
                  onPress={() => setQty((q) => Math.min(effectivePurchasable, q + 1))}
                  style={[styles.stepperBtn, { borderColor: colors.border }]}
                >
                  <Plus size={14} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Footer Action */}
          <View style={[styles.footer, { borderTopColor: colors.divider }]}>
            {validationError && (
              <View style={styles.errorBanner}>
                <AlertCircle size={14} color="#EF4444" />
                <Text style={styles.errorBannerText}>{validationError}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleAdd}
              disabled={isOrderingDisabled || isPhysicalOutOfStock || isReservedOut}
              style={[
                styles.addBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: isOrderingDisabled || isPhysicalOutOfStock || isReservedOut ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.addBtnText, { color: colors.primaryButtonText }]}>
                {isPhysicalOutOfStock
                  ? 'Currently Out of Stock'
                  : isReservedOut
                  ? 'Reserved by Others'
                  : isOrderingDisabled
                  ? 'Ordering Locked'
                  : 'Add to Cart'}
              </Text>
              <Text style={[styles.addBtnPrice, { color: colors.primaryButtonText }]}>
                ₹{grandTotal.toFixed(0)}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '85%',
  },
  dragHandleWrapper: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  desc: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modSubtext: {
    fontSize: 10,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  optionList: {
    gap: 6,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSquare: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  optionName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  priceDelta: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    fontSize: 12,
    minHeight: 54,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  qtyLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyCount: {
    fontSize: 14,
    fontWeight: '900',
    minWidth: 16,
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.12)',
    padding: 8,
    borderRadius: 8,
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  addBtnPrice: {
    fontSize: 14,
    fontWeight: '900',
  },
});

export default ProductCustomizer;
