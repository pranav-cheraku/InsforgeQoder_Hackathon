import { useState } from "react";
import { Bell, Clock } from "lucide-react";
import type { WishlistItem } from "@/data/mockData";

type SubTab = "wishlist" | "deals" | "activity";

export const WishlistScreen = ({
  items,
  onSelectItem,
}: {
  items: WishlistItem[];
  onSelectItem: (item: WishlistItem) => void;
}) => {
  const [subTab, setSubTab] = useState<SubTab>("wishlist");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <span className="font-brand text-2xl font-extrabold text-primary tracking-tight">
          drip.
        </span>
        <div className="flex items-center gap-3">
          <button className="relative p-1">
            <Bell size={20} className="text-foreground" />
            <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-primary rounded-full text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              3
            </span>
          </button>
          <button className="p-1">
            <Clock size={20} className="text-foreground" />
          </button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-6 px-4 mt-2 border-b border-border">
        {(["wishlist", "deals", "activity"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`pb-2 text-sm font-semibold capitalize transition-colors relative ${
              subTab === tab ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {tab}
            {subTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full transition-all duration-200" />
            )}
          </button>
        ))}
      </div>

      {/* Add item input */}
      <div className="px-4 mt-4">
        <input
          type="text"
          placeholder="Add item or paste URL..."
          className="w-full bg-foreground text-primary-foreground placeholder:text-primary-foreground/50 rounded-pill px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
        />
      </div>

      {/* Watching label */}
      <div className="px-4 mt-5 mb-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          Watching ({items.length})
        </span>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => onSelectItem(item)}
            className="w-full flex items-center gap-3 bg-card border border-border rounded-card p-3 text-left hover:shadow-md transition-shadow animate-fade-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
          >
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-thumb bg-muted flex items-center justify-center text-2xl shrink-0">
              {item.image}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
            </div>
            {/* Price + trend */}
            <div className="text-right shrink-0">
              <p className={`font-mono text-sm font-bold ${item.trend === "deal" ? "text-primary" : "text-foreground"}`}>
                ${item.price}
              </p>
              <p className={`text-[11px] mt-0.5 font-medium ${
                item.trend === "low" ? "text-deal-green" : item.trend === "deal" ? "text-primary" : "text-muted-foreground"
              }`}>
                {item.trend === "low" && "↓ "}
                {item.trend === "deal" && "↑ "}
                {item.trend === "avg" && "≈ "}
                {item.trendLabel}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
