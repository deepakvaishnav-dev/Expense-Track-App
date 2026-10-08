import React from 'react';
import { View, Text, Modal, TouchableOpacity, Animated, Platform } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';
import { useAlertStore } from '../../store/alertStore';

export const CustomAlertModal: React.FC = () => {
  const { visible, options, hideAlert } = useAlertStore();

  if (!visible || !options) return null;

  const {
    title,
    message,
    type = 'info',
    buttons,
    onConfirm,
    onCancel,
    confirmText = 'Got It',
    cancelText = 'Cancel',
  } = options;

  const handleButtonPress = (btnPress?: () => void) => {
    hideAlert();
    if (btnPress) {
      setTimeout(() => btnPress(), 100);
    }
  };

  // Icon and theme config based on alert type
  const getThemeConfig = () => {
    switch (type) {
      case 'success':
        return {
          bgColor: '#ecfdf5',
          borderColor: '#a7f3d0',
          iconColor: '#10b981',
          btnBg: 'bg-emerald-600',
          btnText: 'text-white',
          icon: (
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill="#10b981" fillOpacity="0.15" />
              <Path
                d="M8 12.5l2.5 2.5 5.5-5.5"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
        };
      case 'error':
        return {
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          iconColor: '#ef4444',
          btnBg: 'bg-red-500',
          btnText: 'text-white',
          icon: (
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill="#ef4444" fillOpacity="0.15" />
              <Path
                d="M15 9l-6 6m0-6l6 6"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
        };
      case 'warning':
        return {
          bgColor: '#fffbeb',
          borderColor: '#fde68a',
          iconColor: '#f59e0b',
          btnBg: 'bg-amber-500',
          btnText: 'text-white',
          icon: (
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill="#f59e0b" fillOpacity="0.15" />
              <Path
                d="M12 8v4m0 4h.01"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
        };
      case 'info':
      default:
        return {
          bgColor: '#eff6ff',
          borderColor: '#bfdbfe',
          iconColor: '#3b82f6',
          btnBg: 'bg-blue-600',
          btnText: 'text-white',
          icon: (
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill="#3b82f6" fillOpacity="0.15" />
              <Path
                d="M12 16v-4m0-4h.01"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
        };
    }
  };

  const theme = getThemeConfig();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={hideAlert}
      statusBarTranslucent
    >
      <View className="flex-1 justify-center items-center px-6 bg-black/60">
        <View className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 items-center">
          {/* Circular Glowing Icon Badge */}
          <View
            style={{ backgroundColor: theme.bgColor, borderColor: theme.borderColor }}
            className="w-18 h-18 p-3 rounded-full border items-center justify-center mb-4 shadow-sm"
          >
            {theme.icon}
          </View>

          {/* Title */}
          <Text className="text-gray-900 text-xl font-black text-center mb-2 tracking-tight">
            {title}
          </Text>

          {/* Message */}
          <Text className="text-gray-500 text-sm text-center font-medium leading-5 mb-6 px-2">
            {message}
          </Text>

          {/* Action Buttons */}
          {buttons && buttons.length > 0 ? (
            <View className={`w-full ${buttons.length > 1 ? 'flex-row gap-3' : ''}`}>
              {buttons.map((btn, idx) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleButtonPress(btn.onPress)}
                    activeOpacity={0.8}
                    className={`flex-1 py-3.5 rounded-2xl items-center justify-center shadow-sm ${
                      isDestructive
                        ? 'bg-red-500'
                        : isCancel
                        ? 'bg-gray-100 border border-gray-200'
                        : theme.btnBg
                    }`}
                  >
                    <Text
                      className={`font-black text-sm ${
                        isCancel ? 'text-gray-700' : 'text-white'
                      }`}
                    >
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="w-full flex-row gap-3">
              {onCancel && (
                <TouchableOpacity
                  onPress={() => handleButtonPress(onCancel)}
                  activeOpacity={0.8}
                  className="flex-1 py-3.5 bg-gray-100 border border-gray-200 rounded-2xl items-center justify-center"
                >
                  <Text className="text-gray-700 font-bold text-sm">{cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleButtonPress(onConfirm)}
                activeOpacity={0.8}
                className={`flex-1 py-3.5 ${theme.btnBg} rounded-2xl items-center justify-center shadow-md`}
              >
                <Text className="text-white font-black text-sm">{confirmText}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
