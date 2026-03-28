import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
} from 'react-native';
import { MapPin, CheckCircle } from 'lucide-react-native';

import {
  getAlerts,
  dismissAlert,
  approveAlert,
  type ApiAlert,
  type OrderConfirmation,
} from '../api/client';
import { colors, fonts, radius, spacing } from '../theme/colors';

function dotColorForAlert(alert: ApiAlert): string {
  if (alert.alert_type === 'target_price') return colors.primary;
  if (alert.alert_type === 'price_drop') return colors.dealGreen;
  return colors.dotGray;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 750, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color, transform: [{ scale }] }]} />
  );
}

export const ActivityScreen = () => {
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [order, setOrder] = useState<OrderConfirmation | null>(null);

  const load = useCallback(async () => {
    try {
      setAlerts(await getAlerts());
    } catch (e) {
      // silently fail
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingAlert = alerts.find((a) => a.requires_permission && !a.dismissed);
  const activityAlerts = alerts.filter((a) => !a.requires_permission || a.id !== pendingAlert?.id);

  const handleSkip = async () => {
    if (!pendingAlert) return;
    await dismissAlert(pendingAlert.id);
    setOrder(null);
    await load();
  };

  const handleBuy = async () => {
    if (!pendingAlert) return;
    const confirmation = await approveAlert(pendingAlert.id);
    setOrder(confirmation);
    await load();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
        <MapPin size={20} color={colors.foreground} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Agent permission card */}
        {pendingAlert && !order && (
          <View style={styles.agentCard}>
            <Text style={styles.agentTitle}>Agent wants to buy</Text>
            <Text style={styles.agentBody}>{pendingAlert.message}</Text>
            <Text style={styles.agentMeta}>
              ${pendingAlert.price} · {pendingAlert.source_name} · Ships in 2 days
            </Text>
            <View style={styles.agentActions}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} activeOpacity={0.8}>
                <Text style={styles.buyText}>Buy now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {order && (
          <View style={styles.successCard}>
            <CheckCircle size={24} color={colors.dealGreen} />
            <View style={styles.successText}>
              <Text style={styles.successTitle}>Order placed · {order.order_id}</Text>
              <Text style={styles.successMeta}>
                {order.item_name} · ${order.price} · {order.estimated_delivery}
              </Text>
            </View>
          </View>
        )}

        {/* Recent Activity */}
        {activityAlerts.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recent Activity</Text>
            <View style={styles.activityList}>
              {activityAlerts.map((alert) => (
                <View key={alert.id} style={styles.activityRow}>
                  <View style={styles.dotWrapper}>
                    <PulseDot color={dotColorForAlert(alert)} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityTitle}>{alert.source_name}</Text>
                      {'  '}
                      <Text style={styles.activityDesc}>{alert.message}</Text>
                    </Text>
                    <Text style={styles.activityTime}>{timeAgo(alert.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 26,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  agentCard: {
    backgroundColor: colors.bgAlert,
    borderWidth: 1,
    borderColor: `${colors.primary}1A`,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  agentTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  agentBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  agentMeta: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  agentActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.foreground,
  },
  buyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buyText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.primaryForeground,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: `${colors.dealGreen}1A`,
    borderWidth: 1,
    borderColor: `${colors.dealGreen}33`,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  successText: {
    flex: 1,
  },
  successTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.dealGreen,
  },
  successMeta: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  activityList: {
    gap: spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dotWrapper: {
    paddingTop: 6,
    flexShrink: 0,
    width: 10,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityContent: {
    flex: 1,
    minWidth: 0,
  },
  activityText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  activityTitle: {
    fontFamily: fonts.sansSemiBold,
  },
  activityDesc: {
    color: colors.mutedForeground,
  },
  activityTime: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
