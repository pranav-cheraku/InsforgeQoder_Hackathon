export interface Source {
  name: string;
  price: number;
  dot: string;
  best: boolean;
}

export interface WishlistItem {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  trend: 'low' | 'deal' | 'avg';
  trendLabel: string;
  trendValue?: string;
  image: string;
  avgPrice: number;
  allTimeLow: number;
  sources: Source[];
  priceHistory: number[];
}

export const wishlistItems: WishlistItem[] = [
  {
    id: '1',
    name: 'Nike Air Max 90',
    subtitle: 'Size 10 · Black',
    price: 89,
    trend: 'low',
    trendLabel: 'Low $72',
    trendValue: '$72',
    image: '👟',
    avgPrice: 110,
    allTimeLow: 72,
    sources: [
      { name: 'Amazon', price: 89, dot: '#F59E0B', best: true },
      { name: 'Nike.com', price: 120, dot: '#111', best: false },
      { name: 'Foot Locker', price: 110, dot: '#DC2626', best: false },
      { name: 'StockX', price: 95, dot: '#22C55E', best: false },
    ],
    priceHistory: [112,115,110,108,112,115,118,116,112,108,105,102,100,98,95,98,100,102,99,96,94,92,90,91,93,90,89,88,89,89],
  },
  {
    id: '2',
    name: 'MacBook Air M3',
    subtitle: '13" · 16GB',
    price: 979,
    trend: 'deal',
    trendLabel: 'Deal now',
    image: '💻',
    avgPrice: 1099,
    allTimeLow: 899,
    sources: [
      { name: 'Amazon', price: 979, dot: '#F59E0B', best: true },
      { name: 'eBay (new)', price: 1029, dot: '#3B82F6', best: false },
      { name: 'Apple Store', price: 1099, dot: '#374151', best: false },
      { name: 'Best Buy', price: 1049, dot: '#EAB308', best: false },
    ],
    priceHistory: [1099,1099,1089,1079,1085,1090,1095,1099,1089,1079,1069,1059,1049,1039,1029,1019,1015,1010,1005,999,995,990,989,985,982,980,979,979,979,979],
  },
  {
    id: '3',
    name: 'Fender Strat MX',
    subtitle: 'Sunburst · Used',
    price: 340,
    trend: 'low',
    trendLabel: 'Low $290',
    trendValue: '$290',
    image: '🎸',
    avgPrice: 399,
    allTimeLow: 290,
    sources: [
      { name: 'Reverb', price: 340, dot: '#F97316', best: false },
      { name: 'eBay', price: 295, dot: '#3B82F6', best: true },
      { name: 'Guitar Center', price: 399, dot: '#DC2626', best: false },
      { name: 'Sweetwater', price: 379, dot: '#6366F1', best: false },
    ],
    priceHistory: [399,395,390,385,380,378,375,370,368,365,360,358,355,352,350,348,345,342,340,340,338,335,332,330,328,325,320,310,300,295],
  },
  {
    id: '4',
    name: 'Sony WH-1000XM5',
    subtitle: 'Black · New',
    price: 278,
    trend: 'avg',
    trendLabel: 'Avg',
    image: '🎧',
    avgPrice: 280,
    allTimeLow: 228,
    sources: [
      { name: 'Amazon', price: 278, dot: '#F59E0B', best: true },
      { name: 'Best Buy', price: 279, dot: '#EAB308', best: false },
      { name: 'Sony Store', price: 299, dot: '#111', best: false },
      { name: 'Target', price: 289, dot: '#DC2626', best: false },
    ],
    priceHistory: [290,288,285,282,280,278,276,275,278,280,282,285,283,280,278,276,278,280,282,280,278,276,278,280,278,276,278,278,278,278],
  },
];

export const activityItems = [
  {
    id: 'a1',
    dot: 'red' as const,
    title: 'Nike Air Max 90',
    description: 'dropped to $89 on Amazon — down 12% from last week',
    time: '12 min ago',
  },
  {
    id: 'a2',
    dot: 'green' as const,
    title: 'Fender Strat MX',
    description: 'new eBay listing at $295, below your target of $310',
    time: '1 hour ago',
  },
  {
    id: 'a3',
    dot: 'gray' as const,
    title: 'MacBook Air M3',
    description: 'price stable at $979 for 3 days. Watching for further drops.',
    time: '3 hours ago',
  },
  {
    id: 'a4',
    dot: 'gray' as const,
    title: 'Sony WH-1000XM5',
    description: 'Added to watchlist. Scanning 6 sources.',
    time: 'Yesterday',
  },
];
