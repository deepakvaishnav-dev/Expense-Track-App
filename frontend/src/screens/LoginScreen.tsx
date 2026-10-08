import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { showCustomAlert } from '../store/alertStore';

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
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

      // Save credentials in local Zustard / MMKV store
      loginStore(userProfile.data, access_token, refresh_token);
      
      // Navigate to Dashboard
      navigation.replace('Main');
    } catch (error: any) {
      console.warn(error);
      const msg = error.response?.data?.detail || 'Something went wrong. Please try again.';
      showCustomAlert('Login Failed', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-dark-bg justify-center p-8">
      {/* Title */}
      <View className="mb-10 items-center">
        <Text className="text-primary-500 text-5xl font-black mb-2">Expense AI</Text>
        <Text className="text-gray-400 text-base">Your intelligent financial companion</Text>
      </View>

      {/* Form Container */}
      <View className="space-y-4">
        {/* Email Field */}
        <View>
          <Text className="text-gray-300 font-semibold mb-2">Email Address</Text>
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
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="email@example.com"
                placeholderTextColor="#4b5563"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-dark-card border border-dark-border text-dark-text py-4 px-4 rounded-xl text-base"
              />
            )}
          />
          {errors.email && (
            <Text className="text-accent-red text-sm mt-1">{errors.email.message}</Text>
          )}
        </View>

        {/* Password Field */}
        <View>
          <Text className="text-gray-300 font-semibold mb-2">Password</Text>
          <Controller
            control={control}
            name="password"
            rules={{ required: 'Password is required' }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="********"
                placeholderTextColor="#4b5563"
                secureTextEntry
                className="bg-dark-card border border-dark-border text-dark-text py-4 px-4 rounded-xl text-base"
              />
            )}
          />
          {errors.password && (
            <Text className="text-accent-red text-sm mt-1">{errors.password.message}</Text>
          )}
        </View>

        {/* Forgot Password Trigger */}
        <TouchableOpacity
          onPress={() => showCustomAlert('Reset Password', 'An email has been sent with recovery instructions if that account exists.', 'info')}
          className="items-end py-2"
        >
          <Text className="text-primary-400 font-semibold text-sm">Forgot Password?</Text>
        </TouchableOpacity>

        {/* Login Action Button */}
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
          className="bg-primary-500 py-4 rounded-xl items-center shadow-lg mt-4 flex-row justify-center"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text className="text-white font-bold text-lg">Log In</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Navigation Footer */}
      <View className="flex-row justify-center mt-10">
        <Text className="text-gray-400 text-base">Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text className="text-primary-400 font-bold text-base">Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
