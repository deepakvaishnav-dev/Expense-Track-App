import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  khataService,
  KhataPerson,
  KhataTransaction,
  KhataSummary,
  KhataEntryType,
} from '../services/khataService';
import { showCustomAlert } from '../store/alertStore';

export const KhataBookScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [persons, setPersons] = useState<KhataPerson[]>([]);
  const [summary, setSummary] = useState<KhataSummary>({
    totalReceivable: 0,
    totalPayable: 0,
    netBalance: 0,
    totalPersons: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'RECEIVABLE' | 'PAYABLE' | 'SETTLED'>('ALL');

  // Modal States
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<KhataPerson | null>(null);
  const [selectedPersonTxns, setSelectedPersonTxns] = useState<KhataTransaction[]>([]);

  // Add Form Inputs
  const [entryType, setEntryType] = useState<KhataEntryType>('GAVE');
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [personsList, sum] = await Promise.all([
        khataService.getPersons(),
        khataService.getSummary(),
      ]);
      setPersons(personsList);
      setSummary(sum);

      // If a person is currently open in detail modal, refresh their data
      if (selectedPerson) {
        const updatedP = personsList.find((p) => p.id === selectedPerson.id);
        if (updatedP) {
          setSelectedPerson(updatedP);
          const txns = await khataService.getPersonTransactions(updatedP.id);
          setSelectedPersonTxns(txns);
        }
      }
    } catch (e) {
      console.warn('Error loading khata data:', e);
    } finally {
      setLoading(false);
    }
  };

  const openPersonDetail = async (person: KhataPerson) => {
    setSelectedPerson(person);
    try {
      const txns = await khataService.getPersonTransactions(person.id);
      setSelectedPersonTxns(txns);
      setDetailModalVisible(true);
    } catch (e) {
      console.warn(e);
    }
  };

  const handleOpenAdd = (type: KhataEntryType = 'GAVE', defaultPerson?: string) => {
    setEntryType(type);
    setPersonName(defaultPerson || (selectedPerson ? selectedPerson.name : ''));
    setPhone(selectedPerson?.phone || '');
    setAmount('');
    setNote('');
    setAddModalVisible(true);
  };

  const handleSaveEntry = async () => {
    if (!personName.trim()) {
      showCustomAlert('Required', 'Please enter a person name.', 'warning');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showCustomAlert('Invalid Amount', 'Please enter a valid amount greater than 0.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await khataService.addTransaction({
        personName,
        phone,
        type: entryType,
        amount: parsedAmount,
        note,
      });

      setAddModalVisible(false);
      showCustomAlert(
        'Entry Saved! ⚡',
        `${entryType === 'GAVE' ? 'Maine Diye' : 'Maine Liye'}: ₹${parsedAmount.toLocaleString()} (${personName}) successfully logged.`,
        'success'
      );
      await loadData();
    } catch (e) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to save transaction entry.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSettleAccount = (person: KhataPerson) => {
    showCustomAlert(
      'Settle Account (Hisab Barabar)?',
      `Clear pending balance of ₹${Math.abs(person.netBalance).toLocaleString()} for ${person.name}?`,
      'info',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle Now',
          onPress: async () => {
            await khataService.settlePerson(person.id);
            showCustomAlert('Settled! 🤝', `Account with ${person.name} marked as settled.`, 'success');
            await loadData();
          },
        },
      ]
    );
  };

  const handleDeleteTxn = (txnId: string) => {
    showCustomAlert(
      'Delete Entry?',
      'Are you sure you want to remove this transaction record?',
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await khataService.deleteTransaction(txnId);
            if (selectedPerson) {
              const txns = await khataService.getPersonTransactions(selectedPerson.id);
              setSelectedPersonTxns(txns);
            }
            await loadData();
          },
        },
      ]
    );
  };

  const handleSendWhatsAppReminder = (person: KhataPerson) => {
    if (person.netBalance <= 0) {
      showCustomAlert('No Pending Dues', `${person.name} does not have any pending amount to collect.`, 'info');
      return;
    }

    const message = encodeURIComponent(
      `Namaste ${person.name}, gentle reminder regarding pending balance of ₹${person.netBalance.toLocaleString()} on our Expense Tracker account. Thank you!`
    );

    const cleanPhone = person.phone ? person.phone.replace(/[^0-9]/g, '') : '';
    const url = cleanPhone ? `whatsapp://send?phone=${cleanPhone}&text=${message}` : `whatsapp://send?text=${message}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          showCustomAlert('WhatsApp Not Found', 'Could not open WhatsApp on this device.', 'warning');
        }
      })
      .catch(() => {
        showCustomAlert('Error', 'Failed to open WhatsApp.', 'error');
      });
  };

  // Filter persons list
  const filteredPersons = persons.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery)) ||
      (p.lastNote && p.lastNote.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilter === 'RECEIVABLE') return p.netBalance > 0;
    if (activeFilter === 'PAYABLE') return p.netBalance < 0;
    if (activeFilter === 'SETTLED') return p.netBalance === 0;
    return true;
  });

  return (
    <View className="flex-1 bg-gray-50">
      {/* Top Header */}
      <View className="bg-blue-600 pt-12 pb-6 px-6 rounded-b-[36px] shadow-md">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity
            onPress={() => navigation.pop()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <Text className="text-white text-xl font-bold">←</Text>
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-white text-xl font-black">KhataBook (Udhaar)</Text>
            <Text className="text-blue-100 text-[11px] font-medium">Person-to-Person Ledger</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleOpenAdd('GAVE')}
            className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm"
          >
            <Text className="text-blue-600 text-2xl font-black leading-6">+</Text>
          </TouchableOpacity>
        </View>

        {/* Khata Dual Metric Summary Cards */}
        <View className="flex-row justify-between mt-1">
          {/* Kul Lena Hai (Receivable) */}
          <View className="w-[48%] bg-white rounded-2xl p-3.5 shadow-sm border border-emerald-100">
            <View className="flex-row items-center mb-1">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
              <Text className="text-emerald-700 text-[10px] font-black tracking-wider">KUL LENA HAI (GET)</Text>
            </View>
            <Text className="text-emerald-900 text-xl font-black">
              ₹{summary.totalReceivable.toLocaleString()}
            </Text>
            <Text className="text-gray-400 text-[9px] mt-0.5">Maine Udhaar Diye</Text>
          </View>

          {/* Kul Dena Hai (Payable) */}
          <View className="w-[48%] bg-white rounded-2xl p-3.5 shadow-sm border border-rose-100">
            <View className="flex-row items-center mb-1">
              <View className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
              <Text className="text-rose-700 text-[10px] font-black tracking-wider">KUL DENA HAI (GIVE)</Text>
            </View>
            <Text className="text-rose-900 text-xl font-black">
              ₹{summary.totalPayable.toLocaleString()}
            </Text>
            <Text className="text-gray-400 text-[9px] mt-0.5">Maine Udhaar Liye</Text>
          </View>
        </View>

        {/* Net Balance Pill */}
        <View className="mt-3 bg-blue-700/60 rounded-xl py-1.5 px-3 flex-row items-center justify-between">
          <Text className="text-blue-100 text-[11px] font-bold">Net Balance (Hisab):</Text>
          <Text className={`text-xs font-black ${summary.netBalance >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
            {summary.netBalance >= 0 ? '+' : '-'}₹{Math.abs(summary.netBalance).toLocaleString()} {summary.netBalance >= 0 ? '(You will receive)' : '(You owe)'}
          </Text>
        </View>
      </View>

      {/* Main Body */}
      <View className="flex-1 px-5 pt-3">
        {/* Search & Filter Section */}
        <View className="mb-3">
          <View className="flex-row items-center bg-white px-3.5 py-2.5 rounded-2xl border border-gray-200 shadow-2xs mb-2.5">
            <Text className="text-gray-400 text-sm mr-2">🔍</Text>
            <TextInput
              placeholder="Search person name, phone, or note..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 text-gray-900 text-xs p-0 font-medium"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text className="text-gray-400 text-xs font-bold">✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {[
              { id: 'ALL', label: `All (${persons.length})` },
              { id: 'RECEIVABLE', label: `🟢 Lena Hai (${persons.filter((p) => p.netBalance > 0).length})` },
              { id: 'PAYABLE', label: `🔴 Dena Hai (${persons.filter((p) => p.netBalance < 0).length})` },
              { id: 'SETTLED', label: `🤝 Settled (${persons.filter((p) => p.netBalance === 0).length})` },
            ].map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setActiveFilter(f.id as any)}
                className={`mr-2 px-3 py-1.5 rounded-xl border ${
                  activeFilter === f.id
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    activeFilter === f.id ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Persons Ledger List */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : filteredPersons.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-4xl mb-3">📒</Text>
            <Text className="text-gray-800 text-sm font-bold">No Khata Records Found</Text>
            <Text className="text-gray-400 text-xs text-center mt-1 px-8">
              Tap "+ Add New Udhaar" below to log money given to or received from a friend or contact.
            </Text>
            <TouchableOpacity
              onPress={() => handleOpenAdd('GAVE')}
              className="mt-4 bg-blue-600 px-5 py-2.5 rounded-full shadow-sm"
            >
              <Text className="text-white text-xs font-bold">+ Add First Person</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {filteredPersons.map((person) => {
              const isReceivable = person.netBalance > 0;
              const isPayable = person.netBalance < 0;
              const isSettled = person.netBalance === 0;

              return (
                <TouchableOpacity
                  key={person.id}
                  onPress={() => openPersonDetail(person)}
                  activeOpacity={0.75}
                  className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-2xs flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1 mr-3">
                    {/* Initial Circle */}
                    <View
                      style={{ backgroundColor: person.color }}
                      className="w-12 h-12 rounded-full items-center justify-center mr-3 shadow-2xs"
                    >
                      <Text className="text-white text-base font-black">
                        {person.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Details */}
                    <View className="flex-1">
                      <Text className="text-gray-900 text-sm font-black" numberOfLines={1}>
                        {person.name}
                      </Text>
                      {person.phone ? (
                        <Text className="text-gray-400 text-[10px] font-medium">{person.phone}</Text>
                      ) : null}
                      <Text className="text-gray-500 text-[11px] mt-0.5" numberOfLines={1}>
                        {person.lastNote || 'No recent notes'}
                      </Text>
                    </View>
                  </View>

                  {/* Net Amount Column */}
                  <View className="items-end">
                    <Text
                      className={`text-sm font-black ${
                        isReceivable
                          ? 'text-emerald-600'
                          : isPayable
                          ? 'text-rose-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {isReceivable ? '+' : isPayable ? '-' : ''}₹
                      {Math.abs(person.netBalance).toLocaleString()}
                    </Text>
                    <View
                      className={`px-2 py-0.5 rounded-md mt-1 ${
                        isReceivable
                          ? 'bg-emerald-50'
                          : isPayable
                          ? 'bg-rose-50'
                          : 'bg-gray-100'
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-bold ${
                          isReceivable
                            ? 'text-emerald-700'
                            : isPayable
                            ? 'text-rose-700'
                            : 'text-gray-500'
                        }`}
                      >
                        {isReceivable ? 'LENA HAI' : isPayable ? 'DENA HAI' : 'SETTLED'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View className="h-20" />
          </ScrollView>
        )}
      </View>

      {/* Floating Bottom Quick Add Bar */}
      <View className="absolute bottom-5 left-5 right-5 flex-row justify-between">
        <TouchableOpacity
          onPress={() => handleOpenAdd('GAVE')}
          activeOpacity={0.85}
          className="flex-1 mr-2 bg-emerald-600 py-3.5 px-4 rounded-2xl flex-row items-center justify-center shadow-md shadow-emerald-600/30"
        >
          <Text className="text-white text-base mr-1.5 font-black">+</Text>
          <Text className="text-white text-xs font-black">MAINE DIYE (GAVE)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleOpenAdd('GOT')}
          activeOpacity={0.85}
          className="flex-1 ml-2 bg-rose-600 py-3.5 px-4 rounded-2xl flex-row items-center justify-center shadow-md shadow-rose-600/30"
        >
          <Text className="text-white text-base mr-1.5 font-black">-</Text>
          <Text className="text-white text-xs font-black">MAINE LIYE (GOT)</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: ADD UDHAAR TRANSACTION */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/60"
        >
          <View className="bg-white rounded-t-[32px] p-6 max-h-[90%]">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-900 text-lg font-black">
                {entryType === 'GAVE' ? '🟢 Maine Diye (Udhaar Diya)' : '🔴 Maine Liye (Udhaar Liya)'}
              </Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} className="p-1">
                <Text className="text-gray-400 text-base font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Type Switcher Tabs */}
            <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-4">
              <TouchableOpacity
                onPress={() => setEntryType('GAVE')}
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  entryType === 'GAVE' ? 'bg-emerald-600 shadow-xs' : ''
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    entryType === 'GAVE' ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  + Maine Diye (Lena Hai)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEntryType('GOT')}
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  entryType === 'GOT' ? 'bg-rose-600 shadow-xs' : ''
                }`}
              >
                <Text
                  className={`text-xs font-black ${
                    entryType === 'GOT' ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  - Maine Liye (Dena Hai)
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Person Name Input */}
              <Text className="text-gray-700 text-xs font-bold mb-1.5">Person Name *</Text>
              <TextInput
                placeholder="e.g. Aniket Sharma, Deepak, Rahul"
                placeholderTextColor="#9ca3af"
                value={personName}
                onChangeText={setPersonName}
                className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-bold mb-3 border border-gray-200"
              />

              {/* Amount Input */}
              <Text className="text-gray-700 text-xs font-bold mb-1.5">Amount (₹) *</Text>
              <TextInput
                placeholder="₹ 0.00"
                placeholderTextColor="#9ca3af"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                className="bg-gray-100 rounded-2xl px-4 py-3 text-lg text-gray-900 font-black mb-3 border border-gray-200"
              />

              {/* Phone Number (Optional) */}
              <Text className="text-gray-700 text-xs font-bold mb-1.5">Phone Number (Optional)</Text>
              <TextInput
                placeholder="e.g. +91 98765 43210 (For WhatsApp reminder)"
                placeholderTextColor="#9ca3af"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-medium mb-3 border border-gray-200"
              />

              {/* Reason / Note */}
              <Text className="text-gray-700 text-xs font-bold mb-1.5">Note / Reason</Text>
              <TextInput
                placeholder="e.g. Dinner share, Bike petrol, Urgent loan"
                placeholderTextColor="#9ca3af"
                value={note}
                onChangeText={setNote}
                className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-medium mb-5 border border-gray-200"
              />

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSaveEntry}
                disabled={saving}
                className={`py-3.5 rounded-2xl items-center justify-center mb-4 ${
                  entryType === 'GAVE' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white text-xs font-black">
                    Save {entryType === 'GAVE' ? 'Udhaar Diya' : 'Udhaar Liya'} Entry
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 2: PERSON DETAILED LEDGER & STATEMENT */}
      <Modal visible={detailModalVisible} animationType="slide">
        {selectedPerson && (
          <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="bg-blue-600 pt-12 pb-6 px-6 rounded-b-[36px] shadow-md">
              <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                  onPress={() => setDetailModalVisible(false)}
                  className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
                >
                  <Text className="text-white text-xl font-bold">←</Text>
                </TouchableOpacity>
                <Text className="text-white text-lg font-black">Khata Statement</Text>
                <TouchableOpacity
                  onPress={() => handleSettleAccount(selectedPerson)}
                  className="px-3 py-1.5 bg-white/20 rounded-full"
                >
                  <Text className="text-white text-[11px] font-bold">🤝 Settle</Text>
                </TouchableOpacity>
              </View>

              {/* Person Big Info Box */}
              <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 items-center">
                <View
                  style={{ backgroundColor: selectedPerson.color }}
                  className="w-16 h-16 rounded-full items-center justify-center mb-2 shadow-xs"
                >
                  <Text className="text-white text-2xl font-black">
                    {selectedPerson.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text className="text-gray-900 text-lg font-black">{selectedPerson.name}</Text>
                {selectedPerson.phone && (
                  <Text className="text-gray-400 text-xs font-semibold mt-0.5">{selectedPerson.phone}</Text>
                )}

                {/* Net Due Tag */}
                <View className="mt-3 flex-row items-center">
                  <Text className="text-gray-400 text-xs font-bold mr-2">Net Status:</Text>
                  <Text
                    className={`text-xl font-black ${
                      selectedPerson.netBalance > 0
                        ? 'text-emerald-600'
                        : selectedPerson.netBalance < 0
                        ? 'text-rose-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {selectedPerson.netBalance > 0
                      ? `₹${selectedPerson.netBalance.toLocaleString()} LENA HAI`
                      : selectedPerson.netBalance < 0
                      ? `₹${Math.abs(selectedPerson.netBalance).toLocaleString()} DENA HAI`
                      : 'HISAB BARABAR 🤝'}
                  </Text>
                </View>

                {/* WhatsApp Reminder Button */}
                {selectedPerson.netBalance > 0 && (
                  <TouchableOpacity
                    onPress={() => handleSendWhatsAppReminder(selectedPerson)}
                    className="mt-3 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full flex-row items-center"
                  >
                    <Text className="mr-1.5">💬</Text>
                    <Text className="text-emerald-700 text-xs font-bold">Send Reminder on WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Statement Timeline */}
            <View className="flex-1 px-6 pt-4">
              <Text className="text-gray-900 text-sm font-black mb-3">Transaction History</Text>

              {selectedPersonTxns.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-gray-400 text-xs font-bold">No entries found for this person.</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {selectedPersonTxns.map((txn) => {
                    const isGave = txn.type === 'GAVE';
                    const isSettle = txn.type === 'SETTLE';
                    const dateFormatted = new Date(txn.date).toLocaleDateString([], {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });

                    return (
                      <View
                        key={txn.id}
                        className="bg-white rounded-2xl p-4 mb-2.5 border border-gray-100 shadow-2xs flex-row items-center justify-between"
                      >
                        <View className="flex-1 mr-2">
                          <View className="flex-row items-center mb-1">
                            <View
                              className={`w-2 h-2 rounded-full mr-2 ${
                                isGave ? 'bg-emerald-500' : isSettle ? 'bg-blue-500' : 'bg-rose-500'
                              }`}
                            />
                            <Text className="text-gray-900 text-xs font-black">
                              {isGave ? 'Maine Diye' : isSettle ? 'Hisab Barabar' : 'Maine Liye'}
                            </Text>
                          </View>
                          <Text className="text-gray-500 text-[11px]" numberOfLines={2}>
                            {txn.note || 'No notes added'}
                          </Text>
                          <Text className="text-gray-400 text-[9px] mt-1">{dateFormatted}</Text>
                        </View>

                        <View className="items-end">
                          <Text
                            className={`text-sm font-black ${
                              isGave ? 'text-emerald-600' : isSettle ? 'text-blue-600' : 'text-rose-600'
                            }`}
                          >
                            {isGave ? '+' : isSettle ? '' : '-'}₹{txn.amount.toLocaleString()}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleDeleteTxn(txn.id)}
                            className="mt-1 px-2 py-0.5 bg-gray-100 rounded"
                          >
                            <Text className="text-gray-400 text-[9px] font-bold">Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                  <View className="h-24" />
                </ScrollView>
              )}
            </View>

            {/* Quick Actions at Bottom of Detail Modal */}
            <View className="absolute bottom-5 left-5 right-5 flex-row justify-between">
              <TouchableOpacity
                onPress={() => handleOpenAdd('GAVE', selectedPerson.name)}
                className="flex-1 mr-2 bg-emerald-600 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-emerald-600/30"
              >
                <Text className="text-white text-xs font-black">+ Maine Diye (Gave)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleOpenAdd('GOT', selectedPerson.name)}
                className="flex-1 ml-2 bg-rose-600 py-3.5 rounded-2xl items-center justify-center shadow-md shadow-rose-600/30"
              >
                <Text className="text-white text-xs font-black">- Maine Liye (Got)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
};
