import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { showCustomAlert } from '../store/alertStore';

export const NotificationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 px-6" style={{ paddingTop: Math.max(insets.top, 16) }}>
      {/* Header */}
      <View className="flex-row justify-between items-center mb-6">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => navigation.pop()} 
            className="w-10 h-10 rounded-full bg-white items-center justify-center mr-3 border border-gray-200 shadow-2xs"
          >
            <Text className="text-gray-900 text-lg font-bold">←</Text>
          </TouchableOpacity>
          <Text className="text-gray-900 text-2xl font-black">Alerts & Notices</Text>
        </View>

        {notifications.some(n => !n.is_read) && (
          <TouchableOpacity 
            onPress={markAllAsRead}
            className="bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200"
          >
            <Text className="text-blue-600 font-bold text-xs">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 20, 40) }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-24">
            <View className="w-16 h-16 rounded-3xl bg-blue-50 items-center justify-center mb-3 border border-blue-100">
              <Text className="text-3xl">🔔</Text>
            </View>
            <Text className="text-gray-900 font-black text-lg text-center">All caught up!</Text>
            <Text className="text-gray-400 text-xs text-center mt-1 px-8 leading-5">
              We'll notify you here when budgets reach thresholds or new financial insights are available.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isBudget = item.type === 'BudgetAlert';
          return (
            <TouchableOpacity
              onPress={() => !item.is_read && markAsRead(item.id)}
              activeOpacity={0.8}
              className={`p-4 rounded-2xl border mb-3 flex-row items-start ${
                item.is_read 
                  ? 'bg-white border-gray-150' 
                  : 'bg-white border-blue-300 shadow-sm'
              }`}
            >
              {/* Icon */}
              <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3.5 ${
                isBudget ? 'bg-rose-50 border border-rose-200' : 'bg-blue-50 border border-blue-200'
              }`}>
                <Text className="text-lg">{isBudget ? '⚠️' : 'ℹ️'}</Text>
              </View>

              {/* Content */}
              <View className="flex-1">
                <View className="flex-row justify-between items-center mb-0.5">
                  <Text className={`font-black text-sm flex-1 mr-2 ${item.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                    {item.title}
                  </Text>
                  {!item.is_read && (
                    <View className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
                  )}
                </View>
                <Text className="text-gray-600 text-xs mt-1 leading-5 font-medium">{item.message}</Text>
                <Text className="text-gray-400 text-[10px] mt-2 font-semibold">
                  {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};
