import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { showCustomAlert } from '../store/alertStore';

interface RegisterScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
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
        'Registration Successful',
        'Your account has been created and default categories have been loaded.',
        'success',
        [{ text: 'Get Started', onPress: () => navigation.replace('Main') }]
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
    <View className="flex-1 bg-dark-bg justify-center p-8">
      {/* Title */}
      <View className="mb-10 items-center">
        <Text className="text-primary-500 text-5xl font-black mb-2">Sign Up</Text>
        <Text className="text-gray-400 text-base">Start tracking your expenses with AI</Text>
      </View>

      {/* Form Container */}
      <View className="space-y-4">
        {/* Full Name Field */}
        <View>
          <Text className="text-gray-300 font-semibold mb-2">Full Name</Text>
          <Controller
            control={control}
            name="fullName"
            rules={{ required: 'Full name is required' }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="John Doe"
                placeholderTextColor="#4b5563"
                className="bg-dark-card border border-dark-border text-dark-text py-4 px-4 rounded-xl text-base"
              />
            )}
          />
          {errors.fullName && (
            <Text className="text-accent-red text-sm mt-1">{errors.fullName.message}</Text>
          )}
        </View>

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
            rules={{
              required: 'Password is required',
              minLength: {
                value: 8,
                message: 'Password must be at least 8 characters long',
              },
            }}
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

        {/* Register Action Button */}
        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
          className="bg-primary-500 py-4 rounded-xl items-center shadow-lg mt-6 flex-row justify-center"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text className="text-white font-bold text-lg">Create Account</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Navigation Footer */}
      <View className="flex-row justify-center mt-10">
        <Text className="text-gray-400 text-base">Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text className="text-primary-400 font-bold text-base">Log In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
