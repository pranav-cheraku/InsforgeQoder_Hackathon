import { ChevronLeft, Check } from "lucide-react";
import { BarChart, Bar, XAxis, Cell, ResponsiveContainer } from "recharts";
import type { WishlistItem } from "@/data/mockData";

export const ItemDetailScreen = ({
  item,
  onBack,
}: {
  item: WishlistItem;
  onBack: () => void;
}) => {
  const chartData = item.priceHistory.map((val, i) => ({
    day: i,
    price: val,
    label: i === 0 ? "Mar 1" : i === 14 ? "Mar 14" : i === 29 ? "Today" : "",
  }));

  const bestSource = item.sources.find((s) => s.best);
  const savings = item.avgPrice - (bestSource?.price ?? item.price);

  return (
    <div className="flex flex-col h-full animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-2 pb-3">
        <button onClick={onBack} className="p-1 -ml-1">
          <ChevronLeft size={24} className="text-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base text-foreground truncate">{item.name}</h1>
          <p className="text-xs text-muted-foreground">Updated 2m ago</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Price stat cards */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "Best now", value: `$${bestSource?.price ?? item.price}`, color: "text-primary" },
            { label: "Avg price", value: `$${item.avgPrice}`, color: "text-foreground" },
            { label: "All-time low", value: `$${item.allTimeLow}`, color: "text-deal-green" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-card p-3 text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <p className={`font-mono text-lg font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Price chart */}
        <div className="mb-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">30-day price history</p>
          <div className="bg-card border border-border rounded-card p-3">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} barGap={1}>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "hsl(220, 9%, 46%)" }}
                  interval="preserveStartEnd"
                />
                <Bar dataKey="price" radius={[2, 2, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === chartData.length - 1 ? "hsl(351, 82%, 50%)" : "hsl(351, 82%, 90%)"}
                      className="origin-bottom"
                      style={{
                        animation: `bar-grow 0.4s ease-out ${i * 30}ms backwards`,
                        transformOrigin: "bottom",
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sources */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Prices across sources</p>
          </div>
          {savings > 0 && (
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-bold text-primary">Best deal found</span>
              <span className="text-sm font-bold text-primary">Save ${savings}</span>
            </div>
          )}
          <div className="space-y-0 bg-card border border-border rounded-card overflow-hidden">
            {item.sources.map((source, i) => (
              <div
                key={source.name}
                className={`flex items-center gap-3 px-3 py-3 ${i < item.sources.length - 1 ? "border-b border-border" : ""}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: source.dot }} />
                <span className="flex-1 text-sm text-foreground">{source.name}</span>
                <span className="font-mono text-sm font-medium text-foreground">${source.price}</span>
                {source.best && <Check size={16} className="text-deal-green ml-1" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
