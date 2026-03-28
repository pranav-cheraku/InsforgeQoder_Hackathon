export interface WishlistItem {
  id: string;
  user_id: string;
  product_url: string;
  product_name: string | null;
  retailer: string | null;
  image_url: string | null;
  target_price: number;
  current_price: number;
  highest_price: number;
  status: 'watching' | 'bought' | 'paused';
  created_at: string;
}

export interface PricePoint {
  id: string;
  item_id: string;
  price: number;
  retailer: string | null;
  scraped_at: string;
}

export interface Transaction {
  id: string;
  item_id: string;
  user_id: string;
  buy_price: number;
  market_price: number | null;
  saved_amount: number;
  reasoning: string | null;
  decided_at: string;
  wishlist_items?: WishlistItem;
}
