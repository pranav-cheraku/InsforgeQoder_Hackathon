import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { Bell, Clock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { wishlistItems, type WishlistItem } from '../data/mockData';
import { ItemCard } from '../components/ItemCard';
import { colors, fonts, spacing } from '../theme/colors';
import type { WishlistStackParamList } from '../../App';

type SubTab = 'wishlist' | 'deals' | 'activity';

type NavProp = NativeStackNavigationProp<WishlistStackParamList, 'WishlistMain'>;

export const WishlistScreen = () => {
  const [subTab, setSubTab] = useState<SubTab>('wishlist');
  const navigation = useNavigation<NavProp>();

  const handleSelectItem = (item: WishlistItem) => {
    navigation.navigate('ItemDetail', { item });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Bell size={20} color={colors.foreground} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Clock size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sub tabs */}
      <View style={styles.subTabRow}>
        {(['wishlist', 'deals', 'activity'] as SubTab[]).map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setSubTab(tab)} style={styles.subTabBtn}>
            <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>
              {tab}
            </Text>
            {subTab === tab && <View style={styles.subTabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Add item input */}
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Add item or paste URL..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={styles.input}
        />
      </View>

      {/* Watching label */}
      <View style={styles.watchingRow}>
        <Text style={styles.watchingLabel}>Watching ({wishlistItems.length})</Text>
      </View>

      {/* Items list */}
      <FlatList
        data={wishlistItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <ItemCard item={item} onPress={handleSelectItem} />
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
    paddingBottom: spacing.xs,
  },
  brand: {
    fontFamily: fonts.brand,
    fontSize: 26,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBtn: {
    padding: spacing.xs,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.primaryForeground,
  },
  subTabRow: {
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subTabBtn: {
    paddingBottom: spacing.sm,
    position: 'relative',
  },
  subTabText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  subTabTextActive: {
    color: colors.primary,
  },
  subTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
  inputWrapper: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.foreground,
    color: colors.primaryForeground,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.sansRegular,
    fontSize: 14,
  },
  watchingRow: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  watchingLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
