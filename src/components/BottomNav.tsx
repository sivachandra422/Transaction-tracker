import React from "react";
import { Home, PieChart, Plus, Database, Sliders } from "lucide-react";

type TabId = "dashboard" | "add" | "rules" | "charts" | "notion" | "ai";

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const NAV_ITEMS = [
  { id: "dashboard" as TabId, icon: Home,     label: "Home"   },
  { id: "rules"     as TabId, icon: Sliders,  label: "Rules"  },
  { id: "add"       as TabId, icon: Plus,     label: "Add",  isFab: true },
  { id: "charts"    as TabId, icon: PieChart, label: "Charts" },
  { id: "notion"    as TabId, icon: Database, label: "Sync"   },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="flex-shrink-0 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/60 px-1 pb-1 pt-0 flex items-end justify-around z-30 relative">
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const Icon = item.icon;

        if (item.isFab) {
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-label={item.label}
              className="flex flex-col items-center -mt-4 cursor-pointer"
            >
              <div
                className={`w-13 h-13 rounded-full flex items-center justify-center shadow-lg ring-4 ring-white dark:ring-slate-950 transition-all ${
                  isActive
                    ? "bg-indigo-700 shadow-indigo-600/50"
                    : "bg-indigo-600 shadow-indigo-500/40 hover:bg-indigo-700 active:scale-95"
                }`}
                style={{ width: 52, height: 52 }}
              >
                <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span
                className={`text-[9px] font-bold mt-1 transition-colors ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
            className="flex flex-col items-center justify-end gap-0.5 py-2 px-3 min-w-[48px] min-h-[56px] cursor-pointer transition-colors group"
          >
            <div className="relative flex items-center justify-center">
              {isActive && (
                <span className="absolute inset-0 -m-2 rounded-full bg-indigo-50 dark:bg-indigo-950/50 transition-all" />
              )}
              <Icon
                className={`w-[22px] h-[22px] relative z-10 transition-colors ${
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </div>
            <span
              className={`text-[9px] font-semibold transition-colors ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
