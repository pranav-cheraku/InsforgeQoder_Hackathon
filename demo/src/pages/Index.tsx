import { useState } from "react";
import { MobileShell } from "@/components/drip/MobileShell";
import { WishlistScreen } from "@/components/drip/WishlistScreen";
import { ItemDetailScreen } from "@/components/drip/ItemDetailScreen";
import { ActivityScreen } from "@/components/drip/ActivityScreen";
import { DealsScreen } from "@/components/drip/DealsScreen";
import { BottomNav } from "@/components/drip/BottomNav";
import { wishlistItems, type WishlistItem } from "@/data/mockData";

export type Tab = "wishlist" | "deals" | "activity" | "profile";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("wishlist");
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);

  const handleBack = () => setSelectedItem(null);

  return (
    <MobileShell>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          {selectedItem ? (
            <ItemDetailScreen item={selectedItem} onBack={handleBack} />
          ) : activeTab === "wishlist" ? (
            <WishlistScreen items={wishlistItems} onSelectItem={setSelectedItem} />
          ) : activeTab === "deals" ? (
            <DealsScreen items={wishlistItems} onSelectItem={setSelectedItem} />
          ) : activeTab === "activity" ? (
            <ActivityScreen />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Profile coming soon
            </div>
          )}
        </div>
        {!selectedItem && (
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        )}
      </div>
    </MobileShell>
  );
};

export default Index;
