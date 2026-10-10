import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Platform,
  KeyboardAvoidingView,
  Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { api } from '../services/api';
import { DatePickerModal } from '../components/common';
import { showCustomAlert } from '../store/alertStore';

export const AddTransactionScreen: React.FC<{ route: any, navigation: any }> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const isBottomFieldFocused = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
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

  const transactionType = watch('type');
  const selectedCategory = watch('categoryId');
  const selectedPaymentMethod = watch('paymentMethod');

  useEffect(() => {
    fetchFormData();
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        if (isBottomFieldFocused.current) {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
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
      
      const formattedAmount = parseFloat(data.amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      if (transactionToEdit) {
        showCustomAlert(
          'Transaction Updated! ✨',
          `Successfully updated ${data.type.toLowerCase()} details.`,
          'success',
          [{ text: 'Great!', onPress: () => navigation.pop() }],
          {
            tag: data.type.toUpperCase(),
            highlightText: `₹${formattedAmount}`,
          }
        );
      } else if (data.type === 'Income') {
        showCustomAlert(
          'Income Added! 💰',
          `Successfully added Income of ₹${formattedAmount}${data.merchant?.trim() ? ` from ${data.merchant.trim()}` : ''}.`,
          'success',
          [{ text: 'Great!', onPress: () => navigation.pop() }],
          {
            tag: 'INCOME',
            highlightText: `+ ₹${formattedAmount}`,
          }
        );
      } else {
        showCustomAlert(
          'Expense Added! 💸',
          `Successfully added Expense of ₹${formattedAmount}${data.merchant?.trim() ? ` for ${data.merchant.trim()}` : ''}.`,
          'success',
          [{ text: 'Great!', onPress: () => navigation.pop() }],
          {
            tag: 'EXPENSE',
            highlightText: `- ₹${formattedAmount}`,
          }
        );
      }
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 bg-white px-6" 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ 
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom + 40, 60) + (Platform.OS === 'android' ? keyboardHeight : 20),
        }}
      >
      {/* Header */}
      <View className="flex-row items-center justify-between gap-3 mb-6">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.pop()} className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
            <Text className="text-gray-900 text-lg font-bold">←</Text>
          </TouchableOpacity>
          <Text className="text-gray-900 text-xl font-black">
            {transactionToEdit ? 'Edit Entry' : 'New Transaction'}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => navigation.navigate('ScanReceipt')}
          className="bg-blue-50 px-3.5 py-2 rounded-full border border-blue-100 flex-row items-center"
        >
          <Text className="text-blue-600 font-extrabold text-xs">📷 Scan Receipt</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Type Toggle (Expense vs Income) */}
      <Controller
        control={control}
        name="type"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-6">
            <TouchableOpacity
              onPress={() => onChange('Expense')}
              activeOpacity={0.8}
              className={`flex-1 py-3 rounded-xl flex-row items-center justify-center ${
                value === 'Expense' ? 'bg-rose-500 shadow-sm' : 'bg-transparent'
              }`}
            >
              <Text className="mr-1.5 text-base">💸</Text>
              <Text className={`text-sm font-black tracking-wide ${value === 'Expense' ? 'text-white' : 'text-gray-600'}`}>
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onChange('Income')}
              activeOpacity={0.8}
              className={`flex-1 py-3 rounded-xl flex-row items-center justify-center ${
                value === 'Income' ? 'bg-emerald-600 shadow-sm' : 'bg-transparent'
              }`}
            >
              <Text className="mr-1.5 text-base">💰</Text>
              <Text className={`text-sm font-black tracking-wide ${value === 'Income' ? 'text-white' : 'text-gray-600'}`}>
                Income
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Large Amount Field */}
      <View className="mb-6">
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
          {transactionType === 'Income' ? 'Income Amount' : 'Expense Amount'}
        </Text>
        <Controller
          control={control}
          name="amount"
          rules={{
            required: 'Amount is required',
            pattern: { value: /^\d+(\.\d{1,2})?$/, message: 'Invalid decimal amount' }
          }}
          render={({ field: { onChange, value } }) => (
            <View className="flex-row items-center border-b-2 border-gray-150 pb-2">
              <Text className={`text-4xl font-black mr-2 ${transactionType === 'Income' ? 'text-emerald-600' : 'text-gray-900'}`}>
                ₹
              </Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="0.00"
                placeholderTextColor="#cbd5e1"
                keyboardType="decimal-pad"
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
              placeholder="Add tags (comma separated, e.g. food, trip)..."
              placeholderTextColor="#94a3b8"
              onFocus={() => {
                isBottomFieldFocused.current = true;
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 200);
              }}
              onBlur={() => {
                isBottomFieldFocused.current = false;
              }}
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
              onFocus={() => {
                isBottomFieldFocused.current = true;
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 200);
              }}
              onBlur={() => {
                isBottomFieldFocused.current = false;
              }}
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
        className={`${transactionType === 'Income' ? 'bg-emerald-600' : 'bg-blue-600'} py-4 rounded-2xl items-center justify-center shadow-md mb-6`}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text className="text-white font-extrabold text-base tracking-wider">
            {transactionToEdit ? 'UPDATE TRANSACTION' : transactionType === 'Income' ? 'SAVE INCOME' : 'SAVE EXPENSE'}
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
  </KeyboardAvoidingView>
);
};
