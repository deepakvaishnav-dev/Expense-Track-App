import React from 'react';
import { View, Text, Modal, TouchableOpacity, Platform, StyleSheet } from 'react-native';
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
          buttonColor: '#10b981',
          icon: (
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill="#10b981" fillOpacity="0.18" />
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
          buttonColor: '#ef4444',
          icon: (
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill="#ef4444" fillOpacity="0.18" />
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
          buttonColor: '#f59e0b',
          icon: (
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill="#f59e0b" fillOpacity="0.18" />
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
          buttonColor: '#3b82f6',
          icon: (
            <Svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill="#3b82f6" fillOpacity="0.18" />
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
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Circular Glowing Icon Badge */}
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: theme.bgColor, borderColor: theme.borderColor },
            ]}
          >
            {theme.icon}
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Action Buttons */}
          {buttons && buttons.length > 0 ? (
            <View
              style={
                buttons.length > 2
                  ? styles.buttonCol
                  : buttons.length === 2
                  ? styles.buttonRow
                  : styles.buttonSingle
              }
            >
              {buttons.map((btn, idx) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const btnBg = isDestructive
                  ? '#ef4444'
                  : isCancel
                  ? '#f3f4f6'
                  : theme.buttonColor;
                const txtColor = isCancel ? '#374151' : '#ffffff';

                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleButtonPress(btn.onPress)}
                    activeOpacity={0.85}
                    style={[
                      styles.button,
                      {
                        backgroundColor: btnBg,
                        flex: buttons.length === 2 ? 1 : undefined,
                        width: buttons.length === 2 ? undefined : '100%',
                        borderWidth: isCancel ? 1 : 0,
                        borderColor: '#e5e7eb',
                      },
                    ]}
                  >
                    <Text style={[styles.buttonText, { color: txtColor }]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={onCancel ? styles.buttonRow : styles.buttonSingle}>
              {onCancel && (
                <TouchableOpacity
                  onPress={() => handleButtonPress(onCancel)}
                  activeOpacity={0.85}
                  style={[
                    styles.button,
                    { flex: 1, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: '#374151' }]}>{cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleButtonPress(onConfirm)}
                activeOpacity={0.85}
                style={[
                  styles.button,
                  {
                    flex: onCancel ? 1 : undefined,
                    width: onCancel ? undefined : '100%',
                    backgroundColor: theme.buttonColor,
                  },
                ]}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconBadge: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  buttonSingle: {
    width: '100%',
  },
  buttonRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  buttonCol: {
    width: '100%',
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    height: 48,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
