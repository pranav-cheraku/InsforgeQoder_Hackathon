import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
} from 'react-native';
import { MapPin, CheckCircle } from 'lucide-react-native';

import { activityItems } from '../data/mockData';
import { colors, fonts, radius, spacing } from '../theme/colors';

type AgentState = 'pending' | 'bought' | 'skipped';

const DOT_COLORS: Record<string, string> = {
  red: colors.primary,
  green: colors.dealGreen,
  gray: colors.dotGray,
};

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

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color, transform: [{ scale }] },
      ]}
    />
  );
}

export const ActivityScreen = () => {
  const [agentState, setAgentState] = useState<AgentState>('pending');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
        <MapPin size={20} color={colors.foreground} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Agent permission card */}
        {agentState === 'pending' && (
          <View style={styles.agentCard}>
            <Text style={styles.agentTitle}>Agent wants to buy</Text>
            <Text style={styles.agentBody}>
              Sony WH-1000XM5 hit your target price of{' '}
              <Text style={styles.agentBold}>$249</Text> on eBay (new, free shipping).{'\n'}
              This is the lowest price in 90 days. Shall I complete the purchase?
            </Text>
            <Text style={styles.agentMeta}>$249 · eBay · Ships in 2 days</Text>
            <View style={styles.agentActions}>
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => setAgentState('skipped')}
                activeOpacity={0.7}
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.buyBtn}
                onPress={() => setAgentState('bought')}
                activeOpacity={0.8}
              >
                <Text style={styles.buyText}>Buy now</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {agentState === 'bought' && (
          <View style={styles.successCard}>
            <CheckCircle size={24} color={colors.dealGreen} />
            <View style={styles.successText}>
              <Text style={styles.successTitle}>Order placed</Text>
              <Text style={styles.successMeta}>Confirmation sent.</Text>
            </View>
          </View>
        )}

        {/* Recent Activity */}
        <Text style={styles.sectionLabel}>Recent Activity</Text>
        <View style={styles.activityList}>
          {activityItems.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={styles.dotWrapper}>
                <PulseDot color={DOT_COLORS[item.dot]} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  {'  '}
                  <Text style={styles.activityDesc}>{item.description}</Text>
                </Text>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
            </View>
          ))}
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
  agentCard: {
    backgroundColor: colors.bgAlert,
    borderWidth: 1,
    borderColor: `${colors.primary}1A`,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  agentTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  agentBody: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  agentBold: {
    fontFamily: fonts.sansBold,
  },
  agentMeta: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  agentActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.foreground,
  },
  buyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buyText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.primaryForeground,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: `${colors.dealGreen}1A`,
    borderWidth: 1,
    borderColor: `${colors.dealGreen}33`,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  successText: {
    flex: 1,
  },
  successTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.dealGreen,
  },
  successMeta: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
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
    gap: spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dotWrapper: {
    paddingTop: 6,
    flexShrink: 0,
    width: 10,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityContent: {
    flex: 1,
    minWidth: 0,
  },
  activityText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  activityTitle: {
    fontFamily: fonts.sansSemiBold,
  },
  activityDesc: {
    color: colors.mutedForeground,
  },
  activityTime: {
    fontFamily: fonts.sansRegular,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
