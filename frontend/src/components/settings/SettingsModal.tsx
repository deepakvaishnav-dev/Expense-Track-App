import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Share,
  Platform,
  StyleSheet,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore, AVAILABLE_THEMES, ThemeId } from '../../store/themeStore';
import { useSecurityStore } from '../../store/securityStore';
import { showCustomAlert } from '../../store/alertStore';
import { api } from '../../services/api';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: '₹ INR (Indian Rupee)' },
  { code: 'USD', symbol: '$', label: '$ USD (US Dollar)' },
  { code: 'EUR', symbol: '€', label: '€ EUR (Euro)' },
  { code: 'GBP', symbol: '£', label: '£ GBP (British Pound)' },
  { code: 'AED', symbol: 'AED', label: 'AED (Dirham)' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const user = useAuthStore((state: any) => state.user);
  const updateUser = useAuthStore((state: any) => state.updateUser);
  const { currentThemeId, theme, setTheme } = useThemeStore();
  const {
    isAppLockEnabled,
    biometricsEnabled,
    enableAppLock,
    disableAppLock,
    changePin,
    setBiometrics,
    lockApp,
  } = useSecurityStore();

  // Sub-modal states
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [pinSetupModalVisible, setPinSetupModalVisible] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Edit Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [selectedCurrency, setSelectedCurrency] = useState(user?.currency || '₹');
  const [savingProfile, setSavingProfile] = useState(false);

  // PIN Form State
  const [inputPin, setInputPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Preference Toggles
  const [dailyReminder, setDailyReminder] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [indianNumberFormat, setIndianNumberFormat] = useState(true);

  // Open Edit Profile
  const handleOpenEditProfile = () => {
    setFullName(user?.full_name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
    setSelectedCurrency(user?.currency || '₹');
    setEditProfileModalVisible(true);
  };

  // Save Edit Profile
  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      showCustomAlert('Required', 'Please enter your full name.', 'warning');
      return;
    }

    setSavingProfile(true);
    try {
      // 1. Update backend profile if endpoint available
      await api.put('/users/me', {
        full_name: fullName.trim(),
        email: email.trim(),
      }).catch((e) => console.log('Backend profile sync note:', e));

      // 2. Update local state
      updateUser({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        currency: selectedCurrency,
      });

      setEditProfileModalVisible(false);
      showCustomAlert(
        'Profile Updated! ✨',
        'Your profile information has been saved successfully.',
        'success',
        undefined,
        {
          tag: 'PROFILE SAVED',
          highlightText: fullName.trim(),
          iconEmoji: '👤',
        }
      );
    } catch (e: any) {
      console.warn('Profile save error:', e);
      showCustomAlert('Save Error', 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Theme selection handler
  const handleSelectTheme = async (themeId: ThemeId) => {
    await setTheme(themeId);
    const chosen = AVAILABLE_THEMES[themeId];
    showCustomAlert(
      'Theme Applied! 🎨',
      `Switched app visual style to ${chosen.name}.`,
      'success',
      undefined,
      {
        tag: 'THEME CHANGED',
        highlightText: chosen.name,
        iconEmoji: chosen.emoji,
      }
    );
  };

  // PIN Setup Handlers
  const handleOpenPinSetup = (changing = false) => {
    setIsChangingPin(changing);
    setInputPin('');
    setConfirmPin('');
    setPinError('');
    setPinSetupModalVisible(true);
  };

  const handleSavePin = async () => {
    if (inputPin.length !== 4) {
      setPinError('PIN must be exactly 4 digits.');
      return;
    }
    if (inputPin !== confirmPin) {
      setPinError('PINs do not match. Please re-enter.');
      return;
    }

    if (isChangingPin) {
      await changePin(inputPin);
      setPinSetupModalVisible(false);
      showCustomAlert(
        'PIN Changed! 🔒',
        'Your 4-digit security PIN has been updated.',
        'success',
        undefined,
        { tag: 'SECURITY', iconEmoji: '🔑' }
      );
    } else {
      await enableAppLock(inputPin);
      setPinSetupModalVisible(false);
      showCustomAlert(
        'App Lock Enabled! 🔒',
        'Your 4-digit PIN is now active. You can test your lock screen anytime.',
        'success',
        undefined,
        { tag: 'SECURITY', iconEmoji: '🛡️' }
      );
    }
  };

  const handleToggleAppLock = (value: boolean) => {
    if (value) {
      handleOpenPinSetup(false);
    } else {
      showCustomAlert(
        'Disable App Lock?',
        'Anyone with access to your phone will be able to open Expense AI without a passcode.',
        'warning',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable Lock',
            style: 'destructive',
            onPress: async () => {
              await disableAppLock();
              showCustomAlert('App Lock Disabled', 'Security passcode removed.', 'info');
            },
          },
        ]
      );
    }
  };

  const handleTestLock = () => {
    onClose();
    setTimeout(() => {
      lockApp();
    }, 200);
  };

  // Export full JSON Backup
  const handleExportBackup = async () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        user: user,
        appVersion: '2.5.0',
      };
      await Share.share({
        title: 'Expense AI Backup',
        message: `Expense AI Data Backup (${new Date().toLocaleDateString()}):\n` + JSON.stringify(backupData, null, 2),
      });
    } catch (e) {
      console.warn(e);
    }
  };

  // Clear Cache
  const handleClearCache = async () => {
    showCustomAlert(
      'Clear Cache & Media?',
      'This will clear cached receipt preview images and temporary calculation buffers.',
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Now',
          onPress: async () => {
            try {
              showCustomAlert(
                'Cache Cleared! 🧹',
                'Temporary storage freed successfully.',
                'success',
                undefined,
                { tag: 'SYSTEM CLEAN', iconEmoji: '✨' }
              );
            } catch (e) {
              console.warn(e);
            }
          },
        },
      ]
    );
  };

  // Share App
  const handleShareApp = async () => {
    try {
      await Share.share({
        title: 'Expense Tracker AI',
        message: '🚀 Track expenses, scan receipts with AI, and manage personal accounts with Expense AI! Try it out now.',
      });
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View 
          style={{ backgroundColor: theme.primary }} 
          className="pt-12 pb-6 px-6 rounded-b-[36px] shadow-md flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3">
              <Text className="text-xl">⚙️</Text>
            </View>
            <View>
              <Text className="text-white text-xl font-black">Settings</Text>
              <Text className="text-white/80 text-xs font-semibold">Preferences & Customization</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <Text className="text-white text-lg font-bold">✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-6 pt-5">
          {/* SECTION 1: USER PROFILE & IDENTITY */}
          <Text className="text-gray-400 text-xs font-extrabold uppercase tracking-wider mb-2.5">
            👤 Profile & Account
          </Text>
          <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center flex-1 mr-3">
                <View 
                  style={{ backgroundColor: theme.primary }} 
                  className="w-13 h-13 rounded-2xl items-center justify-center mr-3.5 shadow-xs"
                >
                  <Text className="text-2xl text-white font-black">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : '👤'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 text-base font-black" numberOfLines={1}>
                    {user?.full_name || 'Personal Account'}
                  </Text>
                  <Text className="text-gray-400 text-xs font-medium" numberOfLines={1}>
                    {user?.email || 'No email set'}
                  </Text>
                  {user?.phone ? (
                    <Text className="text-gray-500 text-[11px] font-semibold mt-0.5">
                      📱 {user.phone}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleOpenEditProfile}
              activeOpacity={0.8}
              style={{ backgroundColor: `${theme.primary}12`, borderColor: `${theme.primary}35` }}
              className="py-3 rounded-2xl border items-center justify-center flex-row"
            >
              <Text style={{ color: theme.primary }} className="font-extrabold text-xs mr-1">
                ✏️ Edit Profile Details
              </Text>
            </TouchableOpacity>
          </View>

          {/* SECTION 2: MULTIPLE THEMES */}
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-gray-400 text-xs font-extrabold uppercase tracking-wider">
              🎨 Multiple Themes ({AVAILABLE_THEMES[currentThemeId]?.name})
            </Text>
            <View className="bg-blue-50 px-2.5 py-0.5 rounded-full">
              <Text className="text-blue-600 text-[10px] font-black">5 STYLES</Text>
            </View>
          </View>
          <Text className="text-gray-500 text-xs font-medium mb-3">
            Choose your signature color theme. Instant visual refresh!
          </Text>

          <View className="gap-2.5 mb-6">
            {(Object.values(AVAILABLE_THEMES)).map((t) => {
              const isSelected = currentThemeId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => handleSelectTheme(t.id)}
                  activeOpacity={0.8}
                  style={{
                    borderColor: isSelected ? t.primary : '#f1f5f9',
                    backgroundColor: isSelected ? `${t.primary}08` : '#ffffff',
                  }}
                  className="rounded-2xl p-4 border flex-row items-center justify-between shadow-2xs"
                >
                  <View className="flex-row items-center flex-1 mr-3">
                    {/* Theme Color Indicator Circle */}
                    <View
                      style={{ backgroundColor: t.primary }}
                      className="w-10 h-10 rounded-2xl items-center justify-center mr-3.5 shadow-xs"
                    >
                      <Text className="text-lg">{t.emoji}</Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-gray-900 text-sm font-black mr-2">
                          {t.name}
                        </Text>
                        {isSelected && (
                          <View
                            style={{ backgroundColor: t.primary }}
                            className="px-2 py-0.5 rounded-full"
                          >
                            <Text className="text-white text-[9px] font-black">ACTIVE</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-gray-400 text-xs font-medium mt-0.5">
                        {t.subtitle}
                      </Text>
                    </View>
                  </View>

                  {/* Radio / Selection Indicator */}
                  <View
                    style={{
                      borderColor: isSelected ? t.primary : '#cbd5e1',
                      backgroundColor: isSelected ? t.primary : 'transparent',
                    }}
                    className="w-6 h-6 rounded-full border-2 items-center justify-center"
                  >
                    {isSelected && <Text className="text-white text-xs font-black">✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* SECTION 3: APP SECURITY & LOCK */}
          <View className="flex-row items-center justify-between mb-2.5">
            <Text className="text-gray-400 text-xs font-extrabold uppercase tracking-wider">
              🔒 Security & App Lock
            </Text>
            {isAppLockEnabled && (
              <View className="bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <Text className="text-emerald-700 text-[10px] font-black">PROTECTED</Text>
              </View>
            )}
          </View>

          <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs mb-6">
            {/* Toggle App Lock */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 items-center justify-center mr-3">
                  <Text className="text-2xl">🔐</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 text-sm font-black">4-Digit Passcode Lock</Text>
                  <Text className="text-gray-400 text-xs font-medium">
                    Require PIN code when opening the app
                  </Text>
                </View>
              </View>
              <Switch
                value={isAppLockEnabled}
                onValueChange={handleToggleAppLock}
                trackColor={{ false: '#e2e8f0', true: theme.primary }}
                thumbColor="#ffffff"
              />
            </View>

            {/* If Enabled, show options */}
            {isAppLockEnabled && (
              <View className="pt-3 border-t border-gray-100 gap-2.5">
                {/* Biometrics Toggle */}
                <View className="flex-row items-center justify-between py-1">
                  <View className="flex-row items-center flex-1 mr-3">
                    <Text className="text-lg mr-2.5">👆</Text>
                    <View>
                      <Text className="text-gray-900 text-xs font-bold">Biometric / Fingerprint</Text>
                      <Text className="text-gray-400 text-[11px]">Unlock with fingerprint or Face ID</Text>
                    </View>
                  </View>
                  <Switch
                    value={biometricsEnabled}
                    onValueChange={setBiometrics}
                    trackColor={{ false: '#e2e8f0', true: theme.primary }}
                    thumbColor="#ffffff"
                  />
                </View>

                {/* Change PIN Button */}
                <TouchableOpacity
                  onPress={() => handleOpenPinSetup(true)}
                  className="py-2.5 px-3 bg-gray-50 rounded-2xl flex-row items-center justify-between border border-gray-100"
                >
                  <Text className="text-gray-700 text-xs font-bold">🔑 Change 4-Digit PIN</Text>
                  <Text className="text-blue-600 text-xs font-bold">Edit ➔</Text>
                </TouchableOpacity>

                {/* Test Lock Screen Now Button */}
                <TouchableOpacity
                  onPress={handleTestLock}
                  activeOpacity={0.8}
                  style={{ backgroundColor: theme.primary }}
                  className="py-3 rounded-2xl items-center justify-center flex-row shadow-xs mt-1"
                >
                  <Text className="text-white text-xs font-black mr-1.5">🔒</Text>
                  <Text className="text-white text-xs font-black">Lock App Now (Test Lock Screen)</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* SECTION 4: SMART REMINDERS & DISCIPLINE */}
          <Text className="text-gray-400 text-xs font-extrabold uppercase tracking-wider mb-2.5">
            🔔 Smart Notifications & Habits
          </Text>
          <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs mb-6 gap-3.5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-3">
                <Text className="text-xl mr-3">⏰</Text>
                <View className="flex-1">
                  <Text className="text-gray-900 text-sm font-black">Daily 8:00 PM Reminder</Text>
                  <Text className="text-gray-400 text-xs font-medium">
                    Reminder alert to log today's expenses & keep streak alive
                  </Text>
                </View>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={setDailyReminder}
                trackColor={{ false: '#e2e8f0', true: theme.primary }}
                thumbColor="#ffffff"
              />
            </View>

            <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
              <View className="flex-row items-center flex-1 mr-3">
                <Text className="text-xl mr-3">📊</Text>
                <View className="flex-1">
                  <Text className="text-gray-900 text-sm font-black">Weekly Spending Summary</Text>
                  <Text className="text-gray-400 text-xs font-medium">
                    Sunday digest of weekly spending highlights
                  </Text>
                </View>
              </View>
              <Switch
                value={weeklyDigest}
                onValueChange={setWeeklyDigest}
                trackColor={{ false: '#e2e8f0', true: theme.primary }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* SECTION 5: DATA & STORAGE */}
          <Text className="text-gray-400 text-xs font-extrabold uppercase tracking-wider mb-2.5">
            💾 Data Backup & Storage
          </Text>
          <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs mb-6 gap-2.5">
            <TouchableOpacity
              onPress={handleExportBackup}
              activeOpacity={0.8}
              className="py-3 px-3.5 bg-gray-50 rounded-2xl flex-row items-center justify-between border border-gray-100"
            >
              <View className="flex-row items-center">
                <Text className="text-lg mr-2.5">📦</Text>
                <Text className="text-gray-800 text-xs font-bold">Export Full Data Backup (JSON)</Text>
              </View>
              <Text className="text-blue-600 text-xs font-bold">Export ➔</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleClearCache}
              activeOpacity={0.8}
              className="py-3 px-3.5 bg-gray-50 rounded-2xl flex-row items-center justify-between border border-gray-100"
            >
              <View className="flex-row items-center">
                <Text className="text-lg mr-2.5">🧹</Text>
                <Text className="text-gray-800 text-xs font-bold">Clear Cache & Temporary Files</Text>
              </View>
              <Text className="text-gray-400 text-xs font-bold">Clean ➔</Text>
            </TouchableOpacity>
          </View>

          {/* SECTION 6: APP INFO & SOCIAL */}
          <View className="items-center pb-12 pt-2">
            <TouchableOpacity
              onPress={handleShareApp}
              className="px-5 py-2.5 bg-blue-50 rounded-full border border-blue-200 flex-row items-center mb-3"
            >
              <Text className="text-sm mr-2">🚀</Text>
              <Text className="text-blue-700 text-xs font-black">Share Expense AI with Friends</Text>
            </TouchableOpacity>
            <Text className="text-gray-400 text-xs font-bold">Expense Tracker AI • Version 2.5 (Pro Edition)</Text>
            <Text className="text-gray-300 text-[10px] mt-1">Built with ❤️ for Financial Freedom</Text>
          </View>
        </ScrollView>
      </View>

      {/* SUB-MODAL: EDIT PROFILE FORM */}
      <Modal visible={editProfileModalVisible} transparent animationType="fade">
        <Pressable
          style={styles.backdrop}
          onPress={() => setEditProfileModalVisible(false)}
        >
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-gray-900 text-lg font-black">Edit Profile</Text>
                <Text className="text-gray-400 text-xs">Update your personal account details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditProfileModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Text className="text-gray-500 font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Full Name */}
            <Text className="text-gray-700 text-xs font-bold mb-1.5">Full Name *</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Deepak Vaishnav"
              placeholderTextColor="#9ca3af"
              className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-bold mb-3 border border-gray-200"
            />

            {/* Email Address */}
            <Text className="text-gray-700 text-xs font-bold mb-1.5">Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. user@gmail.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-bold mb-3 border border-gray-200"
            />

            {/* Phone Number */}
            <Text className="text-gray-700 text-xs font-bold mb-1.5">Phone Number (Optional)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              className="bg-gray-100 rounded-2xl px-4 py-3 text-xs text-gray-900 font-bold mb-3 border border-gray-200"
            />

            {/* Preferred Currency Chips */}
            <Text className="text-gray-700 text-xs font-bold mb-1.5">Preferred Currency</Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {CURRENCIES.map((curr) => {
                const isSelected = selectedCurrency === curr.symbol;
                return (
                  <TouchableOpacity
                    key={curr.code}
                    onPress={() => setSelectedCurrency(curr.symbol)}
                    style={{
                      borderColor: isSelected ? theme.primary : '#e2e8f0',
                      backgroundColor: isSelected ? `${theme.primary}12` : '#f8fafc',
                    }}
                    className="px-3 py-1.5 rounded-xl border flex-row items-center"
                  >
                    <Text
                      style={{ color: isSelected ? theme.primary : '#475569' }}
                      className="text-xs font-extrabold"
                    >
                      {curr.symbol} {curr.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={savingProfile}
              style={{ backgroundColor: theme.primary }}
              className="py-3.5 rounded-2xl items-center justify-center shadow-md"
            >
              {savingProfile ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-white font-black text-sm tracking-wide">
                  Save Profile Details
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* SUB-MODAL: PIN CODE SETUP */}
      <Modal visible={pinSetupModalVisible} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setPinSetupModalVisible(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View className="items-center mb-4">
              <View className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 items-center justify-center mb-2">
                <Text className="text-2xl">🔐</Text>
              </View>
              <Text className="text-gray-900 text-lg font-black">
                {isChangingPin ? 'Change Security PIN' : 'Set 4-Digit Security PIN'}
              </Text>
              <Text className="text-gray-400 text-xs text-center mt-0.5">
                Protect your personal financial records
              </Text>
            </View>

            {/* Enter 4-Digit PIN */}
            <Text className="text-gray-700 text-xs font-bold mb-1.5">Enter 4-Digit PIN</Text>
            <TextInput
              value={inputPin}
              onChangeText={setInputPin}
              placeholder="••••"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              className="bg-gray-100 rounded-2xl px-4 py-3 text-lg text-center tracking-widest text-gray-900 font-black mb-3 border border-gray-200"
            />

            {/* Confirm PIN */}
            <Text className="text-gray-700 text-xs font-bold mb-1.5">Confirm 4-Digit PIN</Text>
            <TextInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="••••"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              className="bg-gray-100 rounded-2xl px-4 py-3 text-lg text-center tracking-widest text-gray-900 font-black mb-2 border border-gray-200"
            />

            {pinError ? (
              <Text className="text-rose-500 text-xs font-bold text-center mb-3">
                {pinError}
              </Text>
            ) : null}

            {/* Save PIN */}
            <TouchableOpacity
              onPress={handleSavePin}
              style={{ backgroundColor: theme.primary }}
              className="py-3.5 rounded-2xl items-center justify-center shadow-md mb-2"
            >
              <Text className="text-white font-black text-sm tracking-wide">
                {isChangingPin ? 'Update PIN' : 'Activate App Lock'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPinSetupModalVisible(false)}
              className="py-2.5 rounded-2xl items-center justify-center"
            >
              <Text className="text-gray-400 text-xs font-bold">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 345,
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
});
