import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { ChevronLeft, Check } from 'lucide-react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { colors, fonts, radius, spacing } from '../theme/colors';
import type { WishlistStackParamList } from '../../App';

type RouteProps = RouteProp<WishlistStackParamList, 'ItemDetail'>;

export const ItemDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { item } = route.params;

  const bestSource = item.sources.find((s) => s.best);
  const savings = item.avgPrice - (bestSource?.price ?? item.price);

  // Build bar chart data — last bar highlighted red, others light red
  const barData = item.priceHistory.map((val, i) => ({
    value: val,
    frontColor: i === item.priceHistory.length - 1 ? colors.primary : '#F4A7B1',
    topLabelComponent:
      i === item.priceHistory.length - 1
        ? () => null
        : undefined,
  }));

  // Normalize for chart height — find min/max
  const minVal = Math.min(...item.priceHistory);
  const chartMin = Math.floor(minVal * 0.95);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.headerSub}>Updated 2m ago</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stat cards */}
        <View style={styles.statsRow}>
          {[
            { label: 'Best now', value: `$${bestSource?.price ?? item.price}`, color: colors.primary },
            { label: 'Avg price', value: `$${item.avgPrice}`, color: colors.foreground },
            { label: 'All-time low', value: `$${item.allTimeLow}`, color: colors.dealGreen },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* Price chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionLabel}>30-day price history</Text>
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
              xAxisLabelTexts={item.priceHistory.map((_, i) =>
                i === 0 ? 'Mar 1' : i === 14 ? 'Mar 14' : i === 29 ? 'Today' : ''
              )}
              xAxisLabelTextStyle={{ color: colors.mutedForeground, fontSize: 9, fontFamily: fonts.sansRegular }}
            />
          </View>
        </View>

        {/* Sources */}
        <View style={styles.sourcesSection}>
          <Text style={styles.sectionLabel}>Prices across sources</Text>
          {savings > 0 && (
            <View style={styles.bestDealRow}>
              <Text style={styles.bestDealText}>Best deal found</Text>
              <Text style={styles.bestDealText}>Save ${savings}</Text>
            </View>
          )}
          <View style={styles.sourcesCard}>
            {item.sources.map((source, i) => (
              <View
                key={source.name}
                style={[
                  styles.sourceRow,
                  i < item.sources.length - 1 && styles.sourceRowBorder,
                ]}
              >
                <View style={[styles.sourceDot, { backgroundColor: source.dot }]} />
                <Text style={styles.sourceName}>{source.name}</Text>
                <Text style={styles.sourcePrice}>${source.price}</Text>
                {source.best && <Check size={16} color={colors.dealGreen} />}
              </View>
            ))}
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
