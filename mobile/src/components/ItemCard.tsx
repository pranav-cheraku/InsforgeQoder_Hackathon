import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme/colors';
import type { WishlistItem } from '../data/mockData';

interface ItemCardProps {
  item: WishlistItem;
  onPress: (item: WishlistItem) => void;
  showBadge?: boolean;
  badgeLabel?: string;
  priceLabel?: string;
  priceSub?: string;
}

export const ItemCard = ({ item, onPress, showBadge, badgeLabel, priceLabel, priceSub }: ItemCardProps) => {
  const price = priceLabel ?? `$${item.price}`;
  const trendColor =
    item.trend === 'low' ? colors.dealGreen :
    item.trend === 'deal' ? colors.primary :
    colors.mutedForeground;

  const trendPrefix =
    item.trend === 'low' ? '↓ ' :
    item.trend === 'deal' ? '↑ ' :
    '≈ ';

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.7}>
      {/* Thumbnail */}
      <View style={styles.thumb}>
        <Text style={styles.thumbEmoji}>{item.image}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {showBadge && badgeLabel && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>

      {/* Price */}
      <View style={styles.priceCol}>
        <Text style={[styles.price, priceLabel ? styles.priceGreen : item.trend === 'deal' ? styles.pricePrimary : styles.priceDefault]}>
          {price}
        </Text>
        {priceSub ? (
          <Text style={styles.priceSub}>{priceSub}</Text>
        ) : (
          <Text style={[styles.trendLabel, { color: trendColor }]}>
            {trendPrefix}{item.trendLabel}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.thumb,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thumbEmoji: {
    fontSize: 26,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.foreground,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.primaryForeground,
  },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  priceCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  price: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  priceDefault: {
    color: colors.foreground,
  },
  pricePrimary: {
    color: colors.primary,
  },
  priceGreen: {
    color: colors.primary,
  },
  trendLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    marginTop: 2,
  },
  priceSub: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.dealGreen,
    marginTop: 2,
  },
});
