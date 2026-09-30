import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { api } from '../../../services/api';
import { onSocketEvent } from '../../../services/socket';
import { servedUndoManager, useServedUndo } from '../../../services/servedUndoManager';
import { ProductCustomizer, CustomizerItem } from '../../../components/customer/ProductCustomizer';
import { VegBadge } from '../../../components/customer/VegBadge';
import { EmptyState } from '../../../components/common/EmptyState';

export type WaiterTab = 'overview' | 'tables' | 'requests' | 'ready' | 'bills';

export const WaiterStationScreen: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const { colors, isDark, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<WaiterTab>('overview');
  const [tables, setTables] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [readyItems, setReadyItems] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [activeBills, setActiveBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Assisted Ordering State
  const [assistedTable, setAssistedTable] = useState<any | null>(null);
  const [assistedCart, setAssistedCart] = useState<any[]>([]);
  const [customizingItem, setCustomizingItem] = useState<CustomizerItem | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Bill Settlement State
  const [settlingTable, setSettlingTable] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [isSettling, setIsSettling] = useState<boolean>(false);

  // Served Undo Banner
  const undoEntries = useServedUndo();

  const fetchData = useCallback(async () => {
    try {
      const [tData, rData, kData, mData] = await Promise.all([
        api.getTables(),
        api.getServiceRequests(),
        api.getKdsOrders(),
        api.getMenuCatalog(),
      ]);

      setTables(tData || []);
      setRequests(rData || []);
      setMenu(mData || []);

      // Extract ready items from orders
      const ready: any[] = [];
      (kData || []).forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          if (item.status === 'READY') {
            ready.push({
              ...item,
              orderId: order.id,
              orderNumber: order.orderNumber,
              tableName: order.tableName || order.table?.name || `Table ${order.tableId}`,
              tableId: order.tableId,
            });
          }
        });
      });
      setReadyItems(ready);
    } catch (err) {
      // Error handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const unsubTable = onSocketEvent('table:updated', fetchData);
    const unsubReq = onSocketEvent('service_request:new', fetchData);
    const unsubReqUpdate = onSocketEvent('service_request:updated', fetchData);
    const unsubKds = onSocketEvent('kds:order_updated', fetchData);

    return () => {
      unsubTable();
      unsubReq();
      unsubReqUpdate();
      unsubKds();
    };
  }, [fetchData]);

  // Request actions
  const handleAcknowledgeRequest = async (reqId: string) => {
    try {
      await api.acknowledgeServiceRequest(reqId);
      setRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: 'ACKNOWLEDGED' } : r))
      );
    } catch (err) {}
  };

  const handleResolveRequest = async (reqId: string) => {
    try {
      await api.resolveServiceRequest(reqId);
      setRequests((prev) => prev.filter((r) => r.id !== reqId));
    } catch (err) {}
  };

  // Ready item served with 5000ms sliding undo
  const handleMarkServed = async (item: any) => {
    try {
      await servedUndoManager.markItemAsServed(
        item.id,
        {
          itemName: item.name || item.menuItem?.name || 'Dish',
          tableName: item.tableName,
          station: item.station,
          quantity: item.quantity || 1,
        },
        async () => {
          // Commit to backend on timeout
          await api.updateOrderItemStatus(item.id, 'SERVED');
        },
        async () => {
          // Revert if undone
          await api.updateOrderItemStatus(item.id, 'READY');
          fetchData();
        }
      );
      setReadyItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {}
  };

  // Assisted Order handlers
  const handleAddAssistedItem = (item: any) => {
    const hasModifiers =
      (item.variants && item.variants.length > 0) ||
      (item.modifierGroups && item.modifierGroups.length > 0);

    if (hasModifiers) {
      setCustomizingItem(item);
      return;
    }

    setAssistedCart((prev) => {
      const existing = prev.find((ci) => ci.menuItemId === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          id: `cart_${Date.now()}_${Math.random()}`,
          menuItemId: item.id,
          name: item.name,
          unitPrice: Number(item.finalPrice ?? item.basePrice),
          quantity: 1,
          foodType: item.foodType,
          station: item.station,
          modifiers: [],
        },
      ];
    });
  };

  const handleSubmitAssistedOrder = async () => {
    if (!assistedTable || assistedCart.length === 0) return;
    setIsSubmittingOrder(true);
    try {
      await api.placeAssistedOrder({
        tableId: assistedTable.id,
        tokenNumber: assistedTable.activeToken?.tokenNumber || assistedTable.tokenNumber,
        items: assistedCart.map((ci) => ({
          menuItemId: ci.menuItemId,
          quantity: ci.quantity,
          variantId: ci.variantId,
          modifiers: ci.modifiers,
          specialInstructions: ci.specialInstructions,
        })),
      });
      setAssistedCart([]);
      setAssistedTable(null);
      fetchData();
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Failed to place assisted order');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Reopen ordering handler
  const handleReopenOrdering = async (table: any) => {
    try {
      await api.reopenTableOrdering(table.id);
      fetchData();
    } catch (err) {}
  };

  // Settle bill handler
  const handleSettleBill = async () => {
    if (!settlingTable) return;
    setIsSettling(true);
    try {
      await api.settleTableBill(settlingTable.id, { paymentMethod });
      setSettlingTable(null);
      fetchData();
    } catch (err) {} finally {
      setIsSettling(false);
    }
  };

  // Computed counts
  const pendingRequestsCount = requests.filter((r) => r.status === 'PENDING').length;
  const occupiedTablesCount = tables.filter((t) => t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED').length;
  const billRequestedCount = tables.filter((t) => t.status === 'BILL_REQUESTED').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* Top Header */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        }}
        className="px-4 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2.5">
          <View
            style={{
              backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(124,58,237,0.1)',
            }}
            className="w-9 h-9 rounded-xl items-center justify-center"
          >
            <AppIcon name="chef-hat" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
              Waiter Station
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium">
              Floor & Table Management
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={toggleTheme}
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-9 h-9 rounded-xl items-center justify-center"
          >
            <AppIcon
              name={isDark ? 'sun' : 'moon'}
              size={18}
              color={isDark ? '#D4AF37' : '#7C3AED'}
            />
          </TouchableOpacity>

          {onLogout && (
            <TouchableOpacity
              onPress={onLogout}
              style={{
                backgroundColor: 'rgba(225,29,72,0.1)',
                borderColor: 'rgba(225,29,72,0.2)',
                borderWidth: 1,
              }}
              className="px-2.5 py-1.5 rounded-xl flex-row items-center gap-1"
            >
              <AppIcon name="log-out" size={14} color="#E11D48" />
              <Text className="text-xs font-bold text-rose-600 dark:text-rose-400">
                Exit
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 5-Subtab Top Navigation Bar */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        }}
        className="px-2 py-1 flex-row"
      >
        {(['overview', 'tables', 'requests', 'ready', 'bills'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label =
            tab === 'overview'
              ? 'Overview'
              : tab === 'tables'
              ? 'Tables'
              : tab === 'requests'
              ? 'Requests'
              : tab === 'ready'
              ? 'Ready'
              : 'Bills';

          const badgeCount =
            tab === 'requests'
              ? pendingRequestsCount
              : tab === 'ready'
              ? readyItems.length
              : tab === 'bills'
              ? billRequestedCount
              : 0;

          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                backgroundColor: isActive ? (isDark ? '#D4AF37' : '#7C3AED') : 'transparent',
              }}
              className="flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1 relative"
            >
              <Text
                style={{
                  color: isActive ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted,
                  fontWeight: isActive ? '800' : '600',
                }}
                className="text-[11px]"
              >
                {label}
              </Text>
              {badgeCount > 0 && (
                <View
                  style={{
                    backgroundColor: isActive
                      ? isDark
                        ? '#7C3AED'
                        : '#D4AF37'
                      : colors.primary,
                  }}
                  className="min-w-[15px] h-3.5 px-1 rounded-full items-center justify-center"
                >
                  <Text
                    style={{
                      color: isActive
                        ? isDark
                          ? '#FFFFFF'
                          : '#000000'
                        : '#FFFFFF',
                    }}
                    className="text-[8px] font-black"
                  >
                    {badgeCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sliding Served Undo Banners */}
      {undoEntries.length > 0 && (
        <View className="px-4 pt-2 space-y-1.5">
          {undoEntries.map((entry) => (
            <View
              key={entry.itemId}
              className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-2">
                <Text className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Served: {entry.metadata.itemName} ({entry.metadata.tableName})
                </Text>
                <Text className="text-[10px] text-emerald-700 dark:text-emerald-300">
                  Undo window active ({Math.ceil(entry.remainingMs / 1000)}s)
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => servedUndoManager.undoServed(entry.itemId)}
                className="px-3 py-1 bg-emerald-600 rounded-lg"
              >
                <Text className="text-[11px] font-black text-white">
                  Undo
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Tab Screen Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        className="flex-1"
      >
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <View className="space-y-4">
            {/* Stat Cards Grid */}
            <View className="flex-row flex-wrap gap-2.5 justify-between">
              <TouchableOpacity
                onPress={() => setActiveTab('tables')}
                style={{ width: '48%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
                className="p-3.5 rounded-2xl shadow-xs"
              >
                <Text style={{ color: colors.textMuted }} className="text-[11px] font-bold">
                  Occupied Tables
                </Text>
                <Text style={{ color: colors.textPrimary }} className="text-2xl font-black mt-1">
                  {occupiedTablesCount}/{tables.length}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('requests')}
                style={{ width: '48%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
                className="p-3.5 rounded-2xl shadow-xs"
              >
                <Text style={{ color: colors.textMuted }} className="text-[11px] font-bold">
                  Pending Calls
                </Text>
                <Text
                  style={{ color: pendingRequestsCount > 0 ? '#D97706' : colors.textPrimary }}
                  className="text-2xl font-black mt-1"
                >
                  {pendingRequestsCount}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('ready')}
                style={{ width: '48%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
                className="p-3.5 rounded-2xl shadow-xs"
              >
                <Text style={{ color: colors.textMuted }} className="text-[11px] font-bold">
                  Ready to Serve
                </Text>
                <Text
                  style={{ color: readyItems.length > 0 ? '#10B981' : colors.textPrimary }}
                  className="text-2xl font-black mt-1"
                >
                  {readyItems.length}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('bills')}
                style={{ width: '48%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }}
                className="p-3.5 rounded-2xl shadow-xs"
              >
                <Text style={{ color: colors.textMuted }} className="text-[11px] font-bold">
                  Bill Requests
                </Text>
                <Text
                  style={{ color: billRequestedCount > 0 ? colors.primary : colors.textPrimary }}
                  className="text-2xl font-black mt-1"
                >
                  {billRequestedCount}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recent Requests Preview */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
              }}
              className="p-4 rounded-2xl shadow-xs space-y-3"
            >
              <View className="flex-row items-center justify-between">
                <Text style={{ color: colors.textPrimary }} className="text-xs font-black uppercase tracking-wider">
                  Active Table Requests ({requests.length})
                </Text>
                <TouchableOpacity onPress={() => setActiveTab('requests')}>
                  <Text style={{ color: colors.primary }} className="text-xs font-bold">
                    View All
                  </Text>
                </TouchableOpacity>
              </View>

              {requests.length === 0 ? (
                <Text style={{ color: colors.textMuted }} className="text-xs italic py-2">
                  No pending service requests at this time.
                </Text>
              ) : (
                <View className="space-y-2">
                  {requests.slice(0, 3).map((req) => (
                    <View
                      key={req.id}
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      }}
                      className="p-2.5 rounded-xl flex-row items-center justify-between"
                    >
                      <View className="flex-1 mr-2">
                        <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                          Table {req.tableNumber || req.table?.name || req.tableId} • {req.type}
                        </Text>
                        {req.note && (
                          <Text style={{ color: colors.textMuted }} className="text-[10px]">
                            {req.note}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleResolveRequest(req.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600"
                      >
                        <Text className="text-[10px] font-black text-white">
                          Resolve
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* 2. TABLES TAB */}
        {activeTab === 'tables' && (
          <View className="space-y-3">
            <View className="flex-row flex-wrap gap-2.5 justify-between">
              {tables.map((tbl) => {
                const isOccupied = tbl.status === 'OCCUPIED' || tbl.status === 'BILL_REQUESTED';
                const isBillReq = tbl.status === 'BILL_REQUESTED';

                return (
                  <View
                    key={tbl.id}
                    style={{
                      width: '48.5%',
                      backgroundColor: colors.surface,
                      borderColor: isBillReq ? '#D97706' : colors.border,
                      borderWidth: isBillReq ? 2 : 1,
                    }}
                    className="p-3.5 rounded-2xl shadow-xs space-y-2"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
                        {tbl.name || `Table ${tbl.tableNumber}`}
                      </Text>
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          isBillReq
                            ? 'bg-amber-500/20'
                            : isOccupied
                            ? 'bg-purple-500/20'
                            : 'bg-emerald-500/20'
                        }`}
                      >
                        <Text
                          className={`text-[9px] font-black ${
                            isBillReq
                              ? 'text-amber-600 dark:text-amber-400'
                              : isOccupied
                              ? 'text-purple-600 dark:text-purple-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {tbl.status}
                        </Text>
                      </View>
                    </View>

                    {isOccupied && (
                      <View className="space-y-1.5 pt-1">
                        {isBillReq && (
                          <TouchableOpacity
                            onPress={() => handleReopenOrdering(tbl)}
                            className="w-full py-1.5 rounded-lg bg-amber-500/20 items-center justify-center"
                          >
                            <Text className="text-[10px] font-black text-amber-800 dark:text-amber-300">
                              Reopen Ordering
                            </Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          onPress={() => {
                            setAssistedTable(tbl);
                            setAssistedCart([]);
                          }}
                          style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                          className="w-full py-1.5 rounded-lg items-center justify-center"
                        >
                          <Text
                            style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                            className="text-[10px] font-black"
                          >
                            + Take Order
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setSettlingTable(tbl)}
                          className="w-full py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 items-center justify-center"
                        >
                          <Text style={{ color: colors.textPrimary }} className="text-[10px] font-black">
                            Settle Bill
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 3. REQUESTS TAB */}
        {activeTab === 'requests' && (
          <View className="space-y-3">
            {requests.length === 0 ? (
              <EmptyState
                title="No Pending Calls"
                description="No table service calls are currently active."
              />
            ) : (
              requests.map((req) => (
                <View
                  key={req.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                  className="p-3.5 rounded-2xl shadow-xs flex-row items-center justify-between"
                >
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center gap-2">
                      <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
                        Table {req.tableNumber || req.table?.name || req.tableId}
                      </Text>
                      <View className="px-2 py-0.5 rounded-md bg-amber-500/15">
                        <Text className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                          {req.type}
                        </Text>
                      </View>
                    </View>
                    {req.note && (
                      <Text style={{ color: colors.textMuted }} className="text-xs mt-1">
                        Note: {req.note}
                      </Text>
                    )}
                  </View>

                  <View className="flex-row gap-2">
                    {req.status === 'PENDING' && (
                      <TouchableOpacity
                        onPress={() => handleAcknowledgeRequest(req.id)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600"
                      >
                        <Text className="text-xs font-black text-white">
                          Ack
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => handleResolveRequest(req.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600"
                    >
                      <Text className="text-xs font-black text-white">
                        Resolve
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* 4. READY TAB */}
        {activeTab === 'ready' && (
          <View className="space-y-3">
            {readyItems.length === 0 ? (
              <EmptyState
                title="No Items Ready"
                description="All completed dishes and drinks have been served to tables."
              />
            ) : (
              readyItems.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                  className="p-3.5 rounded-2xl shadow-xs flex-row items-center justify-between"
                >
                  <View className="flex-1 mr-2">
                    <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                      {item.name || item.menuItem?.name} × {item.quantity || 1}
                    </Text>
                    <Text style={{ color: colors.primary }} className="text-[11px] font-black mt-0.5">
                      {item.tableName} • {item.station || 'KITCHEN'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleMarkServed(item)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600"
                  >
                    <Text className="text-xs font-black text-white">
                      Mark Served
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* 5. BILLS TAB */}
        {activeTab === 'bills' && (
          <View className="space-y-3">
            {tables
              .filter((t) => t.status === 'BILL_REQUESTED' || t.status === 'OCCUPIED')
              .map((tbl) => (
                <View
                  key={tbl.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                  className="p-4 rounded-2xl shadow-xs flex-row items-center justify-between"
                >
                  <View className="flex-1 mr-2">
                    <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
                      {tbl.name || `Table ${tbl.tableNumber}`}
                    </Text>
                    <Text style={{ color: colors.textMuted }} className="text-xs mt-0.5">
                      Status: {tbl.status}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSettlingTable(tbl)}
                    style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                    className="px-4 py-2 rounded-xl"
                  >
                    <Text
                      style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                      className="text-xs font-black"
                    >
                      Settle & Close
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Assisted Order Modal */}
      <Modal
        visible={Boolean(assistedTable)}
        animationType="slide"
        onRequestClose={() => setAssistedTable(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
            }}
            className="p-4 flex-row items-center justify-between"
          >
            <Text style={{ color: colors.textPrimary }} className="text-base font-black">
              Take Order — {assistedTable?.name || `Table ${assistedTable?.tableNumber}`}
            </Text>
            <TouchableOpacity onPress={() => setAssistedTable(null)} className="p-1">
              <AppIcon name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Menu Catalog Scroll */}
          <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>
            <View className="space-y-2.5">
              {menu.map((item) => {
                const inCart = assistedCart
                  .filter((ci) => ci.menuItemId === item.id)
                  .reduce((sum, ci) => sum + (ci.quantity || 1), 0);

                return (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    }}
                    className="p-3 rounded-2xl flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-2">
                      <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                        {item.name}
                      </Text>
                      <Text style={{ color: colors.textMuted }} className="text-[11px] font-mono">
                        ₹{Number(item.finalPrice ?? item.basePrice).toFixed(0)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleAddAssistedItem(item)}
                      style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                      className="px-3 py-1.5 rounded-xl flex-row items-center gap-1"
                    >
                      <AppIcon name="plus" size={12} color={isDark ? '#000000' : '#FFFFFF'} />
                      <Text
                        style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                        className="text-xs font-black"
                      >
                        {inCart > 0 ? `Add (${inCart})` : 'Add'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Bottom Submit CTA */}
          {assistedCart.length > 0 && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                borderTopWidth: 1,
              }}
              className="p-4"
            >
              <TouchableOpacity
                onPress={handleSubmitAssistedOrder}
                disabled={isSubmittingOrder}
                style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                className="w-full py-3.5 rounded-2xl items-center justify-center flex-row gap-2"
              >
                {isSubmittingOrder ? (
                  <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
                ) : (
                  <Text
                    style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                    className="text-sm font-black"
                  >
                    Send Order to Kitchen ({assistedCart.length} items)
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Settle Bill Modal */}
      <Modal
        visible={Boolean(settlingTable)}
        transparent
        animationType="fade"
        onRequestClose={() => !isSettling && setSettlingTable(null)}
      >
        <View className="flex-1 bg-black/70 items-center justify-center p-4">
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-full max-w-sm rounded-3xl p-6 space-y-4"
          >
            <Text style={{ color: colors.textPrimary }} className="text-base font-black text-center">
              Settle Table {settlingTable?.name || settlingTable?.tableNumber}
            </Text>

            {/* Payment Method Selector */}
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setPaymentMethod('CASH')}
                style={{
                  backgroundColor: paymentMethod === 'CASH' ? (isDark ? '#D4AF37' : '#7C3AED') : colors.background,
                }}
                className="flex-1 py-3 rounded-xl items-center justify-center"
              >
                <Text
                  style={{
                    color: paymentMethod === 'CASH' ? (isDark ? '#000000' : '#FFFFFF') : colors.textPrimary,
                    fontWeight: '800',
                  }}
                  className="text-xs"
                >
                  Cash Payment
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPaymentMethod('UPI')}
                style={{
                  backgroundColor: paymentMethod === 'UPI' ? (isDark ? '#D4AF37' : '#7C3AED') : colors.background,
                }}
                className="flex-1 py-3 rounded-xl items-center justify-center"
              >
                <Text
                  style={{
                    color: paymentMethod === 'UPI' ? (isDark ? '#000000' : '#FFFFFF') : colors.textPrimary,
                    fontWeight: '800',
                  }}
                  className="text-xs"
                >
                  UPI / Card
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3 pt-2">
              <TouchableOpacity
                onPress={() => setSettlingTable(null)}
                disabled={isSettling}
                className="flex-1 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 items-center justify-center"
              >
                <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSettleBill}
                disabled={isSettling}
                style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                className="flex-1 py-3 rounded-xl items-center justify-center flex-row gap-1.5"
              >
                {isSettling ? (
                  <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
                ) : (
                  <Text
                    style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                    className="text-xs font-black"
                  >
                    Confirm & Settle
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
