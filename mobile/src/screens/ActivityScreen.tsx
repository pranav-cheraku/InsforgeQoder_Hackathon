import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ShoppingBag } from 'lucide-react-native';

import { colors, fonts, radius, spacing } from '../theme/colors';
import type { Transaction } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

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

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const ActivityScreen = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    api.transactions.getAll(user.id)
      .then(setTransactions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
        <MapPin size={20} color={colors.foreground} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.center}>
            <ShoppingBag size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No purchases yet.{'\n'}The agent will act when prices hit your targets.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Purchases</Text>
            <View style={styles.activityList}>
              {transactions.map((tx) => {
                const name = tx.wishlist_items?.product_name ?? 'Item';
                const saved = tx.saved_amount > 0 ? ` · saved $${tx.saved_amount.toFixed(2)}` : '';
                const dotColor = tx.saved_amount > 10 ? colors.dealGreen : colors.primary;

                return (
                  <View key={tx.id} style={styles.activityRow}>
                    <View style={styles.dotWrapper}>
                      <PulseDot color={dotColor} />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityText}>
                        <Text style={styles.activityTitle}>{name}</Text>
                        {'  '}
                        <Text style={styles.activityDesc}>
                          bought for ${tx.buy_price.toFixed(2)}{saved}
                        </Text>
                      </Text>
                      {tx.reasoning && (
                        <View style={styles.reasoningCard}>
                          <Text style={styles.reasoningText} numberOfLines={3}>{tx.reasoning}</Text>
                        </View>
                      )}
                      <Text style={styles.activityTime}>{formatTime(tx.decided_at)}</Text>
                    </View>
                  </View>
                );
              })}
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
  center: {
    paddingTop: 80,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.md,
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
  reasoningCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  reasoningText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    lineHeight: 16,
  },
  activityTime: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 4,
  },
});
