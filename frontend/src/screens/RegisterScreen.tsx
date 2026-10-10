import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { showCustomAlert } from '../store/alertStore';

interface RegisterScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const loginStore = useAuthStore((state) => state.login);

  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    }
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      // 1. Call Signup Endpoint
      await api.post('/auth/signup', {
        email: data.email.trim(),
        full_name: data.fullName.trim(),
        password: data.password,
      });

      // 2. Automatically log in after successful registration
      const loginResponse = await api.post('/auth/login', {
        email: data.email.trim(),
        password: data.password,
      });

      const { access_token, refresh_token } = loginResponse.data;

      // 3. Fetch user profile
      const userProfile = await api.get('/users/me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      // 4. Save and Navigate
      loginStore(userProfile.data, access_token, refresh_token);
      showCustomAlert(
        'Welcome to Expense AI! 🚀',
        'Your account has been created successfully. Ready to track your money smartly!',
        'success',
        [{ text: 'Get Started', onPress: () => navigation.replace('Main') }],
        {
          tag: 'ACCOUNT CREATED',
          highlightText: userProfile.data?.full_name || 'New Member',
          iconEmoji: '🎉',
        }
      );
    } catch (error: any) {
      console.warn(error);
      const msg = error.response?.data?.detail || 'Registration failed. Please try again.';
      showCustomAlert('Registration Failed', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-gray-50"
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 28,
          paddingTop: Math.max(insets.top + 20, 40),
          paddingBottom: Math.max(insets.bottom + 20, 30),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-blue-600 rounded-3xl items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
            <Text className="text-4xl">✨</Text>
          </View>
          <Text className="text-gray-900 text-3xl font-black tracking-tight">Create Account</Text>
          <Text className="text-gray-500 text-sm mt-1 text-center font-medium">
            Join thousands tracking their wealth with AI
          </Text>
        </View>

        {/* Form Card */}
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150 mb-6">
          <Text className="text-gray-900 text-xl font-black mb-5">Quick Registration</Text>

          {/* Full Name Field */}
          <View className="mb-4">
            <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider mb-2">Full Name</Text>
            <Controller
              control={control}
              name="fullName"
              rules={{ required: 'Full name is required' }}
              render={({ field: { onChange, value } }) => (
                <View className="flex-row items-center border border-gray-200 bg-gray-50/70 rounded-2xl px-4 py-3">
                  <Text className="text-gray-400 mr-2 text-base">👤</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Deepak Sharma"
                    placeholderTextColor="#94a3b8"
                    style={{ outlineStyle: 'none' } as any}
                    className="flex-1 text-gray-900 text-sm font-semibold p-0"
                  />
                </View>
              )}
            />
            {errors.fullName && (
              <Text className="text-rose-500 text-xs mt-1 font-semibold">{errors.fullName.message}</Text>
            )}
          </View>

          {/* Email Field */}
          <View className="mb-4">
            <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider mb-2">Email Address</Text>
            <Controller
              control={control}
              name="email"
              rules={{
                required: 'Email is required',
                pattern: {
                  value: /^\S+@\S+$/i,
                  message: 'Invalid email address',
                },
              }}
              render={({ field: { onChange, value } }) => (
                <View className="flex-row items-center border border-gray-200 bg-gray-50/70 rounded-2xl px-4 py-3">
                  <Text className="text-gray-400 mr-2 text-base">✉️</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="name@example.com"
                    placeholderTextColor="#94a3b8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{ outlineStyle: 'none' } as any}
                    className="flex-1 text-gray-900 text-sm font-semibold p-0"
                  />
                </View>
              )}
            />
            {errors.email && (
              <Text className="text-rose-500 text-xs mt-1 font-semibold">{errors.email.message}</Text>
            )}
          </View>

          {/* Password Field */}
          <View className="mb-6">
            <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider mb-2">Password</Text>
            <Controller
              control={control}
              name="password"
              rules={{
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters long',
                },
              }}
              render={({ field: { onChange, value } }) => (
                <View className="flex-row items-center border border-gray-200 bg-gray-50/70 rounded-2xl px-4 py-3">
                  <Text className="text-gray-400 mr-2 text-base">🔒</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Min 8 characters"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry
                    style={{ outlineStyle: 'none' } as any}
                    className="flex-1 text-gray-900 text-sm font-semibold p-0"
                  />
                </View>
              )}
            />
            {errors.password && (
              <Text className="text-rose-500 text-xs mt-1 font-semibold">{errors.password.message}</Text>
            )}
          </View>

          {/* Create Account Action Button */}
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            activeOpacity={0.85}
            className="bg-blue-600 py-4 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-black text-base tracking-wide">CREATE ACCOUNT</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Login Navigation Footer */}
        <View className="flex-row justify-center items-center py-2">
          <Text className="text-gray-500 text-sm font-medium">Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text className="text-blue-600 font-black text-sm">Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
