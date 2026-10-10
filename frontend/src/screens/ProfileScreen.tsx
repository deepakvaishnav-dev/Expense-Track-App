import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { showCustomAlert } from '../store/alertStore';
import { useThemeStore } from '../store/themeStore';
import { useSecurityStore } from '../store/securityStore';
import { SettingsModal } from '../components/settings/SettingsModal';
import { api } from '../services/api';

declare const window: any;
declare const document: any;

const STORAGE_KEYS = {
  PROFILE_PHOTO: '@user_profile_photo_uri',
  AVATAR_PRESET: '@user_avatar_preset',
};

const AVATAR_CATEGORIES = {
  male: [
    { id: 'male_1', label: 'Male (Classic)', icon: '👨' },
    { id: 'male_beard', label: 'Male (Beard)', icon: '🧔' },
    { id: 'male_young', label: 'Male (Casual)', icon: '👦' },
    { id: 'male_biz', label: 'Male (Executive)', icon: '👨‍💼' },
    { id: 'male_dev', label: 'Male (Developer)', icon: '🧑‍💻' },
  ],
  female: [
    { id: 'female_1', label: 'Female (Classic)', icon: '👩' },
    { id: 'female_modern', label: 'Female (Modern)', icon: '👱‍♀️' },
    { id: 'female_young', label: 'Female (Casual)', icon: '👧' },
    { id: 'female_biz', label: 'Female (Executive)', icon: '👩‍💼' },
    { id: 'female_dev', label: 'Female (Developer)', icon: '👩‍💻' },
  ],
  fun: [
    { id: 'cool_guy', label: 'Cool / Sunglasses', icon: '🕶️' },
    { id: 'vip', label: 'VIP / Executive', icon: '👑' },
    { id: 'gentleman', label: 'Gentleman', icon: '🎩' },
    { id: 'star', label: 'Superstar', icon: '⭐' },
  ],
};

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const user = useAuthStore((state: any) => state.user);
  const logout = useAuthStore((state: any) => state.logout);

  const [loadingStats, setLoadingStats] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv'>('pdf');

  // Photo & Avatar State
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('👨');
  const [avatarCategoryTab, setAvatarCategoryTab] = useState<'male' | 'female' | 'fun'>('male');
  const [photoOptionsModalVisible, setPhotoOptionsModalVisible] = useState(false);
  const [avatarPickerModalVisible, setAvatarPickerModalVisible] = useState(false);

  const { theme } = useThemeStore();
  const isAppLockEnabled = useSecurityStore((state) => state.isAppLockEnabled);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Hidden web file input ref for web browser testing
  const fileInputRef = React.useRef<any>(null);

  // Streak and stats state
  const [streakCount, setStreakCount] = useState<number>(1);
  const [totalTransactions, setTotalTransactions] = useState<number>(0);
  const [activeDaysThisWeek, setActiveDaysThisWeek] = useState<boolean[]>([false, false, false, false, false, false, false]);

  useFocusEffect(
    useCallback(() => {
      fetchUserActivityStats();
      loadSavedPhotoAndAvatar();
    }, [])
  );

  const loadSavedPhotoAndAvatar = async () => {
    try {
      const [savedPhoto, savedAvatar] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE_PHOTO),
        AsyncStorage.getItem(STORAGE_KEYS.AVATAR_PRESET),
      ]);
      if (savedPhoto) {
        setProfilePhotoUri(savedPhoto);
      }
      if (savedAvatar) {
        setSelectedAvatar(savedAvatar);
      }
    } catch (e) {
      console.warn('Error loading profile photo:', e);
    }
  };

  const handlePickFromGallery = async () => {
    setPhotoOptionsModalVisible(false);
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert(
          'Permission Needed',
          'Gallery access is required to select a profile photo.',
          'warning'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setProfilePhotoUri(uri);
        await AsyncStorage.setItem(STORAGE_KEYS.PROFILE_PHOTO, uri);
        showCustomAlert('Photo Updated! 📸', 'Your profile picture has been updated.', 'success');
      }
    } catch (e) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to pick image from gallery.', 'error');
    }
  };

  const handleWebFileSelect = (event: any) => {
    const file = event.target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        const base64Uri = e.target?.result as string;
        if (base64Uri) {
          setProfilePhotoUri(base64Uri);
          await AsyncStorage.setItem(STORAGE_KEYS.PROFILE_PHOTO, base64Uri);
          showCustomAlert('Photo Updated! 📸', 'Your profile picture has been updated.', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTakePhoto = async () => {
    setPhotoOptionsModalVisible(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showCustomAlert(
          'Camera Access Required',
          'Camera access is required to take a profile picture.',
          'warning'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setProfilePhotoUri(uri);
        await AsyncStorage.setItem(STORAGE_KEYS.PROFILE_PHOTO, uri);
        showCustomAlert('Photo Updated! 📸', 'Your profile picture has been updated.', 'success');
      }
    } catch (e) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to take photo with camera.', 'error');
    }
  };

  const handleQuickSetGenderAvatar = async (icon: string, label: string) => {
    setPhotoOptionsModalVisible(false);
    try {
      setSelectedAvatar(icon);
      setProfilePhotoUri(null);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.AVATAR_PRESET, icon),
        AsyncStorage.removeItem(STORAGE_KEYS.PROFILE_PHOTO),
      ]);
      showCustomAlert('Avatar Set! 👤', `${label} avatar has been set.`, 'success');
    } catch (e) {
      console.warn(e);
    }
  };

  const handleSelectAvatarPreset = async (icon: string) => {
    try {
      setSelectedAvatar(icon);
      setProfilePhotoUri(null);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.AVATAR_PRESET, icon),
        AsyncStorage.removeItem(STORAGE_KEYS.PROFILE_PHOTO),
      ]);
      setAvatarPickerModalVisible(false);
      showCustomAlert('Avatar Updated! 🎭', 'Your profile avatar has been set.', 'success');
    } catch (e) {
      console.warn(e);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoOptionsModalVisible(false);
    try {
      setProfilePhotoUri(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.PROFILE_PHOTO);
      showCustomAlert('Photo Removed', 'Profile reset to standard avatar.', 'info');
    } catch (e) {
      console.warn(e);
    }
  };

  const fetchUserActivityStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/transactions/?limit=100');
      const txns: any[] = res.data || [];
      setTotalTransactions(txns.length);

      if (txns.length > 0) {
        const uniqueDates = new Set<string>();
        txns.forEach((t) => {
          if (t.date) {
            const dateStr = new Date(t.date).toDateString();
            uniqueDates.add(dateStr);
          }
        });

        let streak = 0;
        const checkDate = new Date();
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
          checkDate.setDate(checkDate.getDate() - 1);
          if (uniqueDates.has(checkDate.toDateString())) {
            streak = 1;
            checkDate.setDate(checkDate.getDate() - 1);
            while (uniqueDates.has(checkDate.toDateString())) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            }
          } else {
            streak = 1;
          }
        }
        setStreakCount(Math.max(1, streak));

        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());

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
          'Could not generate statement report. Please check the network and try again.',
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
    <ScrollView 
      className="flex-1 bg-gray-50" 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 110 }}
    >
      {/* Hidden file input for web browser */}
      {Platform.OS === 'web' && (
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFileSelect}
        />
      )}

      {/* Header Profile Banner */}
      <View 
        style={{ backgroundColor: theme.primary }} 
        className="rounded-b-[40px] pt-12 pb-16 px-6 relative shadow-md"
      >
        {/* Top Header Row with Theme Badge & Settings Icon */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center bg-white/20 px-3 py-1.5 rounded-full border border-white/25">
            <Text className="text-white text-xs font-bold">🎨 {theme.name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setSettingsModalVisible(true)}
            activeOpacity={0.8}
            className="w-10 h-10 rounded-full bg-white/20 border border-white/30 items-center justify-center shadow-sm"
          >
            <Text className="text-lg">⚙️</Text>
          </TouchableOpacity>
        </View>

        <View className="items-center">
          {/* Avatar with Camera Badge */}
          <View className="relative mb-3">
            <TouchableOpacity
              onPress={() => setPhotoOptionsModalVisible(true)}
              activeOpacity={0.85}
              className="w-24 h-24 rounded-full border-4 border-white/40 items-center justify-center shadow-lg bg-white/20 overflow-hidden"
            >
              {profilePhotoUri ? (
                <Image
                  source={{ uri: profilePhotoUri }}
                  className="w-full h-full rounded-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center bg-blue-500/40">
                  <Text className="text-5xl">{selectedAvatar}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Camera Edit Badge Button */}
            <TouchableOpacity
              onPress={() => setPhotoOptionsModalVisible(true)}
              activeOpacity={0.85}
              className="absolute bottom-0 right-0 bg-blue-500 w-8 h-8 rounded-full border-2 border-white items-center justify-center shadow-md"
            >
              <Text className="text-sm">📷</Text>
            </TouchableOpacity>
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

        {/* 2. Accounts Book Quick Access */}
        <TouchableOpacity
          onPress={() => navigation.navigate('KhataBook')}
          activeOpacity={0.85}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 flex-row items-center justify-between"
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 items-center justify-center mr-3.5">
              <Text className="text-2xl">📒</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center mb-0.5">
                <Text className="text-gray-900 text-sm font-black mr-2">Accounts Book</Text>
                <View className="w-2 h-2 rounded-full bg-emerald-500" />
              </View>
              <Text className="text-gray-500 text-xs font-medium">
                Person-to-person debt & ledger tracking
              </Text>
            </View>
          </View>
          <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
            <Text className="text-blue-600 font-bold text-sm">➔</Text>
          </View>
        </TouchableOpacity>

        {/* 3. Settings & Security Quick Access Hub */}
        <TouchableOpacity
          onPress={() => setSettingsModalVisible(true)}
          activeOpacity={0.85}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-6 flex-row items-center justify-between"
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View 
              style={{ backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}35` }} 
              className="w-12 h-12 rounded-2xl border items-center justify-center mr-3.5"
            >
              <Text className="text-2xl">⚙️</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center mb-0.5">
                <Text className="text-gray-900 text-sm font-black mr-2">Settings & Security</Text>
                {isAppLockEnabled ? (
                  <View className="bg-emerald-100 px-2 py-0.5 rounded-full flex-row items-center border border-emerald-200">
                    <Text className="text-emerald-700 text-[10px] font-black">🔒 SECURED</Text>
                  </View>
                ) : (
                  <View className="bg-amber-100 px-2 py-0.5 rounded-full flex-row items-center border border-amber-200">
                    <Text className="text-amber-700 text-[10px] font-black">⚠️ UNPROTECTED</Text>
                  </View>
                )}
              </View>
              <Text className="text-gray-500 text-xs font-medium">
                Edit profile, 5 Themes ({theme.name}), PIN Lock & Backup
              </Text>
            </View>
          </View>
          <View 
            style={{ backgroundColor: `${theme.primary}15` }} 
            className="w-8 h-8 rounded-full items-center justify-center"
          >
            <Text style={{ color: theme.primary }} className="font-bold text-sm">➔</Text>
          </View>
        </TouchableOpacity>

        {/* 4. Download Statements */}
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          <View className="flex-row items-center mb-3">
            <Text className="text-2xl mr-2">📑</Text>
            <View>
              <Text className="text-gray-900 text-base font-black">Download Statements</Text>
              <Text className="text-gray-400 text-xs font-medium">Export financial records to PDF or Excel</Text>
            </View>
          </View>

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

          <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Export Format</Text>
          <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-6">
            {(['pdf', 'csv'] as const).map((format) => {
              const isSelected = selectedFormat === format;
              const label = format === 'pdf' ? 'PDF Document' : 'Excel / CSV Sheet';
              return (
                <TouchableOpacity
                  key={format}
                  onPress={() => setSelectedFormat(format)}
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

          {/* Download Button */}
          <TouchableOpacity
            onPress={handleDownloadStatement}
            disabled={downloading}
            activeOpacity={0.8}
            style={{ backgroundColor: theme.primary }}
            className="py-4 rounded-2xl items-center justify-center shadow-md flex-row gap-2"
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

        {/* 4. Log Out Button */}
        <TouchableOpacity
          onPress={confirmLogout}
          activeOpacity={0.8}
          className="bg-red-500 py-4 rounded-3xl items-center justify-center shadow-md mb-8 flex-row gap-2 border border-red-600"
        >
          <Text className="text-white text-base">🚪</Text>
          <Text className="text-white font-black text-base tracking-wider">
            LOG OUT
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: PHOTO SOURCE SELECTION (Gallery / Camera / Male / Female / Custom) */}
      <Modal visible={photoOptionsModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-[32px] p-6">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-gray-900 text-lg font-black">Profile Picture & Avatar</Text>
                <Text className="text-gray-400 text-xs">Upload your photo or choose an avatar</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPhotoOptionsModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Text className="text-gray-500 text-sm font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Choose from Gallery */}
            <TouchableOpacity
              onPress={handlePickFromGallery}
              activeOpacity={0.8}
              className="flex-row items-center p-3.5 bg-blue-50/60 rounded-2xl mb-2.5 border border-blue-100"
            >
              <View className="w-11 h-11 rounded-xl bg-blue-100 items-center justify-center mr-3">
                <Text className="text-2xl">🖼️</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-sm font-black">Choose from Gallery</Text>
                <Text className="text-gray-500 text-[11px]">Select any photo from your phone</Text>
              </View>
              <Text className="text-blue-600 font-bold text-sm">➔</Text>
            </TouchableOpacity>

            {/* Take Photo with Camera */}
            <TouchableOpacity
              onPress={handleTakePhoto}
              activeOpacity={0.8}
              className="flex-row items-center p-3.5 bg-gray-50 rounded-2xl mb-2.5 border border-gray-100"
            >
              <View className="w-11 h-11 rounded-xl bg-gray-100 items-center justify-center mr-3">
                <Text className="text-2xl">📸</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-sm font-black">Take Photo with Camera</Text>
                <Text className="text-gray-400 text-[11px]">Capture a new profile picture</Text>
              </View>
              <Text className="text-gray-400 text-sm">➔</Text>
            </TouchableOpacity>

            {/* Quick Gender Avatar Selectors */}
            <View className="flex-row gap-2.5 mb-2.5">
              <TouchableOpacity
                onPress={() => handleQuickSetGenderAvatar('👨', 'Male')}
                activeOpacity={0.8}
                className="flex-1 flex-row items-center p-3 bg-sky-50 rounded-2xl border border-sky-100"
              >
                <Text className="text-2xl mr-2">👨</Text>
                <View className="flex-1">
                  <Text className="text-sky-900 text-xs font-black">Male Avatar</Text>
                  <Text className="text-sky-600 text-[10px]">Use Male preset</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleQuickSetGenderAvatar('👩', 'Female')}
                activeOpacity={0.8}
                className="flex-1 flex-row items-center p-3 bg-pink-50 rounded-2xl border border-pink-100"
              >
                <Text className="text-2xl mr-2">👩</Text>
                <View className="flex-1">
                  <Text className="text-pink-900 text-xs font-black">Female Avatar</Text>
                  <Text className="text-pink-600 text-[10px]">Use Female preset</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* More Avatars */}
            <TouchableOpacity
              onPress={() => {
                setPhotoOptionsModalVisible(false);
                setAvatarPickerModalVisible(true);
              }}
              activeOpacity={0.8}
              className="flex-row items-center p-3.5 bg-gray-50 rounded-2xl mb-2.5 border border-gray-100"
            >
              <View className="w-11 h-11 rounded-xl bg-purple-50 items-center justify-center mr-3">
                <Text className="text-2xl">🎭</Text>
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-sm font-black">More Avatar Presets</Text>
                <Text className="text-gray-400 text-[11px]">Browse all Male, Female & Special styles</Text>
              </View>
              <Text className="text-gray-400 text-sm">➔</Text>
            </TouchableOpacity>

            {/* Remove Custom Photo (if set) */}
            {profilePhotoUri && (
              <TouchableOpacity
                onPress={handleRemovePhoto}
                activeOpacity={0.8}
                className="flex-row items-center p-3 bg-rose-50 rounded-2xl mb-1 border border-rose-100"
              >
                <Text className="text-xl mr-3">🗑️</Text>
                <View className="flex-1">
                  <Text className="text-rose-700 text-xs font-black">Remove Custom Photo</Text>
                  <Text className="text-rose-400 text-[10px]">Revert back to avatar</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 2: FULL AVATAR CATEGORY PICKER */}
      <Modal visible={avatarPickerModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-[32px] p-6 max-h-[82%]">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-gray-900 text-lg font-black">Choose Your Avatar</Text>
                <Text className="text-gray-400 text-xs">Select your preferred profile representation</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAvatarPickerModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Text className="text-gray-500 text-sm font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Category Tabs: Male / Female / Fun */}
            <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-4">
              {(['male', 'female', 'fun'] as const).map((cat) => {
                const isSelected = avatarCategoryTab === cat;
                const labels: Record<string, string> = {
                  male: '👨 Male',
                  female: '👩 Female',
                  fun: '✨ Special',
                };
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setAvatarCategoryTab(cat)}
                    activeOpacity={0.8}
                    className={`flex-1 py-2.5 rounded-xl items-center ${
                      isSelected ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                  >
                    <Text className={`text-xs font-black ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                      {labels[cat]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Avatar List for Active Tab */}
            <View className="flex-row flex-wrap justify-between">
              {AVATAR_CATEGORIES[avatarCategoryTab].map((item) => {
                const isSelected = !profilePhotoUri && selectedAvatar === item.icon;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleSelectAvatarPreset(item.icon)}
                    activeOpacity={0.8}
                    className={`w-[48%] bg-gray-50 p-4 rounded-2xl mb-3 items-center border ${
                      isSelected ? 'border-blue-600 bg-blue-50/60' : 'border-gray-200'
                    }`}
                  >
                    <View className="w-16 h-16 rounded-full bg-white items-center justify-center shadow-sm mb-2 border border-gray-100">
                      <Text className="text-4xl">{item.icon}</Text>
                    </View>
                    <Text
                      className={`text-xs font-black text-center ${
                        isSelected ? 'text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Senior Fintech Settings Modal */}
      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
      />
    </ScrollView>
  );
};
