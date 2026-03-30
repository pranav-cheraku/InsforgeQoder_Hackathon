import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingDown, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { colors, fonts, radius, spacing } from '../theme/colors';
import type { WishlistItem } from '../types';
import { api } from '../services/api';
import { insforge } from '../services/insforge';
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

function BuyApprovalCard({
  item,
  onConfirm,
  onSkip,
  confirming,
  skipping,
}: {
  item: WishlistItem;
  onConfirm: () => void;
  onSkip: () => void;
  confirming: boolean;
  skipping: boolean;
}) {
  const name = item.product_name ?? item.product_url;
  const price = item.current_price > 0 ? item.current_price : item.target_price;
  const retailer = item.retailer ?? 'online';
  const savings = item.target_price > 0 ? item.target_price - price : 0;
  const defaultReasoning = `${name} is currently $${price.toFixed(2)} on ${retailer}${savings > 0 ? `, saving you $${savings.toFixed(2)} off your target` : ''}. This is a good deal — shall I complete the purchase?`;

  return (
    <View style={styles.approvalCard}>
      <Text style={styles.approvalHeading}>Agent wants to buy</Text>
      <Text style={styles.approvalBody}>
        {item.pending_reasoning || defaultReasoning}
      </Text>
      <Text style={styles.approvalMeta}>
        ${price.toFixed(2)}{retailer ? ` · ${retailer}` : ''}
      </Text>
      <View style={styles.approvalButtons}>
        <TouchableOpacity
          style={[styles.skipBtn, skipping && { opacity: 0.5 }]}
          onPress={onSkip}
          disabled={skipping || confirming}
        >
          {skipping
            ? <ActivityIndicator size="small" color={colors.foreground} />
            : <Text style={styles.skipBtnText}>Skip</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buyBtn, confirming && { opacity: 0.5 }]}
          onPress={onConfirm}
          disabled={confirming || skipping}
        >
          {confirming
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.buyBtnText}>Buy now</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const DealsScreen = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [skipping, setSkipping] = useState<string | null>(null);
  const { user } = useAuth();
  const navigation = useNavigation();

  const loadItems = useCallback(() => {
    if (!user) return;
    insforge.database
      .from('wishlist_items')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['watching', 'pending_buy'])
      .order('created_at', { ascending: false })
      .then(({ data }) => setItems(data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', loadItems);
    return unsub;
  }, [navigation, loadItems]);

  useEffect(() => {
    if (!user) return;
    const channel = `snag:user:${user.id}`;
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe(channel);
      insforge.realtime.on('price_update', loadItems);
      insforge.realtime.on('buy_ready', loadItems);
      insforge.realtime.on('buy_executed', loadItems);
    }).catch(console.error);
    return () => {
      insforge.realtime.off('price_update', loadItems);
      insforge.realtime.off('buy_ready', loadItems);
      insforge.realtime.off('buy_executed', loadItems);
      insforge.realtime.unsubscribe(channel);
    };
  }, [user, loadItems]);

  const handleRemove = async (id: string) => {
    setRemoving(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.wishlist.remove(id);
    } catch {
      loadItems();
    } finally {
      setRemoving(null);
    }
  };

  const handleConfirm = async (item: WishlistItem) => {
    setConfirming(item.id);
    try {
      // confirm-buy requires pending_buy status — promote watching items first
      if (item.status === 'watching') {
        await api.wishlist.updateStatus(item.id, 'pending_buy');
      }
      await api.buy.confirm(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      console.error('[Deals] confirm failed:', e);
    } finally {
      setConfirming(null);
    }
  };

  const handleSkip = async (item: WishlistItem) => {
    setSkipping(item.id);
    try {
      await api.buy.skip(item.id);
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: 'watching' as const } : i));
    } catch (e) {
      console.error('[Deals] skip failed:', e);
    } finally {
      setSkipping(null);
    }
  };

  // Show approval card for agent-flagged items AND watching items already at/below target
  const pending = items.filter((i) =>
    i.status === 'pending_buy' ||
    (i.status === 'watching' && i.current_price > 0 && i.current_price <= i.target_price)
  );
  const watching = items.filter((i) =>
    i.status === 'watching' && !(i.current_price > 0 && i.current_price <= i.target_price)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>snag.</Text>
      </View>

      <FlatList
        data={watching}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          <>
            {/* Approval cards for pending_buy items */}
            {pending.map((item) => (
              <BuyApprovalCard
                key={item.id}
                item={item}
                onConfirm={() => handleConfirm(item)}
                onSkip={() => handleSkip(item)}
                confirming={confirming === item.id}
                skipping={skipping === item.id}
              />
            ))}

            {watching.length > 0 && (
              <Text style={[styles.sectionLabel, { marginTop: pending.length > 0 ? spacing.lg : 0 }]}>
                Tracking ({watching.length})
              </Text>
            )}
          </>
        }
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
                  <Text style={styles.barLabel}>{pct}% to target</Text>
                </>
              )}

              <Text style={styles.timeLabel}>watching since {formatTime(item.created_at)}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading && pending.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No items tracked yet.{'\n'}Add something from the Wishlist tab.</Text>
            </View>
          ) : null
        }
      />

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
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
    paddingBottom: spacing.sm,
  },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 26,
    color: colors.primary,
    letterSpacing: -0.5,
  },

  // ── Approval card ─────────────────────────────────────────────────────────
  approvalCard: {
    backgroundColor: '#FFF1F1',
    borderRadius: 24,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  approvalHeading: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    color: colors.primary,
  },
  approvalBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    color: '#111',
    lineHeight: 22,
  },
  approvalMeta: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  approvalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.foreground,
  },
  buyBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 50,
    backgroundColor: colors.primary,
  },
  buyBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: '#fff',
  },

  // ── Section label ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  listContent: {
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

  // ── Tracking card ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
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
  dot: { width: 10, height: 10, borderRadius: 5 },
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
  retailerText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  removeBtn: { padding: 4, flexShrink: 0 },
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
  barFill: { height: 4, borderRadius: 2 },
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
