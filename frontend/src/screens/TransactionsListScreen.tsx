import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';
import { Svg, Path } from 'react-native-svg';
import { showCustomAlert } from '../store/alertStore';
import { cacheService, CACHE_KEYS } from '../services/cacheService';

const PAGE_SIZE = 25;

export const TransactionsListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Lazy loading pagination window
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Modal / Dropdown states
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Custom Delete Confirmation Modal states
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [transactionToDeleteId, setTransactionToDeleteId] = useState<string | null>(null);

  // 1. Instant Cache Hydration: Read memory / AsyncStorage on initial mount for 0ms render
  useEffect(() => {
    loadCachedDataFirst();
  }, []);

  const loadCachedDataFirst = async () => {
    try {
      const [cachedTxns, cachedCats] = await Promise.all([
        cacheService.get<any[]>(CACHE_KEYS.TRANSACTIONS),
        cacheService.get<any[]>(CACHE_KEYS.CATEGORIES),
      ]);

      if (cachedTxns && cachedTxns.length > 0) {
        setTransactions(cachedTxns);
        setLoading(false); // Instantly render cached data!
      }
      if (cachedCats && cachedCats.length > 0) {
        setCategories(cachedCats);
      }
    } catch (e) {
      console.warn('[Transactions] Cache load error:', e);
    }
  };

  // Re-fetch in background silently on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchData(false);
    }, [selectedCategory, selectedMonth, selectedTag])
  );

  // Reset lazy load window when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, selectedCategory, selectedMonth, selectedTag]);

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else if (transactions.length === 0) {
      // Only show full loader if there is no cache loaded yet
      setLoading(true);
    } else {
      setIsSyncing(true);
    }

    try {
      // Build query parameters
      let url = '/transactions/?limit=150';
      if (selectedCategory && selectedCategory !== 'All') {
        url += `&category_id=${selectedCategory}`;
      }

      // Fetch categories and transactions in PARALLEL to eliminate network waterfall
      const [catRes, txnRes] = await Promise.all([
        api.get('/categories/').catch((err) => {
          console.warn('[Transactions] Category fetch failed:', err);
          return null;
        }),
        api.get(url),
      ]);

      if (catRes?.data) {
        setCategories(catRes.data);
        cacheService.set(CACHE_KEYS.CATEGORIES, catRes.data).catch(() => {});
      }

      if (txnRes?.data) {
        setTransactions(txnRes.data);
        // Only update primary cache if this was an unfiltered query
        if (!selectedCategory || selectedCategory === 'All') {
          cacheService.set(CACHE_KEYS.TRANSACTIONS, txnRes.data).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('[Transactions] Fetch error:', e);
      if (transactions.length === 0) {
        showCustomAlert('Error', 'Failed to retrieve transactions list.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsSyncing(false);
    }
  };

  const handleEditTransaction = (t: any) => {
    navigation.navigate('AddTransaction', { transaction: t });
  };

  const handleDeleteTransaction = (txnId: string) => {
    setTransactionToDeleteId(txnId);
    setDeleteModalVisible(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDeleteId) return;
    const targetId = transactionToDeleteId;
    setDeleteModalVisible(false);
    setTransactionToDeleteId(null);

    // Optimistic UI update: Remove instantly for maximum responsiveness
    const previousTransactions = [...transactions];
    const updated = transactions.filter((t) => t.id !== targetId);
    setTransactions(updated);
    cacheService.set(CACHE_KEYS.TRANSACTIONS, updated).catch(() => {});
    // Invalidate dashboard so it refreshes its totals
    cacheService.invalidate(CACHE_KEYS.DASHBOARD).catch(() => {});

    try {
      await api.delete(`/transactions/${targetId}`);
    } catch (e: any) {
      console.warn('[Transactions] Delete error:', e);
      // Revert if failed
      setTransactions(previousTransactions);
      cacheService.set(CACHE_KEYS.TRANSACTIONS, previousTransactions).catch(() => {});
      showCustomAlert('Error', 'Failed to delete transaction.', 'error');
    }
  };

  // Pre-index categories into Map for instant O(1) lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; icon: string }>();
    categories.forEach((cat) => {
      let emoji = '🏷️';
      const n = (cat.name || '').toLowerCase();
      if (cat.icon === 'food-fork-spoon' || n.includes('food') || n.includes('restaurant')) emoji = '🍔';
      else if (cat.icon === 'cart' || n.includes('grocery')) emoji = '🛒';
      else if (n.includes('shopping')) emoji = '🛍️';
      else if (n.includes('fuel') || n.includes('gas')) emoji = '⛽';
      else if (n.includes('travel') || n.includes('transport')) emoji = '✈️';
      else if (n.includes('medical') || n.includes('health')) emoji = '🏥';
      else if (n.includes('entertainment') || n.includes('game')) emoji = '🎮';
      else if (n.includes('salary')) emoji = '💰';
      else if (n.includes('investment')) emoji = '📈';
      else if (n.includes('rent') || n.includes('housing')) emoji = '🏠';
      else if (n.includes('bill') || n.includes('utility')) emoji = '⚡';
      else if (n.includes('emi') || n.includes('card')) emoji = '💳';
      else if (n.includes('subscription')) emoji = '🎬';

      map.set(cat.id, { name: cat.name, color: cat.color || '#6b7280', icon: emoji });
    });
    return map;
  }, [categories]);

  const getCategoryDetails = (catId: string) => {
    return categoryMap.get(catId) || { name: 'Others', color: '#6b7280', icon: '🏷️' };
  };

  // Filter client-side for search and month/tags
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Search filter
      const matchesSearch =
        !search ||
        (t.merchant && t.merchant.toLowerCase().includes(search.toLowerCase())) ||
        (t.notes && t.notes.toLowerCase().includes(search.toLowerCase()));

      // Month filter
      let matchesMonth = true;
      if (selectedMonth !== 'All' && t.date) {
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ];
        const dateObj = new Date(t.date);
        const monthName = monthNames[dateObj.getMonth()];
        matchesMonth = monthName?.toLowerCase() === selectedMonth.toLowerCase();
      }

      // Tag filter
      let matchesTag = true;
      if (selectedTag !== 'All') {
        if (selectedTag === 'Office') {
          matchesTag =
            (t.tags && t.tags.includes('Office')) ||
            (t.notes && t.notes.toLowerCase().includes('office'));
        } else if (selectedTag === 'Personal') {
          matchesTag =
            (t.tags && t.tags.includes('Personal')) ||
            (t.notes && t.notes.toLowerCase().includes('personal'));
        }
      }

      return matchesSearch && matchesMonth && matchesTag;
    });
  }, [transactions, search, selectedMonth, selectedTag]);

  // Windowed subset of transactions for lazy progressive rendering
  const displayedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, visibleCount);
  }, [filteredTransactions, visibleCount]);

  // Group displayed transactions by date
  const grouped = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const groups: { [key: string]: any[] } = {
      Today: [],
      Yesterday: [],
      Previous: [],
    };

    displayedTransactions.forEach((t) => {
      if (!t.date) {
        groups.Previous.push(t);
        return;
      }
      const tDate = new Date(t.date);
      if (tDate.toDateString() === today.toDateString()) {
        groups.Today.push(t);
      } else if (tDate.toDateString() === yesterday.toDateString()) {
        groups.Yesterday.push(t);
      } else {
        groups.Previous.push(t);
      }
    });

    return groups;
  }, [displayedTransactions]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 120;
    if (isCloseToBottom && visibleCount < filteredTransactions.length) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredTransactions.length));
    }
  };

  const months = ['All', 'June', 'May', 'April', 'March'];
  const tags = ['All', 'Office', 'Personal'];

  const renderTransactionItem = (t: any) => {
    const cat = getCategoryDetails(t.category_id);
    const amountFloat = parseFloat(t.amount || '0');

    let timeStr = '12:00 PM';
    if (t.date) {
      const d = new Date(t.date);
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const isAuto = t.raw_source && t.raw_source !== 'Manual';

    return (
      <View key={t.id} className="flex-row items-center justify-between py-4 border-b border-gray-100">
        <View className="flex-row items-center flex-1">
          {/* Circular Category Icon */}
          <View
            style={{ backgroundColor: `${cat.color}20` }}
            className="w-12 h-12 rounded-full items-center justify-center mr-3"
          >
            <Text className="text-xl">{cat.icon}</Text>
          </View>

          {/* Details */}
          <View className="flex-1">
            <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>
              {t.merchant || 'Unknown'}
            </Text>
            <Text className="text-gray-400 text-xs mt-0.5">
              {cat.name} • {timeStr}
            </Text>
          </View>
        </View>

        {/* Amount & Actions */}
        <View className="flex-row items-center ml-2">
          {/* Amount & Status Badge */}
          <View className="items-end mr-3">
            <Text
              className={`font-extrabold text-base ${
                (t.type || 'expense').toLowerCase() === 'expense' ? 'text-gray-900' : 'text-emerald-600'
              }`}
            >
              {(t.type || 'expense').toLowerCase() === 'expense' ? '-' : '+'}₹{amountFloat.toLocaleString()}
            </Text>
            <Text
              className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full ${
                isAuto ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {isAuto ? 'Auto' : 'Manual'}
            </Text>
          </View>

          {/* Edit / Delete Buttons */}
          <View className="flex-row gap-1.5">
            <TouchableOpacity
              onPress={() => handleEditTransaction(t)}
              className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center border border-blue-100"
            >
              <Text className="text-xs">✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteTransaction(t.id)}
              className="w-8 h-8 rounded-full bg-red-50 items-center justify-center border border-red-100"
            >
              <Text className="text-xs">🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white px-6" style={{ paddingTop: Math.max(insets.top, 16) }}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Text className="text-gray-900 text-2xl font-black">Transactions</Text>
          {isSyncing && (
            <View className="ml-3 bg-blue-50 px-2.5 py-1 rounded-full flex-row items-center border border-blue-100">
              <ActivityIndicator size="small" color="#2563eb" style={{ transform: [{ scale: 0.7 }] }} />
              <Text className="text-blue-600 text-[11px] font-bold ml-1">Syncing</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <Text className="text-lg">🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View className="flex-row items-center bg-gray-100 px-4 py-3 rounded-2xl mb-3">
        <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" className="mr-3">
          <Path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </Svg>
        <TextInput
          placeholder="Search merchant, notes..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          className="flex-1 text-gray-950 text-base p-0"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} className="p-1">
            <Text className="text-gray-400 font-bold">✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters Bar */}
      <View className="flex-row mb-4 justify-between space-x-2">
        {/* Month Selector */}
        <TouchableOpacity
          onPress={() => setShowMonthPicker(!showMonthPicker)}
          className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 flex-row justify-between items-center mr-1"
        >
          <Text className="text-gray-800 text-xs font-bold" numberOfLines={1}>
            Month: {selectedMonth}
          </Text>
          <Text className="text-gray-400 text-[10px]">▼</Text>
        </TouchableOpacity>

        {/* Category Selector */}
        <TouchableOpacity
          onPress={() => setShowCatPicker(!showCatPicker)}
          className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 flex-row justify-between items-center mx-1"
        >
          <Text className="text-gray-800 text-xs font-bold" numberOfLines={1}>
            Cat: {selectedCategory ? getCategoryDetails(selectedCategory).name : 'All'}
          </Text>
          <Text className="text-gray-400 text-[10px]">▼</Text>
        </TouchableOpacity>

        {/* Tag Selector */}
        <TouchableOpacity
          onPress={() => setShowTagPicker(!showTagPicker)}
          className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 flex-row justify-between items-center ml-1"
        >
          <Text className="text-gray-800 text-xs font-bold" numberOfLines={1}>
            Tag: {selectedTag}
          </Text>
          <Text className="text-gray-400 text-[10px]">▼</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown Modals */}
      {showMonthPicker && (
        <View className="bg-gray-50 border border-gray-200 rounded-2xl p-2 mb-4 flex-row flex-wrap gap-2">
          {months.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => {
                setSelectedMonth(m);
                setShowMonthPicker(false);
              }}
              className={`px-3 py-1.5 rounded-lg ${selectedMonth === m ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-bold text-xs ${selectedMonth === m ? 'text-white' : 'text-gray-700'}`}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showCatPicker && (
        <View className="bg-gray-50 border border-gray-200 rounded-2xl p-2 mb-4 flex-row flex-wrap gap-2">
          <TouchableOpacity
            onPress={() => {
              setSelectedCategory('');
              setShowCatPicker(false);
            }}
            className={`px-3 py-1.5 rounded-lg ${!selectedCategory ? 'bg-blue-500' : 'bg-gray-200'}`}
          >
            <Text className={`font-bold text-xs ${!selectedCategory ? 'text-white' : 'text-gray-700'}`}>All</Text>
          </TouchableOpacity>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => {
                setSelectedCategory(c.id);
                setShowCatPicker(false);
              }}
              className={`px-3 py-1.5 rounded-lg ${selectedCategory === c.id ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-bold text-xs ${selectedCategory === c.id ? 'text-white' : 'text-gray-700'}`}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showTagPicker && (
        <View className="bg-gray-50 border border-gray-200 rounded-2xl p-2 mb-4 flex-row flex-wrap gap-2">
          {tags.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => {
                setSelectedTag(t);
                setShowTagPicker(false);
              }}
              className={`px-3 py-1.5 rounded-lg ${selectedTag === t ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-bold text-xs ${selectedTag === t ? 'text-white' : 'text-gray-700'}`}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Transactions List */}
      {loading && transactions.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-400 text-xs font-semibold mt-3">Loading transactions...</Text>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-400 text-lg font-bold">No transactions found</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">Try adjusting search query or filters</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
        >
          {/* Today Group */}
          {grouped.Today.length > 0 && (
            <View className="mb-5">
              <Text className="text-gray-400 font-black text-xs mb-2 tracking-wider">TODAY</Text>
              {grouped.Today.map(renderTransactionItem)}
            </View>
          )}

          {/* Yesterday Group */}
          {grouped.Yesterday.length > 0 && (
            <View className="mb-5">
              <Text className="text-gray-400 font-black text-xs mb-2 tracking-wider">YESTERDAY</Text>
              {grouped.Yesterday.map(renderTransactionItem)}
            </View>
          )}

          {/* Previous Transactions Group */}
          {grouped.Previous.length > 0 && (
            <View className="mb-5">
              <Text className="text-gray-400 font-black text-xs mb-2 tracking-wider">PREVIOUS TRANSACTIONS</Text>
              {grouped.Previous.map(renderTransactionItem)}
            </View>
          )}

          {/* Progressive Lazy Loading Footer */}
          {visibleCount < filteredTransactions.length && (
            <TouchableOpacity
              onPress={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredTransactions.length))}
              className="py-3.5 bg-gray-100 rounded-2xl items-center mt-2 border border-gray-200"
            >
              <Text className="text-blue-600 font-bold text-xs">
                Load More Transactions ({displayedTransactions.length} of {filteredTransactions.length})
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Custom Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center p-6">
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100">
            {/* Warning Icon */}
            <View className="items-center mb-4">
              <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-2 border border-red-100">
                <Text className="text-3xl">🗑️</Text>
              </View>
              <Text className="text-gray-900 text-lg font-black text-center">Delete Transaction</Text>
            </View>

            <Text className="text-gray-500 text-sm text-center mb-6 leading-5">
              Are you sure you want to delete this transaction? This will revert the account balance adjustment.
            </Text>

            {/* Actions */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setDeleteModalVisible(false);
                  setTransactionToDeleteId(null);
                }}
                className="flex-1 bg-gray-100 py-3.5 rounded-2xl items-center border border-gray-200"
              >
                <Text className="text-gray-700 font-bold text-sm">No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDeleteTransaction}
                className="flex-1 bg-red-600 py-3.5 rounded-2xl items-center shadow-sm shadow-red-200"
              >
                <Text className="text-white font-extrabold text-sm">Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
