import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ItemCard } from '../components/ItemCard';
import { colors, fonts, spacing } from '../theme/colors';
import type { DealsStackParamList } from '../../App';
import type { WishlistItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

type NavProp = NativeStackNavigationProp<DealsStackParamList, 'DealsMain'>;

type DealItem = WishlistItem & { savings: number; pctBelow: number };

export const DealsScreen = () => {
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    api.wishlist.getAll(user.id).then((data) => {
      const ranked = data
        .filter((item) => item.current_price > 0 && item.highest_price > 0)
        .map((item) => {
          const savings = item.highest_price - item.current_price;
          const pctBelow = Math.round((savings / item.highest_price) * 100);
          return { ...item, savings, pctBelow };
        })
        .sort((a, b) => b.pctBelow - a.pctBelow);
      setDeals(ranked);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
      </View>

      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Top Deals</Text>
        <Text style={styles.subtitle}>Sorted by drop from highest price</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item, index }) => (
            <ItemCard
              item={item}
              onPress={(i) => navigation.navigate('ItemDetail', { item: i })}
              showBadge={index === 0 && item.pctBelow > 0}
              badgeLabel="🔥 Hot deal"
              priceLabel={`$${item.current_price.toFixed(0)}`}
              priceSub={item.pctBelow > 0 ? `-${item.pctBelow}%` : undefined}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No deals yet. Add items to your wishlist to start tracking.</Text>
            </View>
          }
        />
      )}
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
  },
});
