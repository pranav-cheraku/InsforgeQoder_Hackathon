import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getItems, type ApiItem } from '../api/client';
import { ItemCard } from '../components/ItemCard';
import { colors, fonts, spacing } from '../theme/colors';
import type { DealsStackParamList } from '../../App';

type NavProp = NativeStackNavigationProp<DealsStackParamList, 'DealsMain'>;

export const DealsScreen = () => {
  const [items, setItems] = useState<ApiItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<NavProp>();

  const load = useCallback(async () => {
    try {
      setItems(await getItems());
    } catch (e) {
      // silently fail
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const deals = items
    .filter((item) => item.best_price != null && item.avg_price != null)
    .map((item) => {
      const pctBelow = Math.round(((item.avg_price! - item.best_price!) / item.avg_price!) * 100);
      return { ...item, pctBelow };
    })
    .sort((a, b) => b.pctBelow - a.pctBelow);

  const handleSelectItem = (item: ApiItem) => {
    navigation.navigate('ItemDetail', { item });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
      </View>

      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Top Deals</Text>
        <Text style={styles.subtitle}>Sorted by savings vs. average price</Text>
      </View>

      {/* List */}
      <FlatList
        data={deals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item, index }) => (
          <ItemCard
            item={item}
            onPress={handleSelectItem}
            showBadge={index === 0 && item.pctBelow > 0}
            badgeLabel="🔥 Hot deal"
            priceLabel={`$${item.best_price}`}
            priceSub={item.pctBelow > 0 ? `-${item.pctBelow}%` : undefined}
          />
        )}
      />
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
});
