import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingDown, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, fonts, radius, spacing } from '../theme/colors';
import type { DealsStackParamList } from '../../App';
import type { WishlistItem } from '../types';
import { api } from '../services/api';
import { insforge } from '../services/insforge';
import { useAuth } from '../context/AuthContext';

type NavProp = NativeStackNavigationProp<DealsStackParamList, 'DealsMain'>;

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
  return <Animated.View style={[styles.dot, { backgroundColor: color, transform: [{ scale }] }]} />;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const DealsScreen = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const { user } = useAuth();

  const loadItems = useCallback(() => {
    if (!user) return;
    insforge.database
      .from('wishlist_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'watching')
      .order('created_at', { ascending: false })
      .then(({ data }) => setItems(data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Refresh on realtime price updates
  useEffect(() => {
    if (!user) return;
    const channel = `dealflow:user:${user.id}`;
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe(channel);
      insforge.realtime.on('price_update', loadItems);
      insforge.realtime.on('buy_executed', loadItems);
    }).catch(console.error);
    return () => {
      insforge.realtime.off('price_update', loadItems);
      insforge.realtime.off('buy_executed', loadItems);
      insforge.realtime.unsubscribe(channel);
    };
  }, [user, loadItems]);

  const handleRemove = async (id: string) => {
    setRemoving(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.wishlist.remove(id);
    } catch (e) {
      console.error('[Deals] remove failed:', e);
      loadItems(); // revert optimistic update on failure
    } finally {
      setRemoving(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>Tracking</Text>
        <Text style={styles.subtitle}>Agent monitors these every 30 min</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => {
            const hasPrice = item.current_price > 0 && item.target_price > 0;
            const score = hasPrice ? Math.min(1, item.target_price / item.current_price) : 0;
            const pct = Math.round(score * 100);
            const atTarget = item.current_price > 0 && item.current_price <= item.target_price;
            const dotColor = atTarget ? colors.dealGreen : colors.primary;
            const name = item.product_name ?? item.product_url;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.dotWrapper}>
                    <PulseDot color={dotColor} />
                  </View>
                  <Text style={styles.itemName} numberOfLines={2}>{name}</Text>
                  {item.retailer ? (
                    <View style={styles.retailerBadge}>
                      <Text style={styles.retailerText}>{item.retailer}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    onPress={() => handleRemove(item.id)}
                    style={styles.removeBtn}
                    disabled={removing === item.id}
                  >
                    <X size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>Current</Text>
                    <Text style={[styles.priceValue, atTarget && { color: colors.dealGreen }]}>
                      {item.current_price > 0 ? `$${item.current_price.toFixed(2)}` : '—'}
                    </Text>
                  </View>
                  <TrendingDown size={16} color={colors.mutedForeground} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.priceLabel}>Target</Text>
                    <Text style={styles.priceValue}>
                      {item.target_price > 0 ? `$${item.target_price.toFixed(2)}` : '—'}
                    </Text>
                  </View>
                </View>

                {hasPrice && (
                  <>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, {
                        width: `${pct}%` as any,
                        backgroundColor: atTarget ? colors.dealGreen : colors.primary,
                      }]} />
                    </View>
                    <Text style={styles.barLabel}>
                      {atTarget ? '✓ At target — agent will buy soon' : `${pct}% to target`}
                    </Text>
                  </>
                )}

                <Text style={styles.timeLabel}>watching since {formatTime(item.created_at)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No items tracked yet.{'\n'}Add something from the Wishlist tab.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  titleRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.foreground,
  },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  dotWrapper: {
    paddingTop: 4,
    width: 10,
    alignItems: 'center',
    flexShrink: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemName: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  retailerBadge: {
    backgroundColor: colors.muted,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
  },
  removeBtn: {
    padding: 4,
    flexShrink: 0,
  },
  retailerText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  priceLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  priceValue: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  barTrack: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  barLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  timeLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
  },
});
