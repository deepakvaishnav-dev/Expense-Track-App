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

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const loginStore = useAuthStore((state) => state.login);

  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      email: '',
      password: '',
    }
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', {
        email: data.email.trim(),
        password: data.password,
      });

      const { access_token, refresh_token } = response.data;

      // Fetch user profile info
      const userProfile = await api.get('/users/me', {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });

      // Save credentials in local store
      loginStore(userProfile.data, access_token, refresh_token);
      
      // Navigate to Dashboard
      navigation.replace('Main');
    } catch (error: any) {
      console.warn(error);
      const msg = error.response?.data?.detail || 'Invalid email or password. Please try again.';
      showCustomAlert('Login Failed', msg, 'error');
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
            <Text className="text-4xl">💎</Text>
          </View>
          <Text className="text-gray-900 text-3xl font-black tracking-tight">Expense AI</Text>
          <Text className="text-gray-500 text-sm mt-1 text-center font-medium">
            Smart budgeting, accounts & automated tracking
          </Text>
        </View>

        {/* Form Card */}
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-150 mb-6">
          <Text className="text-gray-900 text-xl font-black mb-5">Welcome Back</Text>

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
          <View className="mb-2">
            <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider mb-2">Password</Text>
            <Controller
              control={control}
              name="password"
              rules={{ required: 'Password is required' }}
              render={({ field: { onChange, value } }) => (
                <View className="flex-row items-center border border-gray-200 bg-gray-50/70 rounded-2xl px-4 py-3">
                  <Text className="text-gray-400 mr-2 text-base">🔒</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Enter your password"
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

          {/* Forgot Password Link */}
          <TouchableOpacity
            onPress={() => showCustomAlert('Password Recovery', 'Recovery link sent to your registered email.', 'info')}
            className="items-end py-2 mb-4"
          >
            <Text className="text-blue-600 font-bold text-xs">Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Action Button */}
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            activeOpacity={0.85}
            className="bg-blue-600 py-4 rounded-2xl items-center justify-center shadow-md shadow-blue-500/25 flex-row"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-black text-base tracking-wide">LOG IN</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Navigation Footer */}
        <View className="flex-row justify-center items-center py-2">
          <Text className="text-gray-500 text-sm font-medium">Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text className="text-blue-600 font-black text-sm">Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
