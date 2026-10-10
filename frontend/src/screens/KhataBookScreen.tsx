import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  khataService,
  KhataPerson,
  KhataTransaction,
  KhataSummary,
  KhataEntryType,
} from '../services/khataService';
import { showCustomAlert } from '../store/alertStore';
import { DatePickerModal } from '../components/common';

export const KhataBookScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const isTab = route?.name === 'KhataTab';
  const bottomBarOffset = isTab ? insets.bottom + 72 : Math.max(insets.bottom + 16, 20);
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

  // Modals
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editPersonModalVisible, setEditPersonModalVisible] = useState(false);
  const [editTxnModalVisible, setEditTxnModalVisible] = useState(false);

  // Selected State
  const [selectedPerson, setSelectedPerson] = useState<KhataPerson | null>(null);
  const [selectedPersonTxns, setSelectedPersonTxns] = useState<KhataTransaction[]>([]);
  const [selectedTxnToEdit, setSelectedTxnToEdit] = useState<KhataTransaction | null>(null);

  // Form Inputs
  const [entryType, setEntryType] = useState<KhataEntryType>('GAVE');
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Edit Person Form Inputs
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Edit Txn Form Inputs
  const [editTxnType, setEditTxnType] = useState<KhataEntryType>('GAVE');
  const [editTxnAmount, setEditTxnAmount] = useState('');
  const [editTxnNote, setEditTxnNote] = useState('');
  const [editTxnDate, setEditTxnDate] = useState<Date>(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // Reminder Modal
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [personToRemind, setPersonToRemind] = useState<KhataPerson | null>(null);

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

      if (selectedPerson) {
        const updatedP = personsList.find((p) => p.id === selectedPerson.id);
        if (updatedP) {
          setSelectedPerson(updatedP);
          const txns = await khataService.getPersonTransactions(updatedP.id);
          setSelectedPersonTxns(txns);
        } else {
          setDetailModalVisible(false);
          setSelectedPerson(null);
        }
      }
    } catch (e) {
      console.warn('Error loading accounts data:', e);
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
    setEntryDate(new Date());
    setAddModalVisible(true);
  };

  const handleSaveEntry = async () => {
    if (!personName.trim()) {
      showCustomAlert('Required', 'Please enter a person or contact name.', 'warning');
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
        date: entryDate.toISOString(),
      });

      setAddModalVisible(false);
      showCustomAlert(
        'Record Saved! ✅',
        `${entryType === 'GAVE' ? 'Lent' : 'Borrowed'}: ₹${parsedAmount.toLocaleString('en-IN')} for ${personName.trim()} recorded.`,
        'success',
        undefined,
        {
          tag: entryType === 'GAVE' ? 'RECEIVABLE' : 'PAYABLE',
          highlightText: `${entryType === 'GAVE' ? '+' : '-'} ₹${parsedAmount.toLocaleString('en-IN')}`,
        }
      );
      await loadData();
    } catch (e) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to save record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Edit Person Details
  const handleOpenEditPerson = () => {
    if (!selectedPerson) return;
    setEditName(selectedPerson.name);
    setEditPhone(selectedPerson.phone || '');
    setEditPersonModalVisible(true);
  };

  const handleSaveEditPerson = async () => {
    if (!selectedPerson || !editName.trim()) {
      showCustomAlert('Required', 'Please provide a valid name.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const updated = await khataService.editPerson(selectedPerson.id, {
        name: editName,
        phone: editPhone,
      });
      if (updated) {
        setSelectedPerson(updated);
      }
      setEditPersonModalVisible(false);
      showCustomAlert('Updated!', 'Person details updated successfully.', 'success');
      await loadData();
    } catch (e) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to update person.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Person
  const handleDeletePerson = () => {
    if (!selectedPerson) return;
    showCustomAlert(
      'Delete Contact?',
      `Are you sure you want to completely delete "${selectedPerson.name}" and all associated transaction records?`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            await khataService.deletePerson(selectedPerson.id);
            setDetailModalVisible(false);
            setSelectedPerson(null);
            showCustomAlert('Deleted', 'Contact and records removed.', 'info');
            await loadData();
          },
        },
      ]
    );
  };

  // Edit Transaction Entry
  const handleOpenEditTxn = (txn: KhataTransaction) => {
    setSelectedTxnToEdit(txn);
    setEditTxnType(txn.type === 'SETTLE' ? 'GAVE' : txn.type);
    setEditTxnAmount(txn.amount.toString());
    setEditTxnNote(txn.note || '');
    setEditTxnDate(txn.date ? new Date(txn.date) : new Date());
    setEditTxnModalVisible(true);
  };

  const handleSaveEditTxn = async () => {
    if (!selectedTxnToEdit) return;
    const parsedAmount = parseFloat(editTxnAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      showCustomAlert('Invalid Amount', 'Please enter a valid amount.', 'warning');
      return;
    }

    setSaving(true);
    try {
      await khataService.editTransaction(selectedTxnToEdit.id, {
        type: editTxnType,
        amount: parsedAmount,
        note: editTxnNote,
        date: editTxnDate.toISOString(),
      });
      setEditTxnModalVisible(false);
      setSelectedTxnToEdit(null);
      showCustomAlert('Entry Updated! ✅', 'Transaction record updated successfully.', 'success');
      await loadData();
    } catch (e) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to update transaction.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete Transaction Entry
  const handleDeleteTxn = (txnId: string) => {
    showCustomAlert(
      'Delete Entry?',
      'Are you sure you want to remove this record from the ledger?',
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

  // Settle Account
  const handleSettleAccount = (person: KhataPerson) => {
    showCustomAlert(
      'Settle Account?',
      `Clear pending balance of ₹${Math.abs(person.netBalance).toLocaleString('en-IN')} for ${person.name}?`,
      'info',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle Now',
          onPress: async () => {
            await khataService.settlePerson(person.id);
            showCustomAlert('Account Settled', `All dues for ${person.name} marked as settled.`, 'success');
            await loadData();
          },
        },
      ]
    );
  };

  // Reminder Functions
  const openReminderModal = (person: KhataPerson) => {
    setPersonToRemind(person);
    setReminderModalVisible(true);
  };

  const getReminderMessage = (person: KhataPerson) => {
    const isReceivable = person.netBalance > 0;
    const absAmount = Math.abs(person.netBalance).toLocaleString('en-IN');
    if (isReceivable) {
      return `Hi ${person.name}, gentle reminder regarding your pending balance of ₹${absAmount} recorded on Accounts Book. Kindly clear it when convenient. Thank you! 🙏`;
    } else {
      return `Hi ${person.name}, this is a reminder regarding the pending payable amount of ₹${absAmount} on Accounts Book. Thank you!`;
    }
  };

  const handleSendWhatsApp = (person: KhataPerson) => {
    const msg = getReminderMessage(person);
    const cleanPhone = person.phone ? person.phone.replace(/[^0-9]/g, '') : '';
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `whatsapp://send?text=${encodeURIComponent(msg)}`;

    Linking.openURL(url).catch(() => {
      const fallback = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
      Linking.openURL(fallback).catch(() => {
        showCustomAlert('WhatsApp Not Available', 'WhatsApp app is not available on this device.', 'warning');
      });
    });
  };

  const handleSendSMS = (person: KhataPerson) => {
    const msg = getReminderMessage(person);
    const cleanPhone = person.phone ? person.phone.replace(/[^0-9]/g, '') : '';
    const url = `sms:${cleanPhone}?body=${encodeURIComponent(msg)}`;

    Linking.openURL(url).catch(() => {
      showCustomAlert('SMS Not Available', 'Could not open messaging app.', 'warning');
    });
  };

  const handleShareReminder = async (person: KhataPerson) => {
    try {
      const msg = getReminderMessage(person);
      await Share.share({
        title: 'Accounts Reminder',
        message: msg,
      });
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSetInAppReminder = (person: KhataPerson) => {
    setReminderModalVisible(false);
    showCustomAlert(
      'Reminder Alert Set! 🔔',
      `In-app reminder scheduled for ${person.name} regarding ₹${Math.abs(person.netBalance).toLocaleString('en-IN')}.`,
      'success',
      undefined,
      {
        tag: 'REMINDER ALERT',
        highlightText: `₹${Math.abs(person.netBalance).toLocaleString('en-IN')}`,
        iconEmoji: '🔔',
      }
    );
  };

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
      {/* Top Header - Pure English, Clean, No top right plus button */}
      <View className="bg-blue-600 pt-12 pb-6 px-6 rounded-b-[36px] shadow-md">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity
            onPress={() => navigation.pop()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <Text className="text-white text-xl font-bold">←</Text>
          </TouchableOpacity>
          <View className="items-center flex-1">
            <Text className="text-white text-xl font-black">Accounts Book</Text>
            <Text className="text-blue-100 text-[11px] font-medium">Person-to-Person Ledger</Text>
          </View>
          {/* Spacer to keep title centered without top right plus button */}
          <View className="w-10 h-10" />
        </View>

        {/* Dual Metric Summary Cards (All English) */}
        <View className="flex-row justify-between mt-1">
          {/* Total Receivable */}
          <View className="w-[48%] bg-white rounded-2xl p-3.5 shadow-sm border border-emerald-100">
            <View className="flex-row items-center mb-1">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
              <Text className="text-emerald-700 text-[10px] font-black tracking-wider">TOTAL RECEIVABLE</Text>
            </View>
            <Text className="text-emerald-900 text-xl font-black">
              ₹{summary.totalReceivable.toLocaleString()}
            </Text>
            <Text className="text-gray-400 text-[9px] mt-0.5">You Lent (To Receive)</Text>
          </View>

          {/* Total Payable */}
          <View className="w-[48%] bg-white rounded-2xl p-3.5 shadow-sm border border-rose-100">
            <View className="flex-row items-center mb-1">
              <View className="w-2 h-2 rounded-full bg-rose-500 mr-1.5" />
              <Text className="text-rose-700 text-[10px] font-black tracking-wider">TOTAL PAYABLE</Text>
            </View>
            <Text className="text-rose-900 text-xl font-black">
              ₹{summary.totalPayable.toLocaleString()}
            </Text>
            <Text className="text-gray-400 text-[9px] mt-0.5">You Borrowed (To Pay)</Text>
          </View>
        </View>

        {/* Net Balance Pill */}
        <View className="mt-3 bg-blue-700/60 rounded-xl py-1.5 px-3.5 flex-row items-center justify-between">
          <Text className="text-blue-100 text-[11px] font-bold">Net Balance:</Text>
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
              placeholder="Search by name, phone, or note..."
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

          {/* Filter Chips - Pure English */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {[
              { id: 'ALL', label: `All (${persons.length})` },
              { id: 'RECEIVABLE', label: `🟢 Receivable (${persons.filter((p) => p.netBalance > 0).length})` },
              { id: 'PAYABLE', label: `🔴 Payable (${persons.filter((p) => p.netBalance < 0).length})` },
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
          <View className="flex-1 items-center justify-center py-14">
            <Text className="text-5xl mb-3">📒</Text>
            <Text className="text-gray-900 text-base font-black">No Accounts Added Yet</Text>
            <Text className="text-gray-400 text-xs text-center mt-1 px-8">
              Tap the buttons below to record money you lent or borrowed with friends and contacts.
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {filteredPersons.map((person) => {
              const isReceivable = person.netBalance > 0;
              const isPayable = person.netBalance < 0;

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
                      {person.lastTxnDate ? (
                        <View className="flex-row items-center mt-1">
                          <Text className="text-gray-400 text-[10px] font-bold">
                            📅 {new Date(person.lastTxnDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </Text>
                        </View>
                      ) : null}
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
                      {Math.abs(person.netBalance).toLocaleString('en-IN')}
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
                        {isReceivable ? 'RECEIVABLE' : isPayable ? 'PAYABLE' : 'SETTLED'}
                      </Text>
                    </View>

                    {/* Quick Remind Button */}
                    {person.netBalance !== 0 && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          openReminderModal(person);
                        }}
                        activeOpacity={0.8}
                        className="mt-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 flex-row items-center"
                      >
                        <Text className="text-[10px] mr-1">🔔</Text>
                        <Text className="text-blue-700 text-[9px] font-black">Remind</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: isTab ? 110 : 80 }} />
          </ScrollView>
        )}
      </View>

      {/* Prominent Bottom Action Bar with Plus (+) Icon */}
      <View style={{ bottom: bottomBarOffset }} className="absolute left-5 right-5 flex-row items-center justify-between">
        {/* + Lent Button */}
        <TouchableOpacity
          onPress={() => handleOpenAdd('GAVE')}
          activeOpacity={0.85}
          className="flex-1 mr-2 bg-emerald-600 py-3.5 px-3 rounded-2xl flex-row items-center justify-center shadow-lg shadow-emerald-600/30"
        >
          <Text className="text-white text-lg mr-1.5 font-black leading-5">+</Text>
          <Text className="text-white text-xs font-black tracking-wide">LENT (YOU GAVE)</Text>
        </TouchableOpacity>

        {/* - Borrowed Button */}
        <TouchableOpacity
          onPress={() => handleOpenAdd('GOT')}
          activeOpacity={0.85}
          className="flex-1 ml-2 bg-rose-600 py-3.5 px-3 rounded-2xl flex-row items-center justify-center shadow-lg shadow-rose-600/30"
        >
          <Text className="text-white text-lg mr-1.5 font-black leading-5">-</Text>
          <Text className="text-white text-xs font-black tracking-wide">BORROWED (YOU GOT)</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: ADD TRANSACTION */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/60"
        >
          <View className="bg-white rounded-t-[32px] p-6 max-h-[90%]">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-900 text-lg font-black">
                {entryType === 'GAVE' ? '🟢 Lent (Money You Gave)' : '🔴 Borrowed (Money You Took)'}
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
                  + Lent (Receivable)
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
                  - Borrowed (Payable)
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Person Name Input */}
              <Text className="text-gray-700 text-xs font-bold mb-1.5">Contact / Person Name *</Text>
              <TextInput
                placeholder="e.g. John Doe, Alex, Sarah"
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

              {/* Transaction Date */}
              <Text className="text-gray-700 text-xs font-bold mb-1.5">Transaction Date *</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
                className="bg-gray-100 rounded-2xl px-4 py-3 flex-row items-center justify-between mb-3 border border-gray-200"
              >
                <Text className="text-xs text-gray-900 font-bold">
                  {entryDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
                <Text className="text-sm">📅</Text>
              </TouchableOpacity>

              {/* Phone Number (Optional) */}
              <Text className="text-gray-700 text-xs font-bold mb-1.5">Phone Number (Optional)</Text>
              <TextInput
                placeholder="e.g. +91 98765 43210 (For WhatsApp reminders)"
                placeholderTextColor="#9ca3af"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-medium mb-3 border border-gray-200"
              />

              {/* Reason / Note */}
              <Text className="text-gray-700 text-xs font-bold mb-1.5">Description / Reason</Text>
              <TextInput
                placeholder="e.g. Dinner share, Fuel expense, Cash loan"
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
                    Save {entryType === 'GAVE' ? 'Lent Record' : 'Borrowed Record'}
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
                <Text className="text-white text-lg font-black">Account Ledger</Text>
                
                {/* Actions: Edit & Delete Person */}
                <View className="flex-row items-center space-x-2">
                  <TouchableOpacity
                    onPress={handleOpenEditPerson}
                    className="w-9 h-9 bg-white/20 rounded-full items-center justify-center mr-2"
                  >
                    <Text className="text-sm">✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDeletePerson}
                    className="w-9 h-9 bg-rose-500/80 rounded-full items-center justify-center"
                  >
                    <Text className="text-sm">🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Person Info Card */}
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
                      ? `₹${selectedPerson.netBalance.toLocaleString()} RECEIVABLE`
                      : selectedPerson.netBalance < 0
                      ? `₹${Math.abs(selectedPerson.netBalance).toLocaleString()} PAYABLE`
                      : 'SETTLED 🤝'}
                  </Text>
                </View>

                {/* Settle and Reminder Action Buttons */}
                <View className="flex-row items-center mt-3 gap-2 flex-wrap justify-center">
                  {selectedPerson.netBalance !== 0 && (
                    <TouchableOpacity
                      onPress={() => handleSettleAccount(selectedPerson)}
                      className="bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-full"
                    >
                      <Text className="text-blue-700 text-xs font-bold">🤝 Settle Account</Text>
                    </TouchableOpacity>
                  )}

                  {selectedPerson.netBalance !== 0 && (
                    <TouchableOpacity
                      onPress={() => openReminderModal(selectedPerson)}
                      className="bg-emerald-600 px-4 py-1.5 rounded-full flex-row items-center shadow-xs"
                    >
                      <Text className="mr-1 text-xs">🔔</Text>
                      <Text className="text-white text-xs font-black">Send Reminder Alert</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Statement Timeline */}
            <View className="flex-1 px-6 pt-4">
              <Text className="text-gray-900 text-sm font-black mb-3">Transaction History</Text>

              {selectedPersonTxns.length === 0 ? (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-gray-400 text-xs font-bold">No entries found for this contact.</Text>
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
                              {isGave ? 'Lent (Gave)' : isSettle ? 'Settled' : 'Borrowed (Got)'}
                            </Text>
                          </View>
                          <Text className="text-gray-500 text-[11px]" numberOfLines={2}>
                            {txn.note || 'No description'}
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
                          
                          {/* Edit & Delete Actions for Entry */}
                          <View className="flex-row items-center mt-1.5 space-x-1">
                            <TouchableOpacity
                              onPress={() => handleOpenEditTxn(txn)}
                              className="px-2 py-0.5 bg-gray-100 rounded mr-1"
                            >
                              <Text className="text-blue-600 text-[9px] font-bold">Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteTxn(txn.id)}
                              className="px-2 py-0.5 bg-gray-100 rounded"
                            >
                              <Text className="text-rose-500 text-[9px] font-bold">Delete</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                  <View className="h-28" />
                </ScrollView>
              )}
            </View>

            {/* Bottom Add Actions inside Person View */}
            <View className="absolute bottom-5 left-5 right-5 flex-row justify-between">
              <TouchableOpacity
                onPress={() => handleOpenAdd('GAVE', selectedPerson.name)}
                className="flex-1 mr-2 bg-emerald-600 py-3.5 rounded-2xl items-center justify-center shadow-lg shadow-emerald-600/30"
              >
                <Text className="text-white text-xs font-black">+ LENT (YOU GAVE)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleOpenAdd('GOT', selectedPerson.name)}
                className="flex-1 ml-2 bg-rose-600 py-3.5 rounded-2xl items-center justify-center shadow-lg shadow-rose-600/30"
              >
                <Text className="text-white text-xs font-black">- BORROWED (YOU GOT)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* MODAL 3: EDIT PERSON DETAILS */}
      <Modal visible={editPersonModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center items-center bg-black/60 px-6"
        >
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-900 text-base font-black">Edit Contact Details</Text>
              <TouchableOpacity onPress={() => setEditPersonModalVisible(false)}>
                <Text className="text-gray-400 text-base font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-gray-700 text-xs font-bold mb-1.5">Contact Name *</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-bold mb-3 border border-gray-200"
            />

            <Text className="text-gray-700 text-xs font-bold mb-1.5">Phone Number (Optional)</Text>
            <TextInput
              value={editPhone}
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-medium mb-5 border border-gray-200"
            />

            <TouchableOpacity
              onPress={handleSaveEditPerson}
              disabled={saving}
              className="bg-blue-600 py-3.5 rounded-2xl items-center justify-center"
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-xs font-black">Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL 4: EDIT TRANSACTION ENTRY */}
      <Modal visible={editTxnModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center items-center bg-black/60 px-6"
        >
          <View className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-gray-900 text-base font-black">Edit Entry</Text>
              <TouchableOpacity onPress={() => setEditTxnModalVisible(false)}>
                <Text className="text-gray-400 text-base font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Type Selector */}
            <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-4">
              <TouchableOpacity
                onPress={() => setEditTxnType('GAVE')}
                className={`flex-1 py-2 rounded-xl items-center ${
                  editTxnType === 'GAVE' ? 'bg-emerald-600 shadow-xs' : ''
                }`}
              >
                <Text className={`text-xs font-black ${editTxnType === 'GAVE' ? 'text-white' : 'text-gray-600'}`}>
                  + Lent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditTxnType('GOT')}
                className={`flex-1 py-2 rounded-xl items-center ${
                  editTxnType === 'GOT' ? 'bg-rose-600 shadow-xs' : ''
                }`}
              >
                <Text className={`text-xs font-black ${editTxnType === 'GOT' ? 'text-white' : 'text-gray-600'}`}>
                  - Borrowed
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-gray-700 text-xs font-bold mb-1.5">Amount (₹) *</Text>
            <TextInput
              value={editTxnAmount}
              onChangeText={setEditTxnAmount}
              keyboardType="numeric"
              className="bg-gray-100 rounded-2xl px-4 py-3 text-lg text-gray-900 font-black mb-3 border border-gray-200"
            />

            {/* Transaction Date */}
            <Text className="text-gray-700 text-xs font-bold mb-1.5">Transaction Date *</Text>
            <TouchableOpacity
              onPress={() => setShowEditDatePicker(true)}
              activeOpacity={0.7}
              className="bg-gray-100 rounded-2xl px-4 py-3 flex-row items-center justify-between mb-3 border border-gray-200"
            >
              <Text className="text-xs text-gray-900 font-bold">
                {editTxnDate.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <Text className="text-sm">📅</Text>
            </TouchableOpacity>

            <Text className="text-gray-700 text-xs font-bold mb-1.5">Description / Reason</Text>
            <TextInput
              value={editTxnNote}
              onChangeText={setEditTxnNote}
              className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-medium mb-5 border border-gray-200"
            />

            <TouchableOpacity
              onPress={handleSaveEditTxn}
              disabled={saving}
              className="bg-blue-600 py-3.5 rounded-2xl items-center justify-center"
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-xs font-black">Update Entry</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date Picker Modal for Add Entry */}
      <DatePickerModal
        visible={showDatePicker}
        selectedDate={entryDate}
        onSelectDate={(date) => setEntryDate(date)}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Date Picker Modal for Edit Entry */}
      <DatePickerModal
        visible={showEditDatePicker}
        selectedDate={editTxnDate}
        onSelectDate={(date) => setEditTxnDate(date)}
        onClose={() => setShowEditDatePicker(false)}
      />

      {/* MODAL 5: SEND REMINDER ALERT */}
      <Modal visible={reminderModalVisible} transparent animationType="fade">
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 22 }}
          onPress={() => setReminderModalVisible(false)}
        >
          <Pressable 
            style={{ width: '100%', maxWidth: 350, backgroundColor: '#ffffff', borderRadius: 28, padding: 22, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header with Icon */}
            <View className="items-center mb-3">
              <View className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 items-center justify-center mb-2">
                <Text className="text-2xl">🔔</Text>
              </View>
              <Text className="text-gray-900 text-lg font-black tracking-tight text-center">
                Send Reminder Alert
              </Text>
              <Text className="text-gray-500 text-xs font-semibold text-center mt-0.5">
                Contact: <Text className="text-gray-900 font-bold">{personToRemind?.name}</Text>
              </Text>

              {personToRemind && (
                <View className={`mt-2 px-3 py-1 rounded-full ${personToRemind.netBalance > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                  <Text className={`text-xs font-black ${personToRemind.netBalance > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {personToRemind.netBalance > 0 ? 'Pending to Receive: +' : 'Pending to Pay: -'}₹{Math.abs(personToRemind.netBalance).toLocaleString('en-IN')}
                  </Text>
                </View>
              )}
            </View>

            {/* Reminder Message Preview Box */}
            <View className="bg-gray-50 p-3 rounded-2xl border border-gray-200 mb-4">
              <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Preview Message</Text>
              <Text className="text-gray-700 text-xs leading-relaxed font-medium">
                {personToRemind ? getReminderMessage(personToRemind) : ''}
              </Text>
            </View>

            {/* Options List */}
            <View className="gap-2.5 mb-2">
              {/* WhatsApp Button */}
              <TouchableOpacity
                onPress={() => {
                  setReminderModalVisible(false);
                  if (personToRemind) handleSendWhatsApp(personToRemind);
                }}
                activeOpacity={0.85}
                className="bg-emerald-600 py-3 px-4 rounded-2xl flex-row items-center justify-center shadow-xs"
              >
                <Text className="text-white text-base mr-2">💬</Text>
                <Text className="text-white text-xs font-black tracking-wide">Send via WhatsApp</Text>
              </TouchableOpacity>

              {/* SMS Button */}
              <TouchableOpacity
                onPress={() => {
                  setReminderModalVisible(false);
                  if (personToRemind) handleSendSMS(personToRemind);
                }}
                activeOpacity={0.85}
                className="bg-blue-600 py-3 px-4 rounded-2xl flex-row items-center justify-center shadow-xs"
              >
                <Text className="text-white text-base mr-2">📱</Text>
                <Text className="text-white text-xs font-black tracking-wide">Send via SMS</Text>
              </TouchableOpacity>

              {/* Native Share Button */}
              <TouchableOpacity
                onPress={() => {
                  setReminderModalVisible(false);
                  if (personToRemind) handleShareReminder(personToRemind);
                }}
                activeOpacity={0.85}
                className="bg-indigo-600 py-3 px-4 rounded-2xl flex-row items-center justify-center shadow-xs"
              >
                <Text className="text-white text-base mr-2">📤</Text>
                <Text className="text-white text-xs font-black tracking-wide">Share via Any App</Text>
              </TouchableOpacity>

              {/* In-App Reminder Alert */}
              <TouchableOpacity
                onPress={() => {
                  if (personToRemind) handleSetInAppReminder(personToRemind);
                }}
                activeOpacity={0.85}
                className="bg-amber-500 py-3 px-4 rounded-2xl flex-row items-center justify-center shadow-xs"
              >
                <Text className="text-white text-base mr-2">🔔</Text>
                <Text className="text-white text-xs font-black tracking-wide">Set In-App Reminder Alert</Text>
              </TouchableOpacity>

              {/* Cancel Button */}
              <TouchableOpacity
                onPress={() => setReminderModalVisible(false)}
                className="py-2.5 rounded-2xl items-center justify-center border border-gray-200 bg-gray-100 mt-1"
              >
                <Text className="text-gray-700 text-xs font-bold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};
