import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { showCustomAlert } from '../store/alertStore';
import { api } from '../services/api';
import { Svg, Path, Circle } from 'react-native-svg';

declare const window: any;
declare const document: any;

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);

  const [loadingStats, setLoadingStats] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv'>('pdf');
  
  // Streak and stats state
  const [streakCount, setStreakCount] = useState<number>(1);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [activeDaysThisWeek, setActiveDaysThisWeek] = useState<boolean[]>([false, false, false, false, false, false, false]);

  useFocusEffect(
    useCallback(() => {
      fetchUserActivityStats();
    }, [])
  );

  const fetchUserActivityStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/transactions/?limit=100');
      const txns: any[] = res.data || [];
      setTotalTransactions(txns.length);

      // Calculate streak from transaction dates
      if (txns.length > 0) {
        const uniqueDates = new Set<string>();
        txns.forEach((t) => {
          if (t.date) {
            const dateStr = new Date(t.date).toDateString();
            uniqueDates.add(dateStr);
          }
        });

        // Calculate consecutive streak
        let streak = 0;
        const checkDate = new Date();
        // If today has a transaction, start count; else check if yesterday had one
        const todayStr = checkDate.toDateString();
        const hasToday = uniqueDates.has(todayStr);

        if (hasToday) {
          streak = 1;
          checkDate.setDate(checkDate.getDate() - 1);
          while (uniqueDates.has(checkDate.toDateString())) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          }
        } else {
          // Check yesterday
          checkDate.setDate(checkDate.getDate() - 1);
          if (uniqueDates.has(checkDate.toDateString())) {
            streak = 1;
            checkDate.setDate(checkDate.getDate() - 1);
            while (uniqueDates.has(checkDate.toDateString())) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            }
          } else {
            streak = 1; // Default encouragement streak
          }
        }
        setStreakCount(Math.max(1, streak));

        // Calculate active days this current week (Sunday to Saturday)
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday

        const weekDays = [false, false, false, false, false, false, false];
        for (let i = 0; i < 7; i++) {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          if (uniqueDates.has(d.toDateString())) {
            weekDays[i] = true;
          }
        }
        setActiveDaysThisWeek(weekDays);
      } else {
        setStreakCount(1);
        setActiveDaysThisWeek([true, false, false, false, false, false, false]);
      }
    } catch (e) {
      console.warn('Could not fetch activity stats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDownloadStatement = async () => {
    setDownloading(true);
    try {
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      if (selectedPeriod === 'weekly') {
        startDate.setDate(now.getDate() - 7);
      } else if (selectedPeriod === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (selectedPeriod === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      // Request statement from backend
      const response = await api.post(
        '/reports/generate',
        {
          format: selectedFormat,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        },
        {
          responseType: 'blob',
        }
      );

      // Handle download in browser / web environment
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const BlobConstructor = window.Blob || (globalThis as any).Blob;
        const blob = new BlobConstructor([response.data], {
          type: selectedFormat === 'pdf' ? 'application/pdf' : 'text/csv',
        });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        const dateStr = now.toISOString().split('T')[0];
        link.download = `Expense_Statement_${selectedPeriod.toUpperCase()}_${dateStr}.${selectedFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      }

      showCustomAlert(
        'Statement Downloaded',
        `Your ${selectedPeriod} statement (${selectedFormat.toUpperCase()}) has been generated successfully!`,
        'success'
      );
    } catch (error: any) {
      console.warn(error);
      if (error.response?.status === 404) {
        showCustomAlert(
          'No Records Found',
          `No transactions recorded for the selected ${selectedPeriod} period. Save some expenses first to download your statement!`,
          'info'
        );
      } else {
        showCustomAlert(
          'Download Failed',
          'Could not generate statement report. Please make sure the local server is running and try again.',
          'error'
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  const confirmLogout = () => {
    showCustomAlert(
      'Log Out',
      'Are you sure you want to end your session?',
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const DAYS_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      {/* Header Profile Banner */}
      <View className="bg-blue-600 rounded-b-[40px] pt-12 pb-16 px-6 relative shadow-md">
        <View className="items-center">
          {/* Avatar with Glow Badge */}
          <View className="relative mb-3">
            <View className="w-24 h-24 bg-white/20 rounded-full border-4 border-white/40 items-center justify-center shadow-lg">
              <Text className="text-5xl">👤</Text>
            </View>
            <View className="absolute bottom-0 right-0 bg-emerald-500 w-6 h-6 rounded-full border-2 border-white items-center justify-center">
              <Text className="text-[10px] text-white font-black">✓</Text>
            </View>
          </View>

          {/* User Name & Email */}
          <Text className="text-white text-2xl font-black tracking-tight">
            {user?.full_name || 'Deepak'}
          </Text>
          <Text className="text-blue-100 text-sm font-semibold mt-0.5">
            {user?.email || 'user@example.com'}
          </Text>

          {/* Member Badge Chip */}
          <View className="mt-3 px-3 py-1 bg-white/15 rounded-full border border-white/20">
            <Text className="text-white text-xs font-bold tracking-wider uppercase">
              ⚡ Verified Account
            </Text>
          </View>
        </View>

        {/* Mini Stats Banner */}
        <View className="flex-row justify-between bg-white/10 rounded-2xl p-4 mt-6 border border-white/15">
          <View className="items-center flex-1">
            <Text className="text-blue-200 text-[10px] font-bold uppercase tracking-wider">Entries Logged</Text>
            <Text className="text-white text-xl font-black mt-0.5">
              {loadingStats ? '...' : totalTransactions}
            </Text>
          </View>
          <View className="w-[1px] bg-white/20" />
          <View className="items-center flex-1">
            <Text className="text-blue-200 text-[10px] font-bold uppercase tracking-wider">Logging Streak</Text>
            <Text className="text-amber-300 text-xl font-black mt-0.5">
              🔥 {streakCount} Days
            </Text>
          </View>
          <View className="w-[1px] bg-white/20" />
          <View className="items-center flex-1">
            <Text className="text-blue-200 text-[10px] font-bold uppercase tracking-wider">Account</Text>
            <Text className="text-emerald-300 text-xl font-black mt-0.5">Active</Text>
          </View>
        </View>
      </View>

      {/* Main Content Body */}
      <View className="px-6 -mt-6">

        {/* 1. Daily Streak Tracker Card */}
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center">
              <Text className="text-2xl mr-2">🔥</Text>
              <View>
                <Text className="text-gray-900 text-base font-black">Daily Tracking Streak</Text>
                <Text className="text-gray-400 text-xs font-medium">Build your daily financial discipline</Text>
              </View>
            </View>
            <View className="bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <Text className="text-amber-700 text-xs font-extrabold">{streakCount} Days Active</Text>
            </View>
          </View>

          {/* Weekly Flame Bubbles */}
          <View className="flex-row justify-between items-center bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100 mt-2">
            {DAYS_LABEL.map((day, idx) => {
              const active = activeDaysThisWeek[idx];
              return (
                <View key={idx} className="items-center">
                  <View
                    className={`w-9 h-9 rounded-full items-center justify-center mb-1 shadow-sm ${
                      active ? 'bg-amber-500' : 'bg-gray-200'
                    }`}
                  >
                    <Text className="text-xs">{active ? '🔥' : '⚪'}</Text>
                  </View>
                  <Text className={`text-[10px] font-bold ${active ? 'text-amber-700' : 'text-gray-400'}`}>
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text className="text-gray-400 text-xs text-center mt-3 font-semibold">
            ✨ Log daily expenses to maintain your flame streak and earn insights!
          </Text>
        </View>

        {/* 2. Download Statements (Weekly, Monthly, Yearly) */}
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          <View className="flex-row items-center mb-3">
            <Text className="text-2xl mr-2">📑</Text>
            <View>
              <Text className="text-gray-900 text-base font-black">Download Statements</Text>
              <Text className="text-gray-400 text-xs font-medium">Export financial records to PDF or Excel</Text>
            </View>
          </View>

          {/* Period Selector Tabs: Weekly / Monthly / Yearly */}
          <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2 mt-2">Statement Period</Text>
          <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-4">
            {(['weekly', 'monthly', 'yearly'] as const).map((period) => {
              const isSelected = selectedPeriod === period;
              const label = period.charAt(0).toUpperCase() + period.slice(1);
              return (
                <TouchableOpacity
                  key={period}
                  onPress={() => setSelectedPeriod(period)}
                  activeOpacity={0.8}
                  className={`flex-1 py-2.5 rounded-xl items-center ${
                    isSelected ? 'bg-white shadow-sm' : 'bg-transparent'
                  }`}
                >
                  <Text className={`text-xs font-extrabold ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Format Selector: PDF vs CSV */}
          <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Export Format</Text>
          <View className="flex-row gap-3 mb-5">
            <TouchableOpacity
              onPress={() => setSelectedFormat('pdf')}
              activeOpacity={0.8}
              className={`flex-1 py-3 px-4 rounded-2xl border flex-row items-center justify-center gap-2 ${
                selectedFormat === 'pdf'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <Text className="text-base">📄</Text>
              <Text className={`font-black text-xs ${selectedFormat === 'pdf' ? 'text-blue-600' : 'text-gray-700'}`}>
                PDF Document
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedFormat('csv')}
              activeOpacity={0.8}
              className={`flex-1 py-3 px-4 rounded-2xl border flex-row items-center justify-center gap-2 ${
                selectedFormat === 'csv'
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <Text className="text-base">📊</Text>
              <Text className={`font-black text-xs ${selectedFormat === 'csv' ? 'text-blue-600' : 'text-gray-700'}`}>
                CSV Spreadsheet
              </Text>
            </TouchableOpacity>
          </View>

          {/* Download Button */}
          <TouchableOpacity
            onPress={handleDownloadStatement}
            disabled={downloading}
            activeOpacity={0.8}
            className="bg-blue-600 py-4 rounded-2xl items-center justify-center shadow-md flex-row gap-2"
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text className="text-white text-base font-bold">📥</Text>
                <Text className="text-white font-black text-sm tracking-wide">
                  DOWNLOAD {selectedPeriod.toUpperCase()} STATEMENT
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Sleek Log Out Button */}
        <TouchableOpacity
          onPress={confirmLogout}
          activeOpacity={0.8}
          className="bg-red-500 py-4.5 rounded-3xl items-center justify-center shadow-md mb-12 flex-row gap-2 border border-red-600"
        >
          <Text className="text-white text-base">🚪</Text>
          <Text className="text-white font-black text-base tracking-wider">
            LOG OUT
          </Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
};
