"use client";

import React from "react";
import { motion } from "framer-motion";
import { Coins, Factory, Swords, Trophy, Users, LucideIcon } from "lucide-react";
import { triggerHaptic } from "@/lib/sound-fx";

export type NavTab = "clicker" | "factory" | "duels" | "leaderboard" | "social";

interface BottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: LucideIcon }[] = [
  { id: "clicker", label: "Кликер", icon: Coins },
  { id: "factory", label: "Фабрика", icon: Factory },
  { id: "duels", label: "Дуэли", icon: Swords },
  { id: "leaderboard", label: "Лидеры", icon: Trophy },
  { id: "social", label: "Друзья", icon: Users },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 pb-safe px-3 py-2 bg-[#090c10]/85 backdrop-blur-2xl border-t border-white/10">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (!isActive) {
                  triggerHaptic("selection");
                  onChangeTab(item.id);
                }
              }}
              className="relative flex flex-col items-center justify-center py-1 px-3.5 rounded-xl transition-colors duration-150"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-white/10 rounded-xl border border-white/15 shadow-sm"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                />
              )}
              <div
                className={`relative z-10 transition-transform duration-150 ${
                  isActive ? "scale-110 text-brand-ruble" : "text-white/40"
                }`}
              >
                <Icon size={21} />
              </div>
              <span
                className={`relative z-10 text-[10px] font-medium tracking-tight mt-0.5 transition-colors duration-150 ${
                  isActive ? "text-white font-semibold" : "text-white/40"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
