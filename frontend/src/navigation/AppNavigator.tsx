import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AddTransactionScreen } from '../screens/AddTransactionScreen';
import { ScanReceiptScreen } from '../screens/ScanReceiptScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { TransactionsListScreen } from '../screens/TransactionsListScreen';
import { AIAssistantChatScreen } from '../screens/AIAssistantChatScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useAuthStore } from '../store/authStore';
import { showCustomAlert } from '../store/alertStore';
import { View, Text, TouchableOpacity, Platform } from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigation for Logged-In Context
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f3f4f6',
          paddingBottom: 8,
          paddingTop: 8,
          height: 65,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={DashboardScreen} 
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontSize: 22 }}>🏠</Text>,
        }}
      />
      <Tab.Screen 
        name="Transactions" 
        component={TransactionsListScreen} 
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontSize: 22 }}>📅</Text>,
        }}
      />
      <Tab.Screen 
        name="AddTxnPlaceholder" 
        component={View}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            showCustomAlert(
              'Add Transaction',
              'Choose how you want to log your transaction:',
              'info',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Manual Entry', onPress: () => navigation.navigate('AddTransaction') },
                { text: 'Scan Receipt', onPress: () => navigation.navigate('ScanReceipt') },
              ]
            );
          },
        })}
        options={{
          tabBarLabel: '',
          tabBarButton: (props: any) => (
            <TouchableOpacity
              onPress={props.onPress}
              style={{
                top: -12,
                justifyContent: 'center',
                alignItems: 'center',
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: '#3b82f6',
                shadowColor: '#3b82f6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 5,
                elevation: 4,
                marginHorizontal: 12,
              }}
            >
              <Text style={{ color: 'white', fontSize: 30, fontWeight: '900', marginTop: -3 }}>+</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tab.Screen 
        name="AIChat" 
        component={AIAssistantChatScreen} 
        options={{
          tabBarLabel: 'AI Chat',
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontSize: 22 }}>💬</Text>,
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={ProfileScreen} 
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontSize: 22 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
};


export const AppNavigator = () => {
  const isAuthenticated = useAuthStore((state: any) => state.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
          <Stack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
