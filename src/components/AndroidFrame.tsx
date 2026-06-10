import React, { useState, useEffect } from "react";
import { Wifi, Battery, Signal, ArrowLeft } from "lucide-react";

interface AndroidFrameProps {
  children: React.ReactNode;
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  actions?: React.ReactNode;
  theme?: "light" | "dark";
  bottomNav?: React.ReactNode;
}

export default function AndroidFrame({ children, title, onBack, showBack = false, actions, theme = "light", bottomNav }: AndroidFrameProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`min-h-screen bg-slate-900 flex items-center justify-center p-0 sm:p-6 font-sans transition-colors duration-200 ${theme}`}>
      {/* Phone Silhouette Frame */}
      <div className="w-full sm:w-[412px] sm:h-[860px] sm:rounded-[40px] sm:border-[8px] sm:border-slate-800 bg-slate-50 dark:bg-[#0b121f] flex flex-col relative overflow-hidden sm:shadow-2xl transition-colors duration-200">
        {/* Dynamic Notch */}
        <div className="hidden sm:block absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-50"></div>

        {/* Top Android Status Bar */}
        <div className="bg-[#1e293b] dark:bg-[#080d19] text-slate-200 dark:text-slate-400 px-6 py-2 pb-1.5 flex justify-between items-center text-xs font-semibold select-none z-40 relative border-b border-white/5 transition-colors">
          <span>{time}</span>
          <div className="flex items-center gap-1.5">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-1">
              <span className="text-[10px]">84%</span>
              <Battery className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
            </div>
          </div>
        </div>

        {/* Action Header bar */}
        <div className="bg-slate-950 dark:bg-[#040711] text-white px-4 py-4 flex items-center justify-between shadow-md z-30 select-none transition-colors">
          <div className="flex items-center gap-3">
            {showBack ? (
              <button 
                onClick={onBack}
                id="header-back-btn" 
                className="p-1 rounded-full hover:bg-slate-800/80 transition-colors cursor-pointer text-slate-100"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            ) : (
              // Empty space to equalize alignment or clean Android branding
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            )}
            <h1 className="text-lg font-bold tracking-tight text-white">{title}</h1>
          </div>
          <div className="flex items-center gap-1">
            {actions}
          </div>
        </div>

        {/* App Center Stage Viewer */}
        <div id="android-app-viewport" className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0b121f] flex flex-col relative transition-colors duration-200">
          {children}
        </div>

        {/* App-level bottom navigation (rendered outside the scroll area) */}
        {bottomNav}

        {/* Bottom Material Touch navigation pill */}
        <div className="bg-slate-950 dark:bg-[#040711] text-slate-400 py-3 px-12 flex justify-between items-center select-none border-t border-slate-900 dark:border-white/5 z-40 transition-colors">
          <button id="android-nav-back" onClick={onBack} disabled={!showBack} className={`p-1 hover:text-white transition-colors ${!showBack ? 'opacity-30' : 'cursor-pointer'}`}>
            <svg className="w-5 h-5 fill-current transform rotate-180" viewBox="0 0 24 24">
              <path d="M8.02 22L18 12L8.02 2l-1.42 1.41L15.17 12l-8.57 8.59z" />
            </svg>
          </button>
          
          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 hover:border-white transition-colors cursor-pointer"></div>
          
          <div className="w-3 h-3 bg-slate-400 rounded-sm hover:bg-white transition-colors cursor-pointer"></div>
        </div>
      </div>
    </div>
  );
}
