import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import { showCustomAlert } from '../store/alertStore';

export const NotificationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.get('/notifications/');
      setNotifications(response.data);
    } catch (e: any) {
      console.warn(e);
      showCustomAlert('Load Error', 'Failed to retrieve notifications list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      // Update local state
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (e: any) {
      console.warn(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      showCustomAlert('Success', 'All notifications marked as read.', 'success');
    } catch (e: any) {
      console.warn(e);
      showCustomAlert('Error', 'Failed to update notifications.', 'error');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-dark-bg justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-dark-bg p-6">
      {/* Header */}
      <View className="flex-row justify-between items-center mt-6 mb-6">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.pop()} className="mr-4">
            <Text className="text-primary-400 text-2xl font-bold">←</Text>
          </TouchableOpacity>
          <Text className="text-dark-text text-2xl font-black">Alerts</Text>
        </View>

        {notifications.some(n => !n.is_read) && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text className="text-primary-400 font-bold text-sm">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-5xl mb-4">🔔</Text>
            <Text className="text-gray-400 font-bold text-base text-center">No alerts found</Text>
            <Text className="text-gray-500 text-sm text-center mt-1">We'll alert you when budgets are close or bills are due.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => !item.is_read && markAsRead(item.id)}
            className={`p-4 rounded-xl border mb-3 flex-row items-start ${
              item.is_read 
                ? 'bg-dark-card/50 border-dark-border' 
                : 'bg-dark-card border-primary-500/30 shadow-md'
            }`}
          >
            {/* Icon */}
            <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
              item.type === 'BudgetAlert' ? 'bg-accent-red/20' : 'bg-primary-500/20'
            }`}>
              <Text className="text-sm">{item.type === 'BudgetAlert' ? '⚠️' : 'ℹ️'}</Text>
            </View>

            {/* Content */}
            <View className="flex-1">
              <View className="flex-row justify-between items-center">
                <Text className={`font-bold text-sm ${item.is_read ? 'text-gray-400' : 'text-dark-text'}`}>
                  {item.title}
                </Text>
                {!item.is_read && (
                  <View className="w-2.5 h-2.5 bg-primary-500 rounded-full" />
                )}
              </View>
              <Text className="text-gray-400 text-xs mt-1 leading-5">{item.message}</Text>
              <Text className="text-gray-600 text-[10px] mt-2">
                {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};
