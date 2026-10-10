import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppNavigator } from './src/navigation/AppNavigator';
import { CustomAlertModal, AppLockModal } from './src/components/common';
import { api } from './src/services/api';

// Initialize React Query client
const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    // Non-blocking wake-up / health probe to eliminate cold start delay on boot
    api.get('/health').catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
          <AppNavigator />
          <CustomAlertModal />
          <AppLockModal />
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
