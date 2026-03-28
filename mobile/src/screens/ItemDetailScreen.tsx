import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, Check, RefreshCw } from 'lucide-react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { getPriceHistory, scanItem, sourceColor, type ApiItem, type HistoryEntry } from '../api/client';
import { colors, fonts, radius, spacing } from '../theme/colors';
import type { WishlistStackParamList } from '../../App';

type RouteProps = RouteProp<WishlistStackParamList, 'ItemDetail'>;

export const ItemDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { item: initialItem } = route.params;

  const [item, setItem] = useState<ApiItem>(initialItem);
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [scanning, setScanning] = useState(false);

  const runScan = async () => {
    setScanning(true);
    try {
      const updated = await scanItem(item.id);
      setItem(updated);
      const h = await getPriceHistory(item.id);
      setHistory(h);
    } catch (e) {
      // ignore
    }
    setScanning(false);
  };

  useEffect(() => {
    getPriceHistory(item.id).then(setHistory).catch(() => {});
    // Auto-scan if no price data yet
    if (item.sources.length === 0) {
      runScan();
    }
  }, []);

  // Flatten all history entries sorted by time for the chart
  const allEntries = Object.values(history)
    .flat()
    .filter((e) => e.price != null)
    .sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime())
    .slice(-30);

  const historyPrices = allEntries.map((e) => e.price as number);
  const allTimeLow = historyPrices.length > 0 ? Math.min(...historyPrices) : null;

  const barData = historyPrices.map((val, i) => ({
    value: val,
    frontColor: i === historyPrices.length - 1 ? colors.primary : '#F4A7B1',
  }));

  // Sources from the item (already computed by backend)
  const sortedSources = [...item.sources].sort((a, b) => a.price - b.price);
  const bestSource = sortedSources[0] ?? null;
  const savings = item.avg_price && bestSource ? Math.round(item.avg_price - bestSource.price) : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.headerSub}>
            {scanning ? 'Scanning prices...' : item.sources.length > 0 ? `${item.sources.length} sources` : 'No data yet'}
          </Text>
        </View>
        {scanning ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <TouchableOpacity onPress={runScan} style={styles.refreshBtn}>
            <RefreshCw size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stat cards */}
        <View style={styles.statsRow}>
          {[
            { label: 'Best now', value: bestSource ? `$${bestSource.price}` : '—', color: colors.primary },
            { label: 'Avg price', value: item.avg_price != null ? `$${Math.round(item.avg_price)}` : '—', color: colors.foreground },
            { label: 'All-time low', value: allTimeLow != null ? `$${allTimeLow}` : '—', color: colors.dealGreen },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Price chart */}
        {barData.length > 0 && (
          <View style={styles.chartSection}>
            <Text style={styles.sectionLabel}>Price history</Text>
            <View style={styles.chartCard}>
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
                labelWidth={40}
              />
            </View>
          </View>
        )}

        {/* Sources */}
        {sortedSources.length > 0 && (
          <View style={styles.sourcesSection}>
            <Text style={styles.sectionLabel}>Prices across sources</Text>
            {savings > 0 && (
              <View style={styles.bestDealRow}>
                <Text style={styles.bestDealText}>Best deal found</Text>
                <Text style={styles.bestDealText}>Save ${savings}</Text>
              </View>
            )}
            <View style={styles.sourcesCard}>
              {sortedSources.map((source, i) => (
                <View
                  key={source.source_name}
                  style={[
                    styles.sourceRow,
                    i < sortedSources.length - 1 && styles.sourceRowBorder,
                  ]}
                >
                  <View style={[styles.sourceDot, { backgroundColor: sourceColor(source.source_name) }]} />
                  <Text style={styles.sourceName}>{source.source_name}</Text>
                  <Text style={styles.sourcePrice}>${source.price}</Text>
                  {i === 0 && <Check size={16} color={colors.dealGreen} />}
                </View>
              ))}
            </View>
          </View>
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
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  refreshBtn: {
    padding: spacing.xs,
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
  sourcesSection: {},
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
  sourcesCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sourceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  sourceName: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.foreground,
  },
  sourcePrice: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.foreground,
  },
});
