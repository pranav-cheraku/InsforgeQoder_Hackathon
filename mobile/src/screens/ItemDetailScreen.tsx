import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { colors, fonts, radius, spacing } from '../theme/colors';
import type { WishlistStackParamList } from '../../App';
import type { PricePoint } from '../types';
import { api } from '../services/api';

type RouteProps = RouteProp<WishlistStackParamList, 'ItemDetail'>;

export const ItemDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { item } = route.params;

  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    api.priceHistory.getForItem(item.id)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
  }, [item.id]);

  const prices = history.map((p) => p.price);
  const allTimeLow = prices.length > 0 ? Math.min(...prices) : item.current_price;
  const avgPrice = prices.length > 0
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : item.current_price;

  // Use last 30 data points for chart
  const chartPrices = prices.slice(-30);
  const barData = chartPrices.map((val, i) => ({
    value: val,
    frontColor: i === chartPrices.length - 1 ? colors.primary : '#F4A7B1',
  }));

  const savings = item.highest_price > 0
    ? (item.highest_price - item.current_price).toFixed(2)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {item.product_name ?? 'Product'}
          </Text>
          <Text style={styles.headerSub}>{item.retailer ?? item.product_url}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stat cards */}
        <View style={styles.statsRow}>
          {[
            { label: 'Current', value: item.current_price > 0 ? `$${item.current_price.toFixed(0)}` : '—', color: colors.primary },
            { label: 'Target', value: `$${item.target_price.toFixed(0)}`, color: colors.foreground },
            { label: 'All-time low', value: allTimeLow > 0 ? `$${allTimeLow.toFixed(0)}` : '—', color: colors.dealGreen },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Price chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionLabel}>
            Price history {chartPrices.length > 0 ? `(${chartPrices.length} snapshots)` : ''}
          </Text>
          <View style={styles.chartCard}>
            {loadingHistory ? (
              <View style={styles.chartPlaceholder}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : chartPrices.length === 0 ? (
              <View style={styles.chartPlaceholder}>
                <Text style={styles.noDataText}>No price history yet</Text>
              </View>
            ) : (
              <BarChart
                data={barData}
                barWidth={7}
                spacing={2}
                roundedTop
                hideRules
                hideYAxisText
                hideAxesAndRules
                xAxisThickness={0}
                yAxisThickness={0}
                noOfSections={4}
                height={100}
                width={280}
                barBorderRadius={2}
              />
            )}
          </View>
        </View>

        {/* Price info section */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionLabel}>Price info</Text>
          {savings && Number(savings) > 0 && (
            <View style={styles.bestDealRow}>
              <Text style={styles.bestDealText}>Below peak</Text>
              <Text style={styles.bestDealText}>Save ${savings}</Text>
            </View>
          )}
          <View style={styles.infoCard}>
            {[
              { label: 'Current price', value: item.current_price > 0 ? `$${item.current_price.toFixed(2)}` : 'Not scraped yet' },
              { label: 'Target price', value: `$${item.target_price.toFixed(2)}` },
              { label: 'Highest seen', value: item.highest_price > 0 ? `$${item.highest_price.toFixed(2)}` : '—' },
              { label: '30-day avg', value: prices.length > 0 ? `$${avgPrice}` : '—' },
              { label: 'Status', value: item.status },
            ].map((row, i, arr) => (
              <View key={row.label} style={[styles.infoRow, styles.infoRowBorder]}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => Linking.openURL(item.product_url)}
              activeOpacity={0.7}
            >
              <Text style={styles.infoLabel}>Product link</Text>
              <View style={styles.linkRow}>
                <Text style={styles.linkText} numberOfLines={1}>
                  {item.product_url.replace(/^https?:\/\//, '').slice(0, 30)}…
                </Text>
                <ExternalLink size={13} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.foreground,
  },
  headerSub: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 17,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  chartSection: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    overflow: 'hidden',
  },
  chartPlaceholder: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontFamily: fonts.sansRegular,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  infoSection: {},
  bestDealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  bestDealText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.primary,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.foreground,
  },
  infoValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.primary,
  },
});
