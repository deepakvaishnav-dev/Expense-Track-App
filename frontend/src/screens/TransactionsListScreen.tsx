import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';
import { Svg, Path } from 'react-native-svg';

export const TransactionsListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Modal / Dropdown states
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);

  // Custom Delete Confirmation Modal states
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [transactionToDeleteId, setTransactionToDeleteId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [selectedCategory, selectedMonth, selectedTag])
  );

  const fetchData = async (showLoading = false) => {
    if (showLoading || transactions.length === 0) {
      setLoading(true);
    }
    try {
      // Fetch categories for mapping/filters
      const catRes = await api.get('/categories/');
      setCategories(catRes.data);

      // Build query parameters
      let url = '/transactions/?limit=100';
      if (selectedCategory && selectedCategory !== 'All') {
        url += `&category_id=${selectedCategory}`;
      }

      const res = await api.get(url);
      setTransactions(res.data);
    } catch (e) {
      console.warn(e);
      Alert.alert('Error', 'Failed to retrieve transactions list.');
    } finally {
      setLoading(false);
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
    try {
      setLoading(true);
      setDeleteModalVisible(false);
      await api.delete(`/transactions/${transactionToDeleteId}`);
      fetchData(false);
    } catch (e: any) {
      console.warn(e);
      if (Platform.OS === 'web') {
        (globalThis as any).alert('Failed to delete transaction.');
      } else {
        Alert.alert('Error', 'Failed to delete transaction.');
      }
    } finally {
      setTransactionToDeleteId(null);
      setLoading(false);
    }
  };

  // Filter client-side for search and month/tags
  const filteredTransactions = transactions.filter((t) => {
    // Search filter
    const matchesSearch = t.merchant?.toLowerCase().includes(search.toLowerCase()) || 
                          (t.notes && t.notes.toLowerCase().includes(search.toLowerCase()));

    // Month filter (approximate checking of ISO date string)
    let matchesMonth = true;
    if (selectedMonth !== 'All' && t.date) {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const dateObj = new Date(t.date);
      const monthName = monthNames[dateObj.getMonth()];
      matchesMonth = monthName.toLowerCase() === selectedMonth.toLowerCase();
    }

    // Tag filter
    let matchesTag = true;
    if (selectedTag !== 'All') {
      if (selectedTag === 'Office') {
        matchesTag = t.tags && t.tags.includes('Office') || (t.notes && t.notes.toLowerCase().includes('office'));
      } else if (selectedTag === 'Personal') {
        matchesTag = t.tags && t.tags.includes('Personal') || (t.notes && t.notes.toLowerCase().includes('personal'));
      }
    }

    return matchesSearch && matchesMonth && matchesTag;
  });

  // Group transactions by date
  const getGroupedTransactions = () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const groups: { [key: string]: any[] } = {
      Today: [],
      Yesterday: [],
      Previous: []
    };

    filteredTransactions.forEach((t) => {
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
  };

  const grouped = getGroupedTransactions();

  const getCategoryDetails = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return { name: 'Others', color: '#6b7280', icon: '🏷️' };
    
    // Resolve emoji
    let emoji = '🏷️';
    const n = cat.name.toLowerCase();
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

    return { name: cat.name, color: cat.color, icon: emoji };
  };

  const months = ['All', 'June', 'May', 'April', 'March'];
  const tags = ['All', 'Office', 'Personal'];

  const renderTransactionItem = (t: any) => {
    const cat = getCategoryDetails(t.category_id);
    const amountFloat = parseFloat(t.amount);
    
    // Format date time
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
            <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>{t.merchant || 'Unknown'}</Text>
            <Text className="text-gray-400 text-xs mt-0.5">{cat.name} • {timeStr}</Text>
          </View>
        </View>

        {/* Amount & Actions */}
        <View className="flex-row items-center ml-2">
          {/* Amount & Status Badge */}
          <View className="items-end mr-3">
            <Text className="text-gray-900 font-extrabold text-base">₹{amountFloat.toLocaleString()}</Text>
            <Text className={`text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full ${
              isAuto ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-500'
            }`}>
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
    <View className="flex-1 bg-white p-6">
      {/* Header */}
      <View className="flex-row items-center justify-between mt-6 mb-6">
        <Text className="text-gray-900 text-2xl font-black">Transactions List</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
        >
          <Text className="text-lg">🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View className="flex-row items-center bg-gray-100 px-4 py-3.5 rounded-2xl mb-4">
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
      <View className="flex-row mb-6 justify-between space-x-2">
        {/* Month Selector */}
        <TouchableOpacity 
          onPress={() => setShowMonthPicker(!showMonthPicker)}
          className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 flex-row justify-between items-center mr-1"
        >
          <Text className="text-gray-800 text-xs font-bold" numberOfLines={1}>Month: {selectedMonth}</Text>
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
          <Text className="text-gray-800 text-xs font-bold" numberOfLines={1}>Tag: {selectedTag}</Text>
          <Text className="text-gray-400 text-[10px]">▼</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown Modals (Simple inline lists if toggled) */}
      {showMonthPicker && (
        <View className="bg-gray-50 border border-gray-200 rounded-2xl p-2 mb-4 flex-row flex-wrap gap-2">
          {months.map((m) => (
            <TouchableOpacity 
              key={m} 
              onPress={() => { setSelectedMonth(m); setShowMonthPicker(false); }}
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
            onPress={() => { setSelectedCategory(''); setShowCatPicker(false); }}
            className={`px-3 py-1.5 rounded-lg ${!selectedCategory ? 'bg-blue-500' : 'bg-gray-200'}`}
          >
            <Text className={`font-bold text-xs ${!selectedCategory ? 'text-white' : 'text-gray-700'}`}>All</Text>
          </TouchableOpacity>
          {categories.map((c) => (
            <TouchableOpacity 
              key={c.id} 
              onPress={() => { setSelectedCategory(c.id); setShowCatPicker(false); }}
              className={`px-3 py-1.5 rounded-lg ${selectedCategory === c.id ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-bold text-xs ${selectedCategory === c.id ? 'text-white' : 'text-gray-700'}`}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showTagPicker && (
        <View className="bg-gray-50 border border-gray-200 rounded-2xl p-2 mb-4 flex-row flex-wrap gap-2">
          {tags.map((t) => (
            <TouchableOpacity 
              key={t} 
              onPress={() => { setSelectedTag(t); setShowTagPicker(false); }}
              className={`px-3 py-1.5 rounded-lg ${selectedTag === t ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-bold text-xs ${selectedTag === t ? 'text-white' : 'text-gray-700'}`}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Transactions List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-400 text-lg font-bold">No transactions found</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">Try adjusting search query or filters</Text>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Today Group */}
          {grouped.Today.length > 0 && (
            <View className="mb-6">
              <Text className="text-gray-400 font-black text-sm mb-2 tracking-wider">TODAY</Text>
              {grouped.Today.map(renderTransactionItem)}
            </View>
          )}

          {/* Yesterday Group */}
          {grouped.Yesterday.length > 0 && (
            <View className="mb-6">
              <Text className="text-gray-400 font-black text-sm mb-2 tracking-wider">YESTERDAY</Text>
              {grouped.Yesterday.map(renderTransactionItem)}
            </View>
          )}

          {/* Previous Transactions Group */}
          {grouped.Previous.length > 0 && (
            <View className="mb-6">
              <Text className="text-gray-400 font-black text-sm mb-2 tracking-wider">PREVIOUS TRANSACTIONS</Text>
              {grouped.Previous.map(renderTransactionItem)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteModalVisible && (
        <View className="absolute inset-0 bg-black/60 justify-center items-center p-6 z-50">
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
      )}
    </View>
  );
};
