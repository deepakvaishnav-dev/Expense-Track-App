import React from 'react';
import { View, Text } from 'react-native';

interface StatCardProps {
  title: string;
  amount: string;
  subtitle?: string;
  icon?: string;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'default';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  amount,
  subtitle,
  icon,
  variant = 'default',
}) => {
  const getBadgeColors = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-50 border-blue-100 text-blue-600';
      case 'success':
        return 'bg-green-50 border-green-100 text-green-600';
      case 'danger':
        return 'bg-red-50 border-red-100 text-red-600';
      case 'warning':
        return 'bg-amber-50 border-amber-100 text-amber-600';
      default:
        return 'bg-gray-50 border-gray-100 text-gray-700';
    }
  };

  return (
    <View className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex-1 m-1">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wider">{title}</Text>
        {icon ? <Text className="text-base">{icon}</Text> : null}
      </View>
      <Text className="text-gray-900 text-xl font-bold">{amount}</Text>
      {subtitle ? <Text className="text-gray-400 text-xs mt-1">{subtitle}</Text> : null}
    </View>
  );
};
