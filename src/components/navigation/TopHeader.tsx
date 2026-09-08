"use client";

import React from "react";
import Image from "next/image";
import { Settings, Zap, Award } from "lucide-react";
import { formatRubles, formatCompactRubles } from "@/lib/utils";
import { LEVELS } from "@/lib/constants";
import { triggerHaptic } from "@/lib/sound-fx";

interface TopHeaderProps {
  user: {
    username?: string | null;
    firstName?: string | null;
    balance: number;
    clickLevel: number;
    photoUrl?: string | null;
  };
  passiveIncomePerSec: number;
  onOpenSettings: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  user,
  passiveIncomePerSec,
  onOpenSettings,
}) => {
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const currentLevelConfig = LEVELS[(user.clickLevel || 1) - 1] || LEVELS[0];
  const displayName = user.username ? `@${user.username}` : user.firstName || "Тапер Labubu";

  return (
    <header className="w-full pt-3 pb-2 px-4 flex flex-col gap-2 z-20">
      {/* Top row: Profile & Settings */}
      <div className="flex items-center justify-between">
        {/* User profile capsule */}
        <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-full py-1.5 px-3 backdrop-blur-md">
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white/10 border border-white/20 shrink-0">
            {user.photoUrl && !avatarFailed ? (
              <img
                src={user.photoUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <Image
                src={currentLevelConfig.image}
                alt="Labubu Avatar"
                fill
                className="object-cover"
                sizes="32px"
              />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white/90 truncate max-w-[120px]">
              {displayName}
            </span>
            <div className="flex items-center gap-1">
              <span
                className="text-[10px] font-bold px-1.5 py-0.2 rounded-full text-black uppercase"
                style={{ backgroundColor: currentLevelConfig.themeColor }}
              >
                Ур. {user.clickLevel}
              </span>
              <span className="text-[10px] text-white/60 truncate max-w-[80px]">
                {currentLevelConfig.name.replace(" Labubu", "")}
              </span>
            </div>
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={() => {
            triggerHaptic("selection");
            onOpenSettings();
          }}
          className="btn-pressable w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10"
          aria-label="Настройки"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Main Balance Display */}
      <div className="flex flex-col items-center justify-center pt-1">
        <span className="text-xs tracking-wider uppercase text-white/50 font-medium">
          Баланс кошелька
        </span>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white/95 to-white/80 bg-clip-text text-transparent">
            {formatRubles(user.balance).replace(" ₽", "")}
          </span>
          <span className="text-2xl font-black text-brand-ruble">₽</span>
        </div>

        {/* Passive Income rate pill */}
        {passiveIncomePerSec > 0 && (
          <div className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium animate-pulse">
            <Zap size={11} className="fill-emerald-400" />
            <span>+{formatCompactRubles(passiveIncomePerSec)}/сек пассивно</span>
          </div>
        )}
      </div>
    </header>
  );
};
