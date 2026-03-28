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
import { Bell, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ItemCard } from '../components/ItemCard';
import { colors, fonts, spacing } from '../theme/colors';
import type { WishlistStackParamList } from '../../App';
import type { WishlistItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

type NavProp = NativeStackNavigationProp<WishlistStackParamList, 'WishlistMain'>;

export const WishlistScreen = () => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [addingItem, setAddingItem] = useState(false);
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

  const handleAddItem = async () => {
    const text = url.trim();
    if (!text || !user) return;

    const isUrl = text.startsWith('http://') || text.startsWith('https://');
    if (!isUrl) {
      // Non-URL: navigate to search
      setUrl('');
      navigation.navigate('SearchResults', { query: text });
      return;
    }

    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) return;
    setAddingItem(true);
    try {
      await api.wishlist.add({
        user_id: user.id,
        product_url: text,
        product_name: null,
        retailer: null,
        image_url: null,
        target_price: price,
        status: 'watching',
      });
      setUrl('');
      setTargetPrice('');
      await loadItems();
    } catch (e) {
      console.error('Failed to add item:', e);
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

      {/* Add item input */}
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Search or paste URL..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={[styles.input, styles.inputUrl]}
          value={url}
          onChangeText={setUrl}
          onSubmitEditing={handleAddItem}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          placeholder="Target $"
          placeholderTextColor="rgba(255,255,255,0.5)"
          style={[styles.input, styles.inputPrice]}
          value={targetPrice}
          onChangeText={setTargetPrice}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={[styles.addBtn, (!url.trim() || !targetPrice) && styles.addBtnDisabled]}
          onPress={handleAddItem}
          disabled={!url.trim() || !targetPrice || addingItem}
        >
          {addingItem ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Plus size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

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
  inputWrapper: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
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
  inputUrl: {
    flex: 1,
  },
  inputPrice: {
    width: 80,
    textAlign: 'center',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
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
