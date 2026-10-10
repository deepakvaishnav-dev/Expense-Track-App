import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
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
    tag,
    highlightText,
    iconEmoji,
  } = options;

  const handleButtonPress = (btnPress?: () => void) => {
    hideAlert();
    if (btnPress) {
      setTimeout(() => btnPress(), 100);
    }
  };

  // Determine contextual color scheme
  const getThemeConfig = () => {
    // If specific tag is provided, customize palette
    const upperTag = tag?.toUpperCase();
    if (upperTag === 'EXPENSE') {
      return {
        outerBg: '#fee2e2',
        innerBg: '#fecaca',
        borderColor: '#fca5a5',
        buttonColor: '#2563eb', // Clean primary blue for expense action button
        tagBg: '#fef2f2',
        tagBorder: '#fecaca',
        tagColor: '#dc2626',
        highlightColor: '#dc2626',
        highlightBg: '#fff1f2',
        highlightBorder: '#ffe4e6',
        icon: (
          <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 4v16m0 0l-5-5m5 5l5-5"
              stroke="#dc2626"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ),
      };
    }

    if (upperTag === 'INCOME') {
      return {
        outerBg: '#d1fae5',
        innerBg: '#a7f3d0',
        borderColor: '#6ee7b7',
        buttonColor: '#059669', // Rich emerald
        tagBg: '#ecfdf5',
        tagBorder: '#a7f3d0',
        tagColor: '#059669',
        highlightColor: '#059669',
        highlightBg: '#ecfdf5',
        highlightBorder: '#a7f3d0',
        icon: (
          <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 20V4m0 0l5 5m-5-5l-5 5"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ),
      };
    }

    if (upperTag === 'AUTHENTICATED' || upperTag === 'LOGIN') {
      return {
        outerBg: '#dbeafe',
        innerBg: '#bfdbfe',
        borderColor: '#93c5fd',
        buttonColor: '#2563eb',
        tagBg: '#eff6ff',
        tagBorder: '#bfdbfe',
        tagColor: '#1d4ed8',
        highlightColor: '#1d4ed8',
        highlightBg: '#eff6ff',
        highlightBorder: '#dbeafe',
        icon: (
          <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke="#2563eb"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ),
      };
    }

    switch (type) {
      case 'success':
        return {
          outerBg: '#ecfdf5',
          innerBg: '#d1fae5',
          borderColor: '#a7f3d0',
          buttonColor: '#059669',
          tagBg: '#ecfdf5',
          tagBorder: '#a7f3d0',
          tagColor: '#059669',
          highlightColor: '#059669',
          highlightBg: '#ecfdf5',
          highlightBorder: '#a7f3d0',
          icon: (
            <Svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 13l4 4L19 7"
                stroke="#059669"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
        };
      case 'error':
        return {
          outerBg: '#fef2f2',
          innerBg: '#fee2e2',
          borderColor: '#fca5a5',
          buttonColor: '#ef4444',
          tagBg: '#fef2f2',
          tagBorder: '#fecaca',
          tagColor: '#dc2626',
          highlightColor: '#dc2626',
          highlightBg: '#fef2f2',
          highlightBorder: '#fecaca',
          icon: (
            <Svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 6L6 18M6 6l12 12"
                stroke="#ef4444"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
        };
      case 'warning':
        return {
          outerBg: '#fffbeb',
          innerBg: '#fef3c7',
          borderColor: '#fde68a',
          buttonColor: '#d97706',
          tagBg: '#fffbeb',
          tagBorder: '#fde68a',
          tagColor: '#b45309',
          highlightColor: '#b45309',
          highlightBg: '#fffbeb',
          highlightBorder: '#fde68a',
          icon: (
            <Svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="#d97706"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ),
        };
      case 'info':
      default:
        return {
          outerBg: '#eff6ff',
          innerBg: '#dbeafe',
          borderColor: '#bfdbfe',
          buttonColor: '#2563eb',
          tagBg: '#eff6ff',
          tagBorder: '#bfdbfe',
          tagColor: '#1d4ed8',
          highlightColor: '#1d4ed8',
          highlightBg: '#eff6ff',
          highlightBorder: '#dbeafe',
          icon: (
            <Svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <Path
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="#2563eb"
                strokeWidth="2.3"
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
      <Pressable style={styles.backdrop} onPress={hideAlert}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* Optional Category Tag */}
          {tag && (
            <View
              style={[
                styles.tagBadge,
                { backgroundColor: theme.tagBg, borderColor: theme.tagBorder },
              ]}
            >
              <Text style={[styles.tagText, { color: theme.tagColor }]}>
                {tag}
              </Text>
            </View>
          )}

          {/* Dual-layered Icon / Emoji Hero Badge */}
          <View
            style={[
              styles.outerRing,
              { backgroundColor: theme.outerBg, borderColor: theme.borderColor },
            ]}
          >
            <View style={[styles.innerRing, { backgroundColor: theme.innerBg }]}>
              {iconEmoji ? (
                <Text style={styles.emojiText}>{iconEmoji}</Text>
              ) : (
                theme.icon
              )}
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Amount / Highlight Chip (if available) */}
          {highlightText && (
            <View
              style={[
                styles.highlightChip,
                { backgroundColor: theme.highlightBg, borderColor: theme.highlightBorder },
              ]}
            >
              <Text
                style={[
                  styles.highlightText,
                  { color: theme.highlightColor },
                ]}
              >
                {highlightText}
              </Text>
            </View>
          )}

          {/* Message / Description */}
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
                  ? '#f1f5f9'
                  : theme.buttonColor;
                const txtColor = isCancel ? '#475569' : '#ffffff';

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
                        borderColor: '#e2e8f0',
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
                    {
                      flex: 1,
                      backgroundColor: '#f1f5f9',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                    },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: '#475569' }]}>
                    {cancelText}
                  </Text>
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
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>
                  {confirmText}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 345,
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  tagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: 14,
    alignSelf: 'center',
  },
  tagText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  outerRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  innerRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 26,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  highlightChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 8,
    alignSelf: 'center',
  },
  highlightText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
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
    height: 50,
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
