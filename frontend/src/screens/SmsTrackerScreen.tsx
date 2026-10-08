import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { smsTrackerService, ProcessedSmsRecord } from '../services/smsTrackerService';
import { showCustomAlert } from '../store/alertStore';

export const SmsTrackerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [customSms, setCustomSms] = useState('');
  const [recentRecords, setRecentRecords] = useState<ProcessedSmsRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadStatusAndRecords();
    }, [])
  );

  const loadStatusAndRecords = async () => {
    try {
      const permitted = await smsTrackerService.checkPermissions();
      const enabled = await smsTrackerService.isAutoTrackingEnabled();
      const records = await smsTrackerService.getRecentRecords();

      setHasPermission(permitted);
      setAutoTrackingEnabled(enabled && permitted);
      setRecentRecords(records);
    } catch (e) {
      console.warn('Error loading SMS tracker status:', e);
    }
  };

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      await smsTrackerService.requestPermissions();
      // On Android, requestPermissions opens the Notification Access settings screen
      showCustomAlert(
        'Grant Notification Access',
        'Find "Expense Tracker AI" in the list and toggle it ON so incoming Bank SMS and UPI notifications can be auto-detected.',
        'info'
      );
      // Re-check status when user returns
      setTimeout(() => {
        loadStatusAndRecords();
      }, 1500);
    } catch (e) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to request notification permission.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoTracking = async () => {
    if (!hasPermission) {
      await handleRequestPermission();
      return;
    }

    const nextState = !autoTrackingEnabled;
    await smsTrackerService.setAutoTrackingEnabled(nextState);
    setAutoTrackingEnabled(nextState);

    showCustomAlert(
      nextState ? 'Auto-Tracking Active! 🚀' : 'Auto-Tracking Paused',
      nextState
        ? 'Incoming Bank SMS & UPI alerts will now be logged automatically in real time.'
        : 'Automatic background notification tracking is paused.',
      nextState ? 'success' : 'info'
    );
  };

  const handleProcessMessage = async (textToProcess: string, sampleLabel?: string) => {
    const text = textToProcess.trim();
    if (!text) {
      showCustomAlert('Empty Text', 'Please enter or paste a transaction SMS or alert text.', 'warning');
      return;
    }

    setSyncing(true);
    try {
      const record = await smsTrackerService.processSms(text, sampleLabel || 'UPI Alert');

      if (record) {
        showCustomAlert(
          'Transaction Logged! ⚡',
          `AI parsed your transaction:\n\n• Merchant: ${record.merchant}\n• Amount: ₹${record.amount.toLocaleString()}\n• Category: ${record.category}\n• Type: ${record.type}`,
          'success'
        );
        setCustomSms('');
        const updated = await smsTrackerService.getRecentRecords();
        setRecentRecords(updated);
      } else {
        showCustomAlert(
          'Non-Financial Message',
          'This message does not appear to contain a debit/credit transaction (or is an OTP).',
          'info'
        );
      }
    } catch (err: any) {
      console.warn(err);
      const detail = err?.response?.data?.detail || 'Failed to process transaction SMS.';
      showCustomAlert('Processing Error', detail, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearHistory = () => {
    showCustomAlert(
      'Clear Tracking History?',
      'This will clear the locally displayed list of recent auto-logged records.',
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await smsTrackerService.clearRecentRecords();
            setRecentRecords([]);
          },
        },
      ]
    );
  };

  const totalTrackedAmount = recentRecords.reduce((sum, r) => sum + (r.type === 'Expense' ? r.amount : 0), 0);
  const p2pCount = recentRecords.filter((r) => r.category.toLowerCase().includes('transfer')).length;
  const foodCount = recentRecords.filter((r) => r.category.toLowerCase().includes('food')).length;
  const groceryCount = recentRecords.filter((r) => r.category.toLowerCase().includes('grocery')).length;
  const sampleList = smsTrackerService.getSampleSmsList();

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      {/* Header Container */}
      <View className="bg-blue-600 rounded-b-[36px] pt-12 pb-8 px-6 shadow-md">
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity onPress={() => navigation.pop()} className="w-10 h-10 bg-white/20 rounded-full items-center justify-center">
            <Text className="text-white text-xl font-bold">←</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-black">Bank SMS & UPI Auto-Tracker</Text>
          <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center">
            <Text className="text-lg">🤖</Text>
          </View>
        </View>

        <Text className="text-blue-100 text-xs text-center font-medium px-4">
          Real-time background listener: Intercepts Bank debit SMS & UPI alerts to auto-categorize and save expenses instantly.
        </Text>
      </View>

      <View className="px-6 -mt-4">
        {/* Status & Permission Card */}
        <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <View className={`w-3.5 h-3.5 rounded-full mr-2.5 ${autoTrackingEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <Text className="text-gray-900 text-base font-extrabold">
                {autoTrackingEnabled ? 'Auto-Tracking Active' : hasPermission ? 'Permission Granted' : 'Access Required'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={hasPermission ? handleToggleAutoTracking : handleRequestPermission}
              disabled={loading}
              className={`px-3.5 py-1.5 rounded-full ${autoTrackingEnabled ? 'bg-emerald-50 border border-emerald-200' : 'bg-blue-600'}`}
            >
              <Text className={`text-xs font-bold ${autoTrackingEnabled ? 'text-emerald-700' : 'text-white'}`}>
                {autoTrackingEnabled ? 'Active' : hasPermission ? 'Turn On' : 'Grant Access'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="text-gray-500 text-xs leading-4 mb-4">
            {autoTrackingEnabled
              ? '✅ System is active! When your bank sends an SMS or UPI popup appears, AI registers it automatically.'
              : hasPermission
              ? 'Notification access is granted. Tap "Turn On" to activate live background expense logging.'
              : 'Tap "Grant Access" to enable Notification Listener in Android settings. 100% Play Protect safe!'}
          </Text>

          {/* Safe & Compliant Badge */}
          <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex-row items-center">
            <Text className="text-base mr-2.5">🛡️</Text>
            <Text className="text-[11px] text-emerald-800 font-semibold flex-1 leading-4">
              <Text className="font-bold text-emerald-950">Google Play Protect Compliant:</Text> Safe Android listener. Only extracts transaction debits/credits. Never reads OTPs or personal chats.
            </Text>
          </View>
        </View>

        {/* How It Works Visual Step Guide */}
        <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-5">
          <Text className="text-gray-900 text-sm font-black mb-3">How Auto-Tracking Works</Text>
          
          <View className="space-y-3">
            <View className="flex-row items-start">
              <View className="w-6 h-6 rounded-full bg-blue-100 items-center justify-center mr-3 mt-0.5">
                <Text className="text-blue-700 text-xs font-bold">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-xs font-bold">Bank Debit or UPI Alert Arrives</Text>
                <Text className="text-gray-500 text-[11px]">HDFC, SBI, ICICI SMS or PhonePe/GPay alert pops up on your phone.</Text>
              </View>
            </View>

            <View className="flex-row items-start mt-2">
              <View className="w-6 h-6 rounded-full bg-purple-100 items-center justify-center mr-3 mt-0.5">
                <Text className="text-purple-700 text-xs font-bold">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-xs font-bold">AI Extracts & Categorizes</Text>
                <Text className="text-gray-500 text-[11px]">Amount, merchant name, date, and category are parsed accurately.</Text>
              </View>
            </View>

            <View className="flex-row items-start mt-2">
              <View className="w-6 h-6 rounded-full bg-emerald-100 items-center justify-center mr-3 mt-0.5">
                <Text className="text-emerald-700 text-xs font-bold">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-xs font-bold">Auto-Logged to Your Expense Feed</Text>
                <Text className="text-gray-500 text-[11px]">Saved with zero manual typing or effort!</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Today's Auto-Tracked Routine Summary */}
        <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-5">
          <Text className="text-gray-900 text-sm font-black mb-3">Today's Auto-Detected Routine</Text>
          <View className="flex-row justify-between mb-3">
            <View className="w-[48%] bg-blue-50 border border-blue-100 rounded-2xl p-3.5">
              <Text className="text-blue-600 text-[10px] font-black tracking-wider">EXPENSES DETECTED</Text>
              <Text className="text-blue-900 text-xl font-black mt-1">₹{totalTrackedAmount.toLocaleString()}</Text>
            </View>
            <View className="w-[48%] bg-purple-50 border border-purple-100 rounded-2xl p-3.5">
              <Text className="text-purple-600 text-[10px] font-black tracking-wider">TRANSACTIONS LOGGED</Text>
              <Text className="text-purple-900 text-xl font-black mt-1">{recentRecords.length}</Text>
            </View>
          </View>

          <View className="flex-row justify-between pt-2 border-t border-gray-100">
            <View className="items-center flex-1">
              <Text className="text-base">👤</Text>
              <Text className="text-[10px] text-gray-500 font-bold mt-1">P2P: {p2pCount}</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-base">🍔</Text>
              <Text className="text-[10px] text-gray-500 font-bold mt-1">Food: {foodCount}</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-base">🛒</Text>
              <Text className="text-[10px] text-gray-500 font-bold mt-1">Store: {groceryCount}</Text>
            </View>
          </View>
        </View>

        {/* Test Bank SMS Samples (Interactive Testing Hub) */}
        <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-5">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-900 text-sm font-black">Test Indian UPI & Bank SMS</Text>
            <Text className="text-blue-600 text-[10px] font-bold">Tap to Simulate</Text>
          </View>
          <Text className="text-gray-400 text-[11px] mb-3">
            Tap any real-world Indian bank format to test instant AI auto-entry:
          </Text>

          <View className="gap-2">
            {sampleList.map((sample, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleProcessMessage(sample.text, sample.title)}
                disabled={syncing}
                className="flex-row items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200 active:bg-blue-50"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View className="w-8 h-8 rounded-full bg-white items-center justify-center mr-2.5 shadow-xs">
                    <Text className="text-sm">{sample.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-800 text-xs font-bold" numberOfLines={1}>{sample.title}</Text>
                    <Text className="text-gray-500 text-[10px] font-medium">{sample.subtitle}</Text>
                  </View>
                </View>
                <View className="px-2.5 py-1 bg-blue-100 rounded-lg">
                  <Text className="text-blue-700 text-[10px] font-black">Test ➔</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Paste Custom SMS Text Field */}
          <View className="mt-4 pt-4 border-t border-gray-100">
            <Text className="text-gray-700 text-xs font-bold mb-2">Or Paste Bank SMS from Phone:</Text>
            <View className="flex-row items-center bg-gray-100 px-3.5 py-2.5 rounded-2xl mb-2">
              <TextInput
                placeholder="Paste any bank transaction SMS..."
                placeholderTextColor="#9ca3af"
                value={customSms}
                onChangeText={setCustomSms}
                className="flex-1 text-gray-900 text-xs p-0"
              />
            </View>
            <TouchableOpacity
              onPress={() => handleProcessMessage(customSms, 'Custom SMS')}
              disabled={syncing || !customSms.trim()}
              className={`py-3 rounded-2xl items-center justify-center ${
                syncing || !customSms.trim() ? 'bg-gray-300' : 'bg-blue-600'
              }`}
            >
              {syncing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white text-xs font-black">Auto-Detect & Log Transaction</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Auto-Detected Transactions Stream */}
        <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-8">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-900 text-sm font-black">Recent Auto-Logged Transactions</Text>
            {recentRecords.length > 0 && (
              <TouchableOpacity onPress={handleClearHistory}>
                <Text className="text-red-500 text-xs font-bold">Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentRecords.length === 0 ? (
            <View className="py-6 items-center">
              <Text className="text-2xl mb-2">📬</Text>
              <Text className="text-gray-500 text-xs font-bold text-center">No transactions auto-detected yet</Text>
              <Text className="text-gray-400 text-[11px] text-center mt-1">
                Make a UPI payment or tap any test sample above to see instant AI entries here.
              </Text>
            </View>
          ) : (
            recentRecords.map((item, idx) => {
              const isExpense = item.type.toLowerCase() === 'expense';
              let timeStr = 'Recent';
              if (item.timestamp) {
                const d = new Date(item.timestamp);
                timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              }

              return (
                <View
                  key={item.id || idx}
                  className="py-3 border-b border-gray-100 last:border-b-0"
                >
                  <View className="flex-row items-center justify-between mb-1">
                    <View className="flex-row items-center flex-1 mr-2">
                      <Text className="text-gray-900 text-xs font-black mr-2" numberOfLines={1}>
                        {item.merchant}
                      </Text>
                      <View className="bg-blue-50 px-2 py-0.5 rounded-md">
                        <Text className="text-blue-700 text-[10px] font-bold">{item.category}</Text>
                      </View>
                    </View>
                    <Text className={`text-xs font-black ${isExpense ? 'text-gray-900' : 'text-emerald-600'}`}>
                      {isExpense ? '-' : '+'}₹{item.amount.toLocaleString()}
                    </Text>
                  </View>

                  {/* Raw Text Snippet */}
                  <Text className="text-[10px] text-gray-400 font-mono italic" numberOfLines={1}>
                    "{item.rawText}"
                  </Text>
                  <Text className="text-[9px] text-gray-400 mt-0.5">{timeStr} • Auto-logged</Text>
                </View>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
};
