import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📂',
  title,
  message,
  actionLabel,
  onAction,
}) => {
  return (
    <View className="py-12 px-6 items-center justify-center">
      <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
        <Text className="text-3xl">{icon}</Text>
      </View>
      <Text className="text-gray-800 text-lg font-bold text-center mb-1">{title}</Text>
      <Text className="text-gray-500 text-sm text-center max-w-xs mb-6 leading-5">
        {message}
      </Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          className="bg-primary-500 py-3 px-6 rounded-xl shadow-sm"
        >
          <Text className="text-white font-semibold text-sm">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};
