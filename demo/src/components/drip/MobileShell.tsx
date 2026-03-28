import { ReactNode } from "react";

export const MobileShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50 p-4">
      <div className="relative w-full max-w-[390px] h-[844px] bg-card rounded-shell shadow-2xl overflow-hidden flex flex-col border border-border">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-foreground">
          <span className="text-sm font-semibold">9:41</span>
          <div className="flex items-center gap-1">
            <div className="flex gap-[3px] items-end">
              <div className="w-[3px] h-[4px] bg-foreground rounded-[1px]" />
              <div className="w-[3px] h-[6px] bg-foreground rounded-[1px]" />
              <div className="w-[3px] h-[8px] bg-foreground rounded-[1px]" />
              <div className="w-[3px] h-[10px] bg-foreground rounded-[1px]" />
            </div>
            <span className="text-xs ml-1">5G</span>
            <svg className="w-6 h-3 ml-1" viewBox="0 0 25 12"><rect x="0" y="1" width="21" height="10" rx="2" stroke="currentColor" strokeWidth="1" fill="none"/><rect x="22" y="4" width="2" height="4" rx="1" fill="currentColor"/><rect x="2" y="3" width="17" height="6" rx="1" fill="currentColor"/></svg>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
        {/* Home Indicator */}
        <div className="flex justify-center pb-2 pt-1">
          <div className="w-[134px] h-[5px] bg-foreground/20 rounded-full" />
        </div>
      </div>
    </div>
  );
};
