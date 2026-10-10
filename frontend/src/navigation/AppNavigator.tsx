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
import { KhataBookScreen } from '../screens/KhataBookScreen';
import { useAuthStore } from '../store/authStore';
import { showCustomAlert } from '../store/alertStore';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, HistoryIcon, KhataIcon, ProfileIcon, PlusIcon } from '../components/navigation/NavIcons';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigation for Logged-In Context
const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  // Ensure enough bottom clearance on both physical Android gesture bars and 3-button nav
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 10 : 8);
  const barHeight = Platform.OS === 'ios' ? 60 + bottomInset : 66 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          paddingBottom: bottomInset,
          paddingTop: 8,
          height: barHeight,
          elevation: 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 10,
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 11,
          marginTop: 4,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 2,
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={DashboardScreen} 
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => <HomeIcon color={color} focused={focused} />,
        }}
      />
      <Tab.Screen 
        name="Transactions" 
        component={TransactionsListScreen} 
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, focused }) => <HistoryIcon color={color} focused={focused} />,
        }}
      />
      <Tab.Screen 
        name="AddTxnPlaceholder" 
        component={View}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            showCustomAlert(
              'Add Transaction or Khata',
              'Choose what you want to record:',
              'info',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: '💸 Expense / Income', onPress: () => navigation.navigate('AddTransaction') },
                { text: '🧾 Scan Receipt with AI', onPress: () => navigation.navigate('ScanReceipt') },
                { text: '👥 Accounts Book (P2P Ledger)', onPress: () => navigation.navigate('KhataBook') },
              ]
            );
          },
        })}
        options={{
          tabBarLabel: '',
          tabBarButton: (props: any) => (
            <TouchableOpacity
              onPress={props.onPress}
              activeOpacity={0.85}
              style={{
                top: -18,
                justifyContent: 'center',
                alignItems: 'center',
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: '#2563eb',
                shadowColor: '#2563eb',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 6,
                marginHorizontal: 8,
              }}
            >
              <PlusIcon color="#ffffff" />
            </TouchableOpacity>
          ),
        }}
      />
      <Tab.Screen 
        name="KhataTab" 
        component={KhataBookScreen} 
        options={{
          tabBarLabel: 'Accounts',
          tabBarIcon: ({ color, focused }) => <KhataIcon color={color} focused={focused} />,
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={ProfileScreen} 
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => <ProfileIcon color={color} focused={focused} />,
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
          <Stack.Screen name="KhataBook" component={KhataBookScreen} />
          <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
          <Stack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
          <Stack.Screen name="AIChat" component={AIAssistantChatScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
