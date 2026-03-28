import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  Animated, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingDown, X, ShoppingCart, Check } from 'lucide-react-native';
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

export const DealsScreen = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ name: string; price: number } | null>(null);
  const { user } = useAuth();
  const navigation = useNavigation();

  const loadItems = useCallback(() => {
    if (!user) return;
    insforge.database
      .from('wishlist_items')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'bought')
      .order('created_at', { ascending: false })
      .then(({ data }) => setItems((data ?? []).filter((i) => i.status !== 'paused')))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Reload whenever this tab comes into focus
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadItems);
    return unsub;
  }, [navigation, loadItems]);

  useEffect(() => {
    if (!user) return;
    const channel = `dealflow:user:${user.id}`;
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe(channel);
      insforge.realtime.on('price_update', loadItems);
      insforge.realtime.on('buy_executed', loadItems);
      insforge.realtime.on('buy_ready', (payload: any) => {
        loadItems();
        setBanner({ name: payload.product_name, price: payload.buy_price });
        setTimeout(() => setBanner(null), 8000);
      });
    }).catch(console.error);
    return () => {
      insforge.realtime.off('price_update', loadItems);
      insforge.realtime.off('buy_executed', loadItems);
      insforge.realtime.off('buy_ready', loadItems);
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
      loadItems();
    } finally {
      setRemoving(null);
    }
  };

  const handleConfirmBuy = async (item: WishlistItem) => {
    setConfirming(item.id);
    try {
      await api.buy.confirm(item.id);
      // Item will move to bought — remove from this list
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e: any) {
      console.error('[Deals] confirm buy failed:', e);
    } finally {
      setConfirming(null);
    }
  };

  const pending = items.filter((i) => i.status === 'pending_buy');
  const watching = items.filter((i) => i.status === 'watching');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
      </View>

      {/* Buy-ready notification banner */}
      {banner && (
        <View style={styles.banner}>
          <ShoppingCart size={14} color={colors.dealGreen} />
          <Text style={styles.bannerText} numberOfLines={1}>
            Agent wants to buy <Text style={{ fontFamily: fonts.sansBold }}>{banner.name}</Text> for ${banner.price?.toFixed(2)}
          </Text>
          <TouchableOpacity onPress={() => setBanner(null)}>
            <X size={14} color={colors.dealGreen} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={[...pending, ...watching]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          <>
            {pending.length > 0 && (
              <Text style={styles.sectionLabel}>Ready to Buy ({pending.length})</Text>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const isPending = item.status === 'pending_buy';
          // Insert "Tracking" section label before first watching item
          const firstWatchingIndex = pending.length;
          const showWatchingLabel = !isPending && index === firstWatchingIndex;

          const hasPrice = item.current_price > 0 && item.target_price > 0;
          const score = hasPrice ? Math.min(1, item.target_price / item.current_price) : 0;
          const pct = Math.round(score * 100);
          const atTarget = item.current_price > 0 && item.current_price <= item.target_price;
          const dotColor = isPending ? colors.dealGreen : atTarget ? colors.dealGreen : colors.primary;
          const name = item.product_name ?? item.product_url;

          return (
            <>
              {showWatchingLabel && (
                <Text style={[styles.sectionLabel, { marginTop: pending.length > 0 ? spacing.xl : 0 }]}>
                  Tracking ({watching.length})
                </Text>
              )}
              <View style={[styles.card, isPending && styles.cardPending]}>
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
                  {!isPending && (
                    <TouchableOpacity
                      onPress={() => handleRemove(item.id)}
                      style={styles.removeBtn}
                      disabled={removing === item.id}
                    >
                      <X size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  )}
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

                {hasPrice && !isPending && (
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

                {isPending && item.pending_reasoning && (
                  <View style={styles.reasoningCard}>
                    <Text style={styles.reasoningText} numberOfLines={4}>
                      {item.pending_reasoning}
                    </Text>
                  </View>
                )}

                {isPending ? (
                  <TouchableOpacity
                    style={[styles.approveBtn, confirming === item.id && styles.approveBtnDisabled]}
                    onPress={() => handleConfirmBuy(item)}
                    disabled={confirming === item.id}
                  >
                    {confirming === item.id ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Check size={14} color="#000" />
                        <Text style={styles.approveBtnText}>Approve Purchase</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.timeLabel}>watching since {formatTime(item.created_at)}</Text>
                )}
              </View>
            </>
          );
        }}
        ListEmptyComponent={
          !loading ? (
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: '#0d2e1a',
    borderWidth: 1,
    borderColor: colors.dealGreen,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerText: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.dealGreen,
  },
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  cardPending: {
    borderColor: colors.dealGreen,
    borderWidth: 1.5,
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
  reasoningCard: {
    backgroundColor: '#0d2e1a',
    borderRadius: radius.card,
    padding: spacing.sm,
  },
  reasoningText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dealGreen,
    lineHeight: 16,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dealGreen,
    borderRadius: radius.card,
    paddingVertical: 10,
  },
  approveBtnDisabled: { opacity: 0.6 },
  approveBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: '#000',
  },
  timeLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
  },
});
