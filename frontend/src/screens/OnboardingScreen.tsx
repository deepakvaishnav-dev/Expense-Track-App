import React, { useState } from 'react';
import { View, Text, TouchableOpacity, PermissionsAndroid, Platform, Dimensions } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NativeModules } from 'react-native';
import { showCustomAlert } from '../store/alertStore';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
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
    <View className="flex-1 bg-dark-bg justify-between p-8">
      {/* Skip Button */}
      <View className="flex-row justify-end mt-4">
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text className="text-gray-400 font-semibold text-base">Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slide Content */}
      <View className="items-center px-4 my-auto">
        <View className="w-32 h-32 bg-primary/20 rounded-full items-center justify-center mb-8">
          <Text className="text-6xl">{slide.icon}</Text>
        </View>
        <Text className="text-dark-text text-3xl font-bold text-center mb-4">
          {slide.title}
        </Text>
        <Text className="text-gray-400 text-lg text-center leading-6">
          {slide.description}
        </Text>
      </View>

      {/* Bottom controls */}
      <View className="mb-8">
        {/* Pagination Dots */}
        <View className="flex-row justify-center space-x-2 mb-8">
          {slides.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full ${
                index === currentSlide ? 'w-6 bg-primary-500' : 'w-2 bg-gray-600'
              }`}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          className="bg-primary-500 py-4 rounded-xl items-center shadow-lg"
        >
          <Text className="text-white font-bold text-lg">
            {currentSlide === slides.length - 1 ? 'Get Started & Grant Permissions' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
