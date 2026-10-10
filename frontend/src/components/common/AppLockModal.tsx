import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { useSecurityStore } from '../../store/securityStore';

export const AppLockModal: React.FC = () => {
  const { isLocked, biometricsEnabled, unlockApp, unlockWithBiometrics } = useSecurityStore();
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isLocked) {
      setPinInput('');
      setErrorMessage('');
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleKeyPress = (num: string) => {
    if (pinInput.length >= 4) return;
    const nextPin = pinInput + num;
    setPinInput(nextPin);
    setErrorMessage('');

    if (nextPin.length === 4) {
      setTimeout(() => {
        const success = unlockApp(nextPin);
        if (!success) {
          Vibration.vibrate(100);
          setErrorMessage('Incorrect PIN. Please try again.');
          setPinInput('');
        }
      }, 100);
    }
  };

  const handleDelete = () => {
    if (pinInput.length > 0) {
      setPinInput(pinInput.slice(0, -1));
      setErrorMessage('');
    }
  };

  const handleBiometricPress = () => {
    const success = unlockWithBiometrics();
    if (!success) {
      setErrorMessage('Biometric verification failed.');
    }
  };

  return (
    <Modal visible={isLocked} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoEmoji}>💎</Text>
          </View>
          <Text style={styles.title}>Expense AI</Text>
          <Text style={styles.subtitle}>Enter 4-digit PIN to access your account</Text>
        </View>

        {/* PIN Indicators */}
        <View style={styles.pinDotsRow}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pinInput.length > index;
            return (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  isFilled ? styles.pinDotFilled : styles.pinDotEmpty,
                ]}
              />
            );
          })}
        </View>

        {/* Error message */}
        <View style={styles.errorContainer}>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}
        </View>

        {/* Numeric Keypad */}
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            [biometricsEnabled ? 'BIO' : '', '0', 'DEL'],
          ].map((row, rowIdx) => (
            <View key={rowIdx} style={styles.keypadRow}>
              {row.map((item, colIdx) => {
                if (item === '') {
                  return <View key={colIdx} style={styles.keyEmpty} />;
                }

                if (item === 'BIO') {
                  return (
                    <TouchableOpacity
                      key={colIdx}
                      onPress={handleBiometricPress}
                      activeOpacity={0.7}
                      style={styles.keyBtnSecondary}
                    >
                      <Text style={styles.keyEmoji}>👆</Text>
                    </TouchableOpacity>
                  );
                }

                if (item === 'DEL') {
                  return (
                    <TouchableOpacity
                      key={colIdx}
                      onPress={handleDelete}
                      activeOpacity={0.7}
                      style={styles.keyBtnSecondary}
                    >
                      <Text style={styles.keyEmoji}>⌫</Text>
                    </TouchableOpacity>
                  );
                }

                return (
                  <TouchableOpacity
                    key={colIdx}
                    onPress={() => handleKeyPress(item)}
                    activeOpacity={0.65}
                    style={styles.keyBtn}
                  >
                    <Text style={styles.keyText}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
    textAlign: 'center',
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 14,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  pinDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#334155',
  },
  pinDotFilled: {
    backgroundColor: '#38bdf8',
    borderWidth: 0,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  errorContainer: {
    height: 24,
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12.5,
    fontWeight: '700',
  },
  keypad: {
    width: '100%',
    maxWidth: 280,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  keyEmpty: {
    width: 68,
    height: 68,
  },
  keyBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnSecondary: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  keyEmoji: {
    fontSize: 22,
    color: '#94a3b8',
  },
});
