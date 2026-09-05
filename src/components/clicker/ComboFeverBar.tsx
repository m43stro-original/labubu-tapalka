"use client";

import React from "react";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";

interface ComboFeverBarProps {
  comboProgress: number; // 0 to 100
  isFever: boolean;
  feverTimeLeft: number; // seconds
}

export const ComboFeverBar: React.FC<ComboFeverBarProps> = ({
  comboProgress,
  isFever,
  feverTimeLeft,
}) => {
  return (
    <div className="w-full max-w-xs mx-auto px-4 flex flex-col items-center">
      <div className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider mb-1">
        <div className="flex items-center gap-1">
          <Flame
            size={14}
            className={`${
              isFever
                ? "text-orange-500 animate-bounce fill-orange-500"
                : comboProgress > 40
                ? "text-amber-400"
                : "text-white/40"
            }`}
          />
          <span
            className={
              isFever
                ? "text-amber-400 font-extrabold animate-pulse"
                : comboProgress > 50
                ? "text-amber-300"
                : "text-white/50"
            }
          >
            {isFever ? "БОНУС КОМБО (+25%)" : "Комбо Кликов"}
          </span>
        </div>
        <span className={isFever ? "text-amber-400 font-black" : "text-white/60"}>
          {isFever ? `${feverTimeLeft.toFixed(1)} сек` : `${Math.floor(comboProgress)}%`}
        </span>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-white/10 p-[1px]">
        <motion.div
          className={`h-full rounded-full ${
            isFever
              ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
              : "bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400"
          }`}
          style={{
            width: isFever ? `${(feverTimeLeft / 5) * 100}%` : `${comboProgress}%`,
          }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
      </div>
    </div>
  );
};
