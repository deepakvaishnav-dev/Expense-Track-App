import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'large';
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message,
  size = 'large',
  color = '#3b82f6',
}) => {
  return (
    <View className="flex-1 bg-white justify-center items-center p-6">
      <ActivityIndicator size={size} color={color} />
      {message ? (
        <Text className="text-gray-500 text-sm mt-3 font-medium">{message}</Text>
      ) : null}
    </View>
  );
};
