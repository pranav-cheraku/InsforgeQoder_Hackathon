const API_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export interface ApiSource {
  source_name: string;
  source_url: string;
  price: number;
  availability: string;
  is_suspicious: boolean;
  scraped_at: string;
}

export interface ApiItem {
  id: string;
  name: string;
  subtitle: string;
  url: string | null;
  target_price: number | null;
  image_emoji: string;
  created_at: string;
  sources: ApiSource[];
  best_price: number | null;
  avg_price: number | null;
  trend: 'low' | 'deal' | 'avg';
  trend_label: string;
}

export interface ApiAlert {
  id: string;
  item_id: string;
  alert_type: string;
  message: string;
  price: number | null;
  source_name: string;
  source_url: string;
  requires_permission: boolean;
  dismissed: boolean;
  created_at: string;
}

export interface OrderConfirmation {
  order_id: string;
  confirmed: boolean;
  item_name: string;
  price: number;
  source: string;
  estimated_delivery: string;
}

export interface HistoryEntry {
  id: string;
  price: number | null;
  availability: string;
  scraped_at: string;
}

export const SOURCE_COLORS: Record<string, string> = {
  Amazon: '#F59E0B',
  eBay: '#3B82F6',
  'Best Buy': '#EAB308',
  Direct: '#6366F1',
};

export function sourceColor(name: string): string {
  return SOURCE_COLORS[name] ?? '#888888';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function getItems(): Promise<ApiItem[]> {
  return request<ApiItem[]>('/items');
}

export function createItem(name: string, url?: string, target_price?: number): Promise<ApiItem> {
  return request<ApiItem>('/items', {
    method: 'POST',
    body: JSON.stringify({ name, url: url ?? null, target_price: target_price ?? null }),
  });
}

export function deleteItem(id: string): Promise<void> {
  return request<void>(`/items/${id}`, { method: 'DELETE' });
}

export function scanItem(id: string): Promise<ApiItem> {
  return request<ApiItem>(`/items/${id}/scan`, { method: 'POST' });
}

export function getAlerts(): Promise<ApiAlert[]> {
  return request<ApiAlert[]>('/alerts');
}

export function dismissAlert(id: string): Promise<void> {
  return request<void>(`/alerts/${id}/dismiss`, { method: 'POST' });
}

export function approveAlert(id: string): Promise<OrderConfirmation> {
  return request<OrderConfirmation>(`/alerts/${id}/approve`, { method: 'POST' });
}

export function getPriceHistory(itemId: string): Promise<Record<string, HistoryEntry[]>> {
  return request<Record<string, HistoryEntry[]>>(`/prices/${itemId}/history`);
}

export interface SearchResult {
  name: string;
  subtitle: string;
  image_emoji: string;
  price: number | null;
  source_name: string;
  source_url: string;
}

export function searchProducts(query: string): Promise<SearchResult[]> {
  return request<SearchResult[]>('/search', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}
