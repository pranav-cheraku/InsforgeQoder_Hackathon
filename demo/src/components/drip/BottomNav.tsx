import type { Tab } from "@/pages/Index";
import { Grid3X3, Tag, Clock, User } from "lucide-react";

const tabs: { id: Tab; label: string; icon: typeof Grid3X3 }[] = [
  { id: "wishlist", label: "Wishlist", icon: Grid3X3 },
  { id: "deals", label: "Deals", icon: Tag },
  { id: "activity", label: "Activity", icon: Clock },
  { id: "profile", label: "Profile", icon: User },
];

export const BottomNav = ({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) => {
  return (
    <div className="flex items-center justify-around py-2 px-4 border-t border-border bg-card">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className={`text-[10px] ${isActive ? "font-bold" : "font-normal"}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
