import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { api } from '../services/api';
import { DatePickerModal } from '../components/common';
import { showCustomAlert } from '../store/alertStore';

export const AddTransactionScreen: React.FC<{ route: any, navigation: any }> = ({ route, navigation }) => {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [fetchingData, setFetchingData] = useState(true);
  
  const transactionToEdit = route.params?.transaction;
  const [selectedDate, setSelectedDate] = useState<Date>(
    transactionToEdit?.date ? new Date(transactionToEdit.date) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { control, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm({
    defaultValues: {
      amount: '',
      merchant: '',
      type: 'Expense',
      categoryId: '',
      accountId: '',
      paymentMethod: 'UPI',
      notes: '',
      tagsInput: '',
    }
  });

  const selectedCategory = watch('categoryId');
  const selectedPaymentMethod = watch('paymentMethod');

  useEffect(() => {
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      const [accRes, catRes] = await Promise.all([
        api.get('/accounts/'),
        api.get('/categories/')
      ]);
      setAccounts(accRes.data);
      setCategories(catRes.data);

      if (transactionToEdit) {
        // Prefill form values for editing
        reset({
          amount: String(transactionToEdit.amount),
          merchant: transactionToEdit.merchant || '',
          type: transactionToEdit.type || 'Expense',
          categoryId: transactionToEdit.category_id || '',
          accountId: transactionToEdit.account_id || '',
          paymentMethod: transactionToEdit.payment_method || 'UPI',
          notes: transactionToEdit.notes || '',
          tagsInput: transactionToEdit.tags ? transactionToEdit.tags.join(', ') : '',
        });
      } else {
        // Auto-select first account as default
        if (accRes.data && accRes.data.length > 0) {
          setValue('accountId', accRes.data[0].id);
        }
        // Auto-select first category as default
        if (catRes.data && catRes.data.length > 0) {
          setValue('categoryId', catRes.data[0].id);
        }
      }
    } catch (e: any) {
      console.warn(e);
      showCustomAlert('Load Error', 'Failed to retrieve accounts or categories lists.', 'error');
    } finally {
      setFetchingData(false);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const tags = data.tagsInput ? data.tagsInput.split(',').map((t: string) => t.trim()).filter((t: string) => t) : [];
      
      if (transactionToEdit) {
        // Update existing transaction
        await api.put(`/transactions/${transactionToEdit.id}`, {
          amount: parseFloat(data.amount),
          merchant: data.merchant.trim() || 'Manual Expense',
          type: data.type,
          category_id: data.categoryId || null,
          account_id: data.accountId,
          payment_method: data.paymentMethod,
          notes: data.notes.trim() || null,
          tags: tags,
          date: selectedDate.toISOString(),
        });
      } else {
        // Create new transaction
        await api.post('/transactions/', {
          amount: parseFloat(data.amount),
          merchant: data.merchant.trim() || 'Manual Expense',
          type: data.type,
          category_id: data.categoryId || null,
          account_id: data.accountId,
          payment_method: data.paymentMethod,
          notes: data.notes.trim() || null,
          tags: tags,
          date: selectedDate.toISOString(),
        });
      }

      // Reset the form fields to clear them
      reset({
        amount: '',
        merchant: '',
        type: 'Expense',
        categoryId: categories.length > 0 ? categories[0].id : '',
        accountId: accounts.length > 0 ? accounts[0].id : '',
        paymentMethod: 'UPI',
        notes: '',
        tagsInput: '',
      });
      
      showCustomAlert(
        'Success', 
        transactionToEdit ? 'Transaction updated successfully.' : 'Transaction logged successfully.', 
        'success',
        [
          { text: 'Great!', onPress: () => navigation.pop() }
        ]
      );
    } catch (error: any) {
      console.warn(error);
      const msg = error.response?.data?.detail || 'Failed to save transaction.';
      showCustomAlert('Save Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Resolve emojis for category selector
  const getCategoryEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('food') || n.includes('restaurant')) return '🍔';
    if (n.includes('grocery')) return '🛒';
    if (n.includes('shopping')) return '🛍️';
    if (n.includes('fuel') || n.includes('gas')) return '⛽';
    if (n.includes('travel') || n.includes('transport')) return '✈️';
    if (n.includes('medical') || n.includes('health')) return '🏥';
    if (n.includes('entertainment') || n.includes('game')) return '🎮';
    if (n.includes('salary')) return '💰';
    if (n.includes('investment')) return '📈';
    if (n.includes('rent') || n.includes('housing')) return '🏠';
    if (n.includes('bill') || n.includes('utility')) return '⚡';
    if (n.includes('emi') || n.includes('card')) return '💳';
    if (n.includes('subscription')) return '🎬';
    return '🏷️';
  };

  return (
    <ScrollView className="flex-1 bg-white p-6" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="flex-row flex-wrap items-center justify-between gap-3 mt-6 mb-8">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.pop()} className="mr-3">
            <Text className="text-gray-900 text-2xl font-bold">←</Text>
          </TouchableOpacity>
          <Text className="text-gray-900 text-xl font-black">
            {transactionToEdit ? 'Edit Transaction' : 'Manual Entry Form'}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ScanReceipt')}
          className="bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-100 flex-row items-center"
        >
          <Text className="text-blue-600 font-extrabold text-xs">📷 Scan Receipt</Text>
        </TouchableOpacity>
      </View>

      {/* Large Amount Field */}
      <View className="mb-6">
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Large amount</Text>
        <Controller
          control={control}
          name="amount"
          rules={{
            required: 'Amount is required',
            pattern: { value: /^\d+(\.\d{1,2})?$/, message: 'Invalid decimal amount' }
          }}
          render={({ field: { onChange, value } }) => (
            <View className="flex-row items-center border-b border-gray-200 pb-2">
              <Text className="text-4xl font-black text-gray-900 mr-2">₹</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="0.00"
                placeholderTextColor="#cbd5e1"
                keyboardType="numeric"
                style={{ outlineStyle: 'none' } as any}
                className="text-4xl font-black text-gray-900 flex-1 p-0"
              />
            </View>
          )}
        />
        {errors.amount && (
          <Text className="text-red-500 text-sm mt-1">{errors.amount.message}</Text>
        )}
      </View>

      {/* Category selector (Circular emoji buttons) */}
      <View className="mb-6">
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Category</Text>
        <Controller
          control={control}
          name="categoryId"
          render={({ field: { onChange, value } }) => (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
              {categories.map((cat) => {
                const isSelected = value === cat.id;
                const emoji = getCategoryEmoji(cat.name);
                return (
                  <View key={cat.id} className="items-center mr-4">
                    <TouchableOpacity
                      onPress={() => onChange(cat.id)}
                      style={{
                        borderColor: isSelected ? cat.color : '#e5e7eb',
                        backgroundColor: isSelected ? `${cat.color}15` : 'transparent'
                      }}
                      className="border w-14 h-14 rounded-full items-center justify-center mb-1.5"
                    >
                      <Text className="text-2xl">{emoji}</Text>
                    </TouchableOpacity>
                    <Text className={`text-[10px] font-bold text-center ${isSelected ? 'text-gray-900' : 'text-gray-400'}`}>
                      {cat.name}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        />
      </View>

      {/* Date Dropdown Placeholder & Merchant Input */}
      <View className="flex-row justify-between gap-4 mb-6">
        {/* Date Dropdown */}
        <View className="flex-1">
          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Date</Text>
          <TouchableOpacity 
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
            className="border border-gray-200 bg-gray-50/60 rounded-2xl px-4 py-3.5 flex-row justify-between items-center"
          >
            <Text className="text-gray-900 font-bold text-sm">
              {selectedDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
            <Text className="text-blue-500 font-bold text-xs">📅</Text>
          </TouchableOpacity>
        </View>

        {/* Merchant Name */}
        <View className="flex-1">
          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Merchant Name</Text>
          <Controller
            control={control}
            name="merchant"
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Starbucks, Gas, etc."
                placeholderTextColor="#94a3b8"
                style={{ outlineStyle: 'none' } as any}
                className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 font-bold text-sm"
              />
            )}
          />
        </View>
      </View>

      {/* Account Selector (Clean list at bottom) */}
      <View className="mb-6">
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Select Account</Text>
        <Controller
          control={control}
          name="accountId"
          render={({ field: { onChange, value } }) => (
            <View className="flex-row flex-wrap gap-2">
              {accounts.map((acc) => {
                const isSelected = value === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    onPress={() => onChange(acc.id)}
                    className={`py-2.5 px-4 border rounded-xl items-center ${
                      isSelected ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
                    }`}
                  >
                    <Text className={`font-bold text-xs ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        />
      </View>

      {/* Payment Method selector */}
      <View className="mb-6">
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">Payment Method</Text>
        <Controller
          control={control}
          name="paymentMethod"
          render={({ field: { onChange, value } }) => (
            <View className="flex-row flex-wrap gap-2.5">
              {[
                { name: 'Cash', emoji: '💵' },
                { name: 'Bank', emoji: '🏦' },
                { name: 'GPay', emoji: '🌐' },
                { name: 'PhonePe', emoji: '📱' }
              ].map((method) => {
                const isSelected = value === method.name;
                return (
                  <TouchableOpacity
                    key={method.name}
                    onPress={() => onChange(method.name)}
                    className={`px-4 py-3 rounded-2xl border flex-row items-center ${
                      isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text className="text-lg mr-2">{method.emoji}</Text>
                    <Text className={`font-bold text-sm ${isSelected ? 'text-blue-600' : 'text-gray-700'}`}>
                      {method.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        />
      </View>

      {/* Tags section */}
      <View className="mb-8">
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Tags</Text>
        <Controller
          control={control}
          name="tagsInput"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="Add payment actions (comma separated)..."
              placeholderTextColor="#94a3b8"
              style={{ outlineStyle: 'none' } as any}
              className="border border-gray-200 rounded-2xl px-4 py-3.5 text-gray-800 text-sm font-semibold"
            />
          )}
        />
      </View>

      {/* Notes / Description */}
      <View className="mb-8">
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Notes</Text>
        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, value } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder="Optional transaction description..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={2}
              style={{ outlineStyle: 'none' } as any}
              className="border border-gray-200 rounded-2xl px-4 py-3.5 text-gray-800 text-sm font-semibold"
            />
          )}
        />
      </View>

      {/* SAVE TRANSACTION button */}
      <TouchableOpacity
        onPress={handleSubmit(onSubmit)}
        disabled={loading}
        className="bg-blue-600 py-4.5 rounded-3xl items-center justify-center shadow-md mb-12"
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text className="text-white font-extrabold text-base tracking-wider">
            {transactionToEdit ? 'UPDATE TRANSACTION' : 'SAVE TRANSACTION'}
          </Text>
        )}
      </TouchableOpacity>
      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        selectedDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date)}
        onClose={() => setShowDatePicker(false)}
      />
    </ScrollView>
  );
};
