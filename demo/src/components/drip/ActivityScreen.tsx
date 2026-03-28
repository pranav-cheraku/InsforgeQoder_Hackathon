import { useState } from "react";
import { MapPin, CheckCircle } from "lucide-react";
import { activityItems } from "@/data/mockData";

const dotColors = { red: "bg-primary", green: "bg-deal-green", gray: "bg-dot-gray" };

export const ActivityScreen = () => {
  const [agentState, setAgentState] = useState<"pending" | "bought" | "skipped">("pending");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-3">
        <span className="font-brand text-2xl font-extrabold text-primary tracking-tight">drip.</span>
        <MapPin size={20} className="text-foreground" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Agent permission card */}
        {agentState === "pending" && (
          <div className="bg-bg-alert border border-primary/10 rounded-card p-4 mb-5 animate-fade-up">
            <p className="text-sm font-bold text-primary mb-2">Agent wants to buy</p>
            <p className="text-sm text-foreground leading-relaxed">
              Sony WH-1000XM5 hit your target price of <strong>$249</strong> on eBay (new, free shipping). 
              This is the lowest price in 90 days. Shall I complete the purchase?
            </p>
            <p className="text-xs text-muted-foreground mt-2">$249 · eBay · Ships in 2 days</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setAgentState("skipped")}
                className="flex-1 py-2.5 rounded-pill border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => setAgentState("bought")}
                className="flex-1 py-2.5 rounded-pill bg-primary text-primary-foreground text-sm font-semibold shadow-md animate-pulse-buy hover:opacity-90 transition-opacity"
              >
                Buy now
              </button>
            </div>
          </div>
        )}

        {agentState === "bought" && (
          <div className="bg-deal-green/10 border border-deal-green/20 rounded-card p-4 mb-5 animate-fade-up flex items-center gap-3">
            <CheckCircle size={24} className="text-deal-green shrink-0" />
            <div>
              <p className="text-sm font-bold text-deal-green">Order placed</p>
              <p className="text-xs text-muted-foreground">Confirmation sent.</p>
            </div>
          </div>
        )}

        {/* Recent activity */}
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium mb-3">
          Recent Activity
        </p>
        <div className="space-y-3">
          {activityItems.map((item, i) => (
            <div
              key={item.id}
              className="flex gap-3 animate-fade-up"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
            >
              <div className="pt-1.5 shrink-0">
                <span
                  className={`block w-2.5 h-2.5 rounded-full ${dotColors[item.dot]}`}
                  style={{ animation: `dot-pulse 1.5s ease-in-out ${i * 200}ms infinite` }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{item.title}</span>{" "}
                  <span className="text-muted-foreground">{item.description}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
