import React from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { wishlistItems, type WishlistItem } from '../data/mockData';
import { ItemCard } from '../components/ItemCard';
import { colors, fonts, spacing } from '../theme/colors';
import type { DealsStackParamList } from '../../App';

type NavProp = NativeStackNavigationProp<DealsStackParamList, 'DealsMain'>;

export const DealsScreen = () => {
  const navigation = useNavigation<NavProp>();

  const deals = [...wishlistItems]
    .map((item) => {
      const bestPrice = Math.min(...item.sources.map((s) => s.price));
      const pctBelow = Math.round(((item.avgPrice - bestPrice) / item.avgPrice) * 100);
      return { ...item, bestPrice, pctBelow };
    })
    .sort((a, b) => b.pctBelow - a.pctBelow);

  const handleSelectItem = (item: WishlistItem) => {
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
        renderItem={({ item, index }) => (
          <ItemCard
            item={item}
            onPress={handleSelectItem}
            showBadge={index === 0}
            badgeLabel="🔥 Hot deal"
            priceLabel={`$${item.bestPrice}`}
            priceSub={`-${item.pctBelow}%`}
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
