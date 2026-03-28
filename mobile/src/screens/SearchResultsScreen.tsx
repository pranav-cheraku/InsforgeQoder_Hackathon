import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { searchProducts, createItem, type SearchResult } from '../api/client';
import { colors, fonts, radius, spacing } from '../theme/colors';
import type { WishlistStackParamList } from '../../App';

type RouteProps = RouteProp<WishlistStackParamList, 'SearchResults'>;
type NavProp = NativeStackNavigationProp<WishlistStackParamList, 'SearchResults'>;

export const SearchResultsScreen = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { query } = route.params;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const isUrl = query.startsWith('http://') || query.startsWith('https://');
    if (isUrl) {
      createItem(query, query)
        .then(() => navigation.navigate('WishlistMain'))
        .catch(() => navigation.navigate('WishlistMain'));
      return;
    }

    searchProducts(query)
      .then(setResults)
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query]);

  const handleAdd = async (result: SearchResult) => {
    setAdding(result.source_url);
    try {
      await createItem(result.name, result.source_url, result.price ?? undefined);
    } catch (e) {
      // ignore — item creation errors are non-fatal
    }
    navigation.navigate('WishlistMain');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>"{query}"</Text>
          <Text style={styles.headerSub}>
            {loading ? 'Searching...' : `${results.length} results`}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding best prices...</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found.</Text>
          <Text style={styles.emptySubtext}>Try a different search term.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, i) => `${item.source_url}-${i}`}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleAdd(item)}
              activeOpacity={0.7}
              disabled={adding !== null}
            >
              {/* Emoji */}
              <View style={styles.thumb}>
                <Text style={styles.thumbEmoji}>{item.image_emoji}</Text>
              </View>

              {/* Info */}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                {item.subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
                ) : null}
                <View style={styles.sourceBadge}>
                  <Text style={styles.sourceBadgeText}>{item.source_name}</Text>
                </View>
              </View>

              {/* Price + action */}
              <View style={styles.priceCol}>
                {item.price != null ? (
                  <Text style={styles.price}>${item.price}</Text>
                ) : (
                  <Text style={styles.priceMuted}>—</Text>
                )}
                {adding === item.source_url ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />
                ) : (
                  <Text style={styles.addLabel}>Add</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.foreground,
  },
  emptySubtext: {
    fontFamily: fonts.sansRegular,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
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
    gap: 4,
  },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.foreground,
  },
  subtitle: {
    fontFamily: fonts.sansRegular,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sourceBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.mutedForeground,
  },
  priceCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 4,
  },
  price: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  priceMuted: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.mutedForeground,
  },
  addLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.primary,
  },
});
