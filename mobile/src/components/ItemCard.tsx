import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import { colors, fonts, radius, spacing } from '../theme/colors';
import type { WishlistItem } from '../types';

interface ItemCardProps {
  item: WishlistItem;
  onPress: (item: WishlistItem) => void;
  showBadge?: boolean;
  badgeLabel?: string;
  priceLabel?: string;
  priceSub?: string;
  onBuy?: () => void;
  isBuying?: boolean;
}

function getTrend(item: WishlistItem): { trend: 'deal' | 'low' | 'avg'; label: string } {
  const { current_price, target_price, highest_price } = item;
  if (current_price > 0 && current_price <= target_price) {
    return { trend: 'deal', label: 'Deal now' };
  }
  if (highest_price > 0 && current_price < highest_price * 0.9) {
    return { trend: 'low', label: `Low $${current_price.toFixed(0)}` };
  }
  return { trend: 'avg', label: 'Avg' };
}

export const ItemCard = ({ item, onPress, showBadge, badgeLabel, priceLabel, priceSub, onBuy, isBuying }: ItemCardProps) => {
  const { trend, label } = getTrend(item);
  const displayPrice = priceLabel ?? (item.current_price > 0 ? `$${item.current_price.toFixed(0)}` : '—');

  const trendColor =
    trend === 'low' ? colors.dealGreen :
    trend === 'deal' ? colors.primary :
    colors.mutedForeground;

  const trendPrefix =
    trend === 'low' ? '↓ ' :
    trend === 'deal' ? '🔥 ' :
    '≈ ';

  const initials = (item.product_name ?? item.retailer ?? '?')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)} activeOpacity={0.7}>
      {/* Thumbnail */}
      <View style={styles.thumb}>
        <Text style={styles.thumbText}>{initials}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{item.product_name ?? 'Unknown'}</Text>
          {showBadge && badgeLabel && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeLabel}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>{item.retailer ?? item.product_url}</Text>
      </View>

      {/* Price */}
      <View style={styles.priceCol}>
        <Text style={[styles.price, priceLabel ? styles.priceGreen : trend === 'deal' ? styles.pricePrimary : styles.priceDefault]}>
          {displayPrice}
        </Text>
        {priceSub ? (
          <Text style={styles.priceSub}>{priceSub}</Text>
        ) : (
          <Text style={[styles.trendLabel, { color: trendColor }]}>
            {trendPrefix}{label}
          </Text>
        )}
      </View>

      {/* Subtle buy button */}
      {onBuy && (
        <TouchableOpacity
          style={styles.buyBtn}
          onPress={onBuy}
          disabled={isBuying}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isBuying ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <ShoppingBag size={16} color={colors.mutedForeground} />
          )}
        </TouchableOpacity>
      )}
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
  thumbText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.mutedForeground,
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
  buyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 2,
  },
});
