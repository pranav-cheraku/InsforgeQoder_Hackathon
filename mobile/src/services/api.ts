import { insforge } from './insforge';
import type { WishlistItem, PricePoint, Transaction } from '../types';

export const api = {
  wishlist: {
    async getAll(userId: string): Promise<WishlistItem[]> {
      const { data, error } = await insforge.database
        .from('wishlist_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async add(item: Omit<WishlistItem, 'id' | 'created_at' | 'highest_price' | 'pending_reasoning'>): Promise<WishlistItem> {
      const { data, error } = await insforge.database
        .from('wishlist_items')
        .insert([{ ...item, current_price: item.current_price ?? 0, highest_price: 0 }])
        .select();
      if (error) throw error;
      return data![0];
    },

    async updateStatus(id: string, status: WishlistItem['status']) {
      const { error } = await insforge.database
        .from('wishlist_items')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },

    async updateTargetPrice(id: string, target_price: number) {
      const { error } = await insforge.database
        .from('wishlist_items')
        .update({ target_price })
        .eq('id', id);
      if (error) throw error;
    },

    async remove(id: string) {
      const { error } = await insforge.database
        .from('wishlist_items')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
  },

  buy: {
    async confirm(itemId: string) {
      const { data, error } = await insforge.functions.invoke('confirm-buy', {
        body: { item_id: itemId },
      });
      if (error) throw error;
      return data;
    },

    async skip(itemId: string) {
      const { error } = await insforge.database
        .from('wishlist_items')
        .update({ status: 'watching' })
        .eq('id', itemId);
      if (error) throw error;
    },
  },

  priceHistory: {
    async getForItem(itemId: string): Promise<PricePoint[]> {
      const { data, error } = await insforge.database
        .from('price_history')
        .select('*')
        .eq('item_id', itemId)
        .order('scraped_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  },

  transactions: {
    async getAll(userId: string): Promise<Transaction[]> {
      const { data, error } = await insforge.database
        .from('transactions')
        .select('*, wishlist_items(*)')
        .eq('user_id', userId)
        .order('decided_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  },

  agent: {
    async triggerScrape(itemId: string) {
      const { data, error } = await insforge.functions.invoke('price-scraper', {
        body: { item_id: itemId },
      });
      if (error) throw error;
      return data;
    },

    async triggerEvaluate(itemId: string) {
      const { data, error } = await insforge.functions.invoke('trading-agent', {
        body: { item_id: itemId },
      });
      if (error) throw error;
      return data;
    },
  },
};
