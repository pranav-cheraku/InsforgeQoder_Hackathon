import type { WishlistItem } from "@/data/mockData";

export const DealsScreen = ({
  items,
  onSelectItem,
}: {
  items: WishlistItem[];
  onSelectItem: (item: WishlistItem) => void;
}) => {
  const deals = [...items]
    .map((item) => {
      const bestPrice = Math.min(...item.sources.map((s) => s.price));
      const pctBelow = Math.round(((item.avgPrice - bestPrice) / item.avgPrice) * 100);
      return { ...item, bestPrice, pctBelow };
    })
    .sort((a, b) => b.pctBelow - a.pctBelow);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-2 pb-3">
        <span className="font-brand text-2xl font-extrabold text-primary tracking-tight">drip.</span>
      </div>

      <div className="px-4 mb-3">
        <h2 className="text-lg font-semibold text-foreground">Top Deals</h2>
        <p className="text-xs text-muted-foreground">Sorted by savings vs. average price</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {deals.map((item, i) => (
          <button
            key={item.id}
            onClick={() => onSelectItem(item)}
            className="w-full flex items-center gap-3 bg-card border border-border rounded-card p-3 text-left hover:shadow-md transition-shadow animate-fade-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
          >
            <div className="w-14 h-14 rounded-thumb bg-muted flex items-center justify-center text-2xl shrink-0">
              {item.image}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
                {i === 0 && (
                  <span className="shrink-0 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-pill">
                    🔥 Hot deal
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm font-bold text-primary">${item.bestPrice}</p>
              <p className="text-[11px] text-deal-green font-medium">-{item.pctBelow}%</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
