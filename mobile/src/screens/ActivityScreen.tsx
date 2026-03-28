import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ShoppingBag } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

import { colors, fonts, radius, spacing } from '../theme/colors';
import type { WishlistItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const ActivityScreen = () => {
  const [boughtItems, setBoughtItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigation = useNavigation();

  const loadBought = useCallback(() => {
    if (!user) return;
    api.wishlist.getAll(user.id)
      .then((items) => setBoughtItems(items.filter((i) => i.status === 'bought')))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { loadBought(); }, [loadBought]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadBought);
    return unsubscribe;
  }, [navigation, loadBought]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>snag.</Text>
        <MapPin size={20} color={colors.foreground} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : boughtItems.length === 0 ? (
          <View style={styles.center}>
            <ShoppingBag size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>
              No purchases yet.{'\n'}Tap the bag icon on any item to buy it.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Purchase History</Text>
            <View style={styles.activityList}>
              {boughtItems.map((item) => {
                const name = item.product_name ?? 'Item';
                const price = item.current_price > 0 ? `$${item.current_price.toFixed(2)}` : '—';
                const retailer = item.retailer ?? null;

                return (
                  <View key={item.id} style={styles.activityRow}>
                    <View style={styles.thumbSmall}>
                      <Text style={styles.thumbText}>
                        {name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle} numberOfLines={1}>{name}</Text>
                      <Text style={styles.activityDesc}>
                        {price}{retailer ? ` · ${retailer}` : ''}
                      </Text>
                      <Text style={styles.activityTime}>{formatTime(item.created_at)}</Text>
                    </View>
                    <View style={styles.boughtBadge}>
                      <Text style={styles.boughtBadgeText}>Bought</Text>
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
    gap: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  thumbSmall: {
    width: 40,
    height: 40,
    borderRadius: radius.thumb,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  activityContent: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.foreground,
  },
  activityDesc: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  activityTime: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  boughtBadge: {
    backgroundColor: colors.dealGreen + '22',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  boughtBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.dealGreen,
  },
});
