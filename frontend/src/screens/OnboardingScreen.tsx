import React, { useState } from 'react';
import { View, Text, TouchableOpacity, PermissionsAndroid, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NativeModules } from 'react-native';
import { showCustomAlert } from '../store/alertStore';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: 'Auto Expense Tracking',
      description: 'Zero effort tracking. We read transaction SMS alerts and payment notifications in the background to log your expenses automatically.',
      icon: '📱',
    },
    {
      title: 'AI Categorization',
      description: 'Intelligent and automated. Transactions are parsed and accurately classified into categories like Food, Shopping, Bills, or Fuel.',
      icon: '🧠',
    },
    {
      title: 'Smart Receipt Scanning',
      description: 'Snap a photo of your receipt. Our AI extracts merchants, items, tax, and totals in seconds and logs the transaction.',
      icon: '📸',
    },
    {
      title: 'Budgets & Financial Insights',
      description: 'Set category targets. Get notified at 50%, 75%, 90% and 100% of limits and receive tailored saving recommendations.',
      icon: '📊',
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      requestPermissionsAndNavigate();
    }
  };

  const requestPermissionsAndNavigate = async () => {
    if (Platform.OS === 'android') {
      try {
        // Request SMS Read and Camera permissions
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);

        const smsGranted = granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED;
        const cameraGranted = granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED;

        if (!smsGranted || !cameraGranted) {
          showCustomAlert(
            'Permissions Notice',
            'Some features like SMS auto-tracking and Receipt scanning require permissions. You can also enable them later in settings.',
            'info',
            [{ text: 'Continue', onPress: () => checkNotificationAccess() }]
          );
        } else {
          checkNotificationAccess();
        }
      } catch (err) {
        console.warn(err);
        navigation.navigate('Login');
      }
    } else {
      navigation.navigate('Login');
    }
  };

  const checkNotificationAccess = async () => {
    try {
      if (NativeModules.ExpenseAIBridge) {
        const isEnabled = await NativeModules.ExpenseAIBridge.isNotificationListenerServiceEnabled();
        if (!isEnabled) {
          showCustomAlert(
            'Notification Access',
            'To automatically detect payment alerts (GPay, Paytm, PhonePe), you can enable Expense Tracker AI in system settings.',
            'info',
            [
              { text: 'Later', onPress: () => navigation.navigate('Login'), style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  NativeModules.ExpenseAIBridge.openNotificationListenerSettings();
                  setTimeout(() => navigation.navigate('Login'), 1000);
                },
              },
            ]
          );
        } else {
          navigation.navigate('Login');
        }
      } else {
        navigation.navigate('Login');
      }
    } catch (e) {
      console.warn(e);
      navigation.navigate('Login');
    }
  };

  const slide = slides[currentSlide];

  return (
    <View 
      className="flex-1 bg-gray-50 justify-between px-8"
      style={{
        paddingTop: Math.max(insets.top + 16, 36),
        paddingBottom: Math.max(insets.bottom + 24, 36),
      }}
    >
      {/* Skip Button */}
      <View className="flex-row justify-end">
        <TouchableOpacity 
          onPress={() => navigation.navigate('Login')}
          className="bg-white/80 px-4 py-1.5 rounded-full border border-gray-200 shadow-2xs"
        >
          <Text className="text-gray-600 font-bold text-xs">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slide Content */}
      <View className="items-center px-4 my-auto">
        <View className="w-36 h-36 bg-blue-100/70 border-4 border-blue-200 rounded-full items-center justify-center mb-8 shadow-sm">
          <Text className="text-6xl">{slide.icon}</Text>
        </View>
        <Text className="text-gray-900 text-3xl font-black text-center mb-3 tracking-tight">
          {slide.title}
        </Text>
        <Text className="text-gray-500 text-base text-center leading-6 font-medium">
          {slide.description}
        </Text>
      </View>

      {/* Bottom controls */}
      <View>
        {/* Pagination Dots */}
        <View className="flex-row justify-center space-x-2 mb-8">
          {slides.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full mx-1 ${
                index === currentSlide ? 'w-7 bg-blue-600' : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.85}
          className="bg-blue-600 py-4 rounded-2xl items-center shadow-md shadow-blue-500/25"
        >
          <Text className="text-white font-black text-base tracking-wide">
            {currentSlide === slides.length - 1 ? 'Get Started & Grant Access' : 'Continue ➔'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

