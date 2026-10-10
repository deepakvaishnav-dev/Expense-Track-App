import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

export const DashboardSkeleton: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const [showColdStartHint, setShowColdStartHint] = useState(false);

  useEffect(() => {
    // Pulse animation for skeleton elements
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // If initial fetch takes > 3.5 seconds (Render free tier waking up), show helpful hint
    const timer = setTimeout(() => {
      setShowColdStartHint(true);
    }, 3500);

    return () => {
      pulse.stop();
      clearTimeout(timer);
    };
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      {/* Header Container */}
      <View style={styles.header}>
        {/* Top bar: Avatar + Icons */}
        <View style={styles.topRow}>
          <View style={styles.avatarRow}>
            <Animated.View style={[styles.skeletonCircle, { opacity: pulseAnim }]} />
            <View style={styles.greetingLines}>
              <Animated.View style={[styles.skeletonLineShort, { opacity: pulseAnim }]} />
              <Animated.View style={[styles.skeletonLineMedium, { opacity: pulseAnim, marginTop: 6 }]} />
            </View>
          </View>
          <View style={styles.iconRow}>
            <Animated.View style={[styles.iconCircle, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.iconCircle, { opacity: pulseAnim, marginLeft: 8 }]} />
          </View>
        </View>

        {/* Cold-start notification hint if cloud service is waking up */}
        {showColdStartHint && (
          <View style={styles.hintBadge}>
            <Text style={styles.hintText}>⚡ Waking up cloud server (Render free-tier cold start)...</Text>
          </View>
        )}

        {/* Top Metric Cards (Today's Spend & Monthly Total) */}
        <View style={styles.metricsRow}>
          <Animated.View style={[styles.metricCard, { opacity: pulseAnim }]}>
            <View style={styles.metricLabelSkeleton} />
            <View style={styles.metricValueSkeleton} />
          </Animated.View>
          <Animated.View style={[styles.metricCard, { opacity: pulseAnim }]}>
            <View style={styles.metricLabelSkeleton} />
            <View style={styles.metricValueSkeleton} />
          </Animated.View>
        </View>
      </View>

      {/* Main Content Body */}
      <View style={styles.body}>
        {/* KhataBook Card Skeleton */}
        <Animated.View style={[styles.card, { opacity: pulseAnim, marginBottom: 16 }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.khataIconSkeleton} />
            <View style={{ flex: 1 }}>
              <View style={styles.cardTitleSkeleton} />
              <View style={styles.cardSubtitleSkeleton} />
            </View>
          </View>
          <View style={styles.khataBarSkeleton} />
        </Animated.View>

        {/* Spending by Category Card Skeleton */}
        <Animated.View style={[styles.card, { opacity: pulseAnim, marginBottom: 16 }]}>
          <View style={styles.categoryTitleRow}>
            <View style={styles.cardTitleSkeleton} />
            <View style={[styles.cardSubtitleSkeleton, { width: 60 }]} />
          </View>
          <View style={styles.categoryContentRow}>
            <View style={styles.donutSkeleton} />
            <View style={styles.categoryLinesCol}>
              <View style={[styles.catLine, { width: '85%' }]} />
              <View style={[styles.catLine, { width: '70%' }]} />
              <View style={[styles.catLine, { width: '90%' }]} />
            </View>
          </View>
        </Animated.View>

        {/* Recent Transactions Skeleton */}
        <Animated.View style={[styles.card, { opacity: pulseAnim }]}>
          <View style={styles.cardTitleSkeleton} />
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.txnItemRow}>
              <View style={styles.txnIconSkeleton} />
              <View style={{ flex: 1 }}>
                <View style={[styles.catLine, { width: '60%' }]} />
                <View style={[styles.catLine, { width: '35%', marginTop: 4 }]} />
              </View>
              <View style={[styles.catLine, { width: 50 }]} />
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#2563eb',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingLines: {
    marginLeft: 12,
  },
  skeletonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  skeletonLineShort: {
    width: 60,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  skeletonLineMedium: {
    width: 100,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  iconRow: {
    flexDirection: 'row',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  hintBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  hintText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 20,
    padding: 16,
  },
  metricLabelSkeleton: {
    width: 70,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    marginBottom: 10,
  },
  metricValueSkeleton: {
    width: 90,
    height: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  body: {
    paddingHorizontal: 24,
    marginTop: -24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  khataIconSkeleton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
  },
  cardTitleSkeleton: {
    width: 120,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
    marginBottom: 6,
  },
  cardSubtitleSkeleton: {
    width: 180,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#f1f5f9',
  },
  khataBarSkeleton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  categoryTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donutSkeleton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
  },
  categoryLinesCol: {
    flex: 1,
    marginLeft: 20,
  },
  catLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    marginBottom: 10,
  },
  txnItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  txnIconSkeleton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    marginRight: 12,
  },
});
