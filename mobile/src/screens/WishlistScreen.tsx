import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Search, ArrowRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ItemCard } from '../components/ItemCard';
import { colors, fonts, spacing } from '../theme/colors';
import type { WishlistStackParamList } from '../../App';
import type { WishlistItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

type NavProp = NativeStackNavigationProp<WishlistStackParamList, 'WishlistMain'>;

export const WishlistScreen = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const navigation = useNavigation<NavProp>();
  const { user } = useAuth();

  const loadItems = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.wishlist.getAll(user.id);
      setItems(data);
    } catch (e) {
      console.error('Failed to load wishlist:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Reload when navigating back from SearchResults
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadItems);
    return unsubscribe;
  }, [navigation, loadItems]);

  const handleAddItem = async () => {
    const text = url.trim();
    if (!text || !user) return;
    setAddError(null);
    setSuccessMsg(null);

    const isUrl = text.startsWith('http://') || text.startsWith('https://');

    if (isUrl) {
      const price = parseFloat(targetPrice);
      if (isNaN(price) || price <= 0) {
        setAddError('Enter a target price to track this URL.');
        return;
      }
      setAddingItem(true);
      try {
        const newItem = await api.wishlist.add({
          user_id: user.id,
          product_url: text,
          product_name: null,
          retailer: null,
          image_url: null,
          current_price: 0,
          target_price: price,
          status: 'watching',
        });
        api.agent.triggerScrape(newItem.id).catch(() => {});
        setUrl('');
        setTargetPrice('');
        setSuccessMsg('Added! Agent is monitoring.');
        setTimeout(() => setSuccessMsg(null), 3000);
        await loadItems();
      } catch (e: any) {
        console.error('[Wishlist] add failed:', e);
        setAddError(e?.message ?? 'Failed to add item. Try again.');
      } finally {
        setAddingItem(false);
      }
      return;
    }

    // Natural language — auto-identify best product match
    setAddingItem(true);
    try {
      const res = await fetch(`${API_BASE}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error ${res.status}`);
      }
      const identified = await res.json();
      if (!identified.product_url) throw new Error('Could not find a product URL. Try being more specific.');

      const newItem = await api.wishlist.add({
        user_id: user.id,
        product_url: identified.product_url,
        product_name: identified.product_name,
        retailer: identified.retailer,
        image_url: null,
        current_price: identified.price_estimate ?? 0,
        target_price: (targetPrice && parseFloat(targetPrice) > 0) ? parseFloat(targetPrice) : (identified.price_estimate ?? 0),
        status: 'watching',
      });
      api.agent.triggerScrape(newItem.id).catch(() => {});
      setUrl('');
      setTargetPrice('');
      setSuccessMsg(`Monitoring "${identified.product_name}"`);
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadItems();
    } catch (e: any) {
      console.error('[Wishlist] identify failed:', e);
      setAddError(e?.message ?? 'Could not identify product. Try again.');
    } finally {
      setAddingItem(false);
    }
  };

  const watching = items.filter((i) => i.status === 'watching');
  const bought = items.filter((i) => i.status === 'bought');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>drip.</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Bell size={20} color={colors.foreground} />
            {watching.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{watching.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Add item card */}
      <View style={styles.inputCard}>
        {/* Search row */}
        <View style={styles.inputRow}>
          <Search size={16} color={colors.mutedForeground} style={{ flexShrink: 0 }} />
          <TextInput
            placeholder="What are you looking for?"
            placeholderTextColor={colors.mutedForeground}
            style={styles.inputField}
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={handleAddItem}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputDivider} />

        {/* Price row */}
        <View style={styles.inputRow}>
          <Text style={styles.currencyPrefix}>$</Text>
          <TextInput
            placeholder="Max budget (optional)"
            placeholderTextColor={colors.mutedForeground}
            style={styles.inputField}
            value={targetPrice}
            onChangeText={setTargetPrice}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={handleAddItem}
          />
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.trackBtn, (!url.trim() || addingItem) && styles.trackBtnDisabled]}
          onPress={handleAddItem}
          disabled={!url.trim() || addingItem}
          activeOpacity={0.85}
        >
          {addingItem ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.trackBtnText}>Track Item</Text>
              <ArrowRight size={16} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {addError ? (
        <Text style={styles.addError}>{addError}</Text>
      ) : successMsg ? (
        <Text style={styles.successMsg}>{successMsg}</Text>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListHeaderComponent={
            <>
              {watching.length > 0 && (
                <Text style={styles.sectionLabel}>Watching ({watching.length})</Text>
              )}
            </>
          }
          ListFooterComponent={
            bought.length > 0 ? (
              <View style={{ marginTop: spacing.xl }}>
                <Text style={[styles.sectionLabel, { marginBottom: spacing.md }]}>
                  Bought ({bought.length})
                </Text>
                {bought.map((item) => (
                  <View key={item.id} style={{ marginBottom: spacing.md }}>
                    <ItemCard item={item} onPress={(i) => navigation.navigate('ItemDetail', { item: i })} />
                  </View>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) =>
            item.status === 'watching' ? (
              <ItemCard item={item} onPress={(i) => navigation.navigate('ItemDetail', { item: i })} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No items yet. Add a product URL above.</Text>
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
  inputCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  inputDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  currencyPrefix: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.mutedForeground,
    flexShrink: 0,
  },
  inputField: {
    flex: 1,
    fontFamily: fonts.sansRegular,
    fontSize: 15,
    color: colors.foreground,
    paddingVertical: 0,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingVertical: 13,
    backgroundColor: colors.primary,
    borderRadius: 14,
  },
  trackBtnDisabled: {
    opacity: 0.4,
  },
  trackBtnText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: '#fff',
  },
  addError: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: '#ff6b6b',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  successMsg: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.dealGreen,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
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
