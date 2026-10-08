import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Svg, Circle } from 'react-native-svg';
import { showCustomAlert } from '../store/alertStore';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [activeInsight, setActiveInsight] = useState(0);
  const user = useAuthStore((state) => state.user);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const fetchDashboardData = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const response = await api.get('/analytics/summary');
      setData(response.data);
    } catch (e: any) {
      console.warn(e);
      showCustomAlert('Data Error', 'Failed to retrieve latest financial records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const {
    today_spending,
    weekly_spending,
    monthly_spending,
    remaining_budget,
    category_breakdown,
    recent_transactions,
    top_categories,
    ai_insights,
  } = data || {
    today_spending: 0.0,
    weekly_spending: 0.0,
    monthly_spending: 0.0,
    remaining_budget: 0.0,
    category_breakdown: [],
    recent_transactions: [],
    top_categories: [],
    ai_insights: [],
  };

  const nextInsight = () => {
    if (ai_insights.length > 0) {
      setActiveInsight((activeInsight + 1) % ai_insights.length);
    }
  };

  // SVG Donut Chart Calculation
  const renderDonutChart = () => {
    const R = 35;
    const CX = 50;
    const CY = 50;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * R; // ~219.91

    // Filter categories with spending
    const validCategories = category_breakdown.filter((cat: any) => cat.amount > 0);
    const totalAmount = validCategories.reduce((sum: number, cat: any) => sum + cat.amount, 0);

    if (totalAmount === 0) {
      return (
        <Svg height="100" width="100" viewBox="0 0 100 100">
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            fill="transparent"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
        </Svg>
      );
    }

    let currentOffset = 0;

    return (
      <Svg height="100" width="100" viewBox="0 0 100 100">
        {validCategories.map((cat: any, idx: number) => {
          const pct = cat.amount / totalAmount;
          const strokeDasharray = `${circumference * pct} ${circumference}`;
          const strokeDashoffset = -currentOffset;
          currentOffset += circumference * pct;

          return (
            <Circle
              key={idx}
              cx={CX}
              cy={CY}
              r={R}
              fill="transparent"
              stroke={cat.color || '#3b82f6'}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              rotation="-90"
              origin={`${CX}, ${CY}`}
            />
          );
        })}
      </Svg>
    );
  };

  // Helper to map category names to nice emoji icons
  const getCategoryEmoji = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('food') || n.includes('restaurant')) return '🍔';
    if (n.includes('grocery')) return '🛒';
    if (n.includes('shopping')) return '🛍️';
    if (n.includes('fuel') || n.includes('gas')) return '⛽';
    if (n.includes('travel') || n.includes('transport')) return '✈️';
    if (n.includes('medical') || n.includes('health')) return '🏥';
    if (n.includes('entertainment') || n.includes('game')) return '🎮';
    if (n.includes('salary')) return '💰';
    if (n.includes('investment')) return '📈';
    if (n.includes('rent') || n.includes('housing')) return '🏠';
    if (n.includes('bill') || n.includes('utility')) return '⚡';
    if (n.includes('emi') || n.includes('card')) return '💳';
    if (n.includes('subscription')) return '🎬';
    return '🏷️';
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      {/* Curved Blue Header container */}
      <View className="bg-blue-600 rounded-b-[40px] pt-12 pb-16 px-6 relative shadow-md">
        {/* Welcome and Notification */}
        <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3">
              <Text className="text-white font-bold text-lg">👤</Text>
            </View>
            <View>
              <Text className="text-blue-100 text-xs font-semibold">Welcome,</Text>
              <Text className="text-white text-lg font-black">{user?.full_name || 'Alex'}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            className="w-10 h-10 bg-white/10 rounded-full items-center justify-center"
          >
            <Text className="text-lg">🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Side-by-side Metric Cards */}
        <View className="flex-row justify-between mt-2">
          {/* Today's Spend */}
          <View className="w-[48%] bg-blue-500 rounded-3xl p-4 shadow-sm">
            <Text className="text-blue-100 text-[10px] font-bold tracking-wider mb-1">TODAY'S SPEND</Text>
            <Text className="text-white text-2xl font-black">₹{today_spending.toLocaleString()}</Text>
          </View>

          {/* Monthly Total */}
          <View className="w-[48%] bg-gray-900 rounded-3xl p-4 shadow-sm">
            <Text className="text-gray-400 text-[10px] font-bold tracking-wider mb-1">MONTHLY TOTAL</Text>
            <Text className="text-white text-2xl font-black">₹{monthly_spending.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Main Content Area */}
      <View className="px-6 -mt-6">
        
        {/* Spending By Category Card */}
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-gray-800 text-base font-black">Spending by Category</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
              <Text className="text-blue-500 text-xs font-bold">View List ➔</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between">
            {/* Donut Chart container */}
            <View className="w-[35%] items-center justify-center">
              {renderDonutChart()}
            </View>

            {/* Category bullets list */}
            <View className="w-[60%] pl-4">
              {category_breakdown.slice(0, 3).map((cat: any, idx: number) => (
                <View key={idx} className="flex-row items-center mb-2">
                  <View 
                    style={{ backgroundColor: cat.color || '#3b82f6' }}
                    className="w-3 h-3 rounded-full mr-2"
                  />
                  <Text className="text-gray-700 text-sm font-bold flex-1" numberOfLines={1}>{cat.name}</Text>
                  <Text className="text-gray-900 font-extrabold text-sm ml-2">₹{cat.amount.toLocaleString()}</Text>
                </View>
              ))}
              {category_breakdown.length === 0 && (
                <Text className="text-gray-400 text-sm italic">No recent expenses logged</Text>
              )}
            </View>
          </View>
        </View>

        {/* Budget Progress Card */}
        {top_categories.length > 0 && (
          <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
            <Text className="text-gray-800 text-base font-black mb-4">Budget Progress</Text>
            {top_categories.map((cat: any, idx: number) => {
              // Mock budget target per category or calculate pct
              // Set a pseudo budget limit: e.g. 5000 per top category
              const target = 5000.0;
              const pct = Math.min(100, (cat.amount / target) * 100);
              return (
                <View key={idx} className="mb-4">
                  <View className="flex-row justify-between mb-1.5">
                    <Text className="text-gray-700 font-bold text-sm">{cat.name}</Text>
                    <Text className="text-gray-500 text-xs font-extrabold">{pct.toFixed(0)}%</Text>
                  </View>
                  {/* Progress Line Bar */}
                  <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <View
                      style={{ width: `${pct}%`, backgroundColor: cat.color || '#3b82f6' }}
                      className="h-full rounded-full"
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recent Transactions List */}
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
          <Text className="text-gray-800 text-base font-black mb-4">Recent Transactions</Text>
          {recent_transactions.slice(0, 3).map((t: any, idx: number) => {
            const isExpense = t.type.toLowerCase() === 'expense';
            const emoji = getCategoryEmoji(t.merchant || '');
            let timeStr = 'Recent';
            if (t.date) {
              const d = new Date(t.date);
              timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            return (
              <View key={t.id || idx} className="flex-row items-center justify-between py-3 border-b border-gray-50 last:border-b-0">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
                    <Text className="text-lg">{emoji}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-800 font-bold text-sm" numberOfLines={1}>{t.merchant || 'Merchant'}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">{timeStr} • {t.payment_method || 'UPI'}</Text>
                  </View>
                </View>
                <Text className={`font-extrabold text-sm ${isExpense ? 'text-gray-900' : 'text-green-500'}`}>
                  {isExpense ? '-' : '+'}₹{parseFloat(t.amount).toLocaleString()}
                </Text>
              </View>
            );
          })}
          {recent_transactions.length === 0 && (
            <Text className="text-gray-400 text-sm italic text-center py-2">No transactions logged yet</Text>
          )}
        </View>

        {/* AI Insight Speech Bubble Card */}
        {ai_insights.length > 0 && (
          <TouchableOpacity
            onPress={nextInsight}
            className="bg-blue-50 border border-blue-100 p-5 rounded-3xl mb-8 flex-row items-start shadow-sm"
          >
            <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3 mt-0.5">
              <Text className="text-xs">✨</Text>
            </View>
            <View className="flex-1">
              <Text className="text-blue-900 text-xs font-black tracking-wider mb-1">AI INSIGHT</Text>
              <Text className="text-blue-800 text-sm font-semibold leading-5">
                "{ai_insights[activeInsight]}"
              </Text>
              <Text className="text-blue-400 text-[10px] mt-2 font-bold">Tap to see next insight</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};
