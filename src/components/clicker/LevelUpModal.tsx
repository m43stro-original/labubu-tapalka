"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { LEVELS } from "@/lib/constants";
import { playLevelUpSound, triggerHaptic } from "@/lib/sound-fx";
import { formatCompactRubles } from "@/lib/utils";

interface LevelUpModalProps {
  newLevel: number;
  onClose: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ newLevel, onClose }) => {
  const config = LEVELS[Math.min(newLevel - 1, LEVELS.length - 1)] || LEVELS[0];

  useEffect(() => {
    // Play celebratory sound & heavy haptic vibration
    playLevelUpSound();
    triggerHaptic("success");

    // Confetti fireworks
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ffd700", "#ff69b4", "#00ffff", "#00ff7f"],
      });
    } catch {}
  }, [newLevel]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ ease: [0.23, 1, 0.32, 1], duration: 0.3 }}
          className="relative w-full max-w-sm rounded-3xl p-6 bg-gradient-to-b from-[#1c1830] via-[#121622] to-[#0d1017] border-2 border-brand-gold/50 shadow-[0_0_80px_rgba(255,215,0,0.3)] flex flex-col items-center text-center"
        >
          {/* Top badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles size={14} />
            НОВЫЙ УРОВЕНЬ ЭВОЛЮЦИИ!
          </div>

          <h2 className="text-2xl font-black text-white mt-1">
            Уровень {newLevel}: {config.name}
          </h2>

          {/* Glowing character spotlight */}
          <div className="relative my-4 w-44 h-44 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-60 animate-pulse"
              style={{ backgroundColor: config.themeColor }}
            />
            <div className="relative w-36 h-36">
              <Image
                src={config.image}
                alt={config.name}
                fill
                priority
                className="object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.7)]"
              />
            </div>
          </div>

          <p className="text-xs text-white/70 px-2 mb-4 leading-relaxed">
            {config.description}
          </p>

          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 flex justify-around text-center mb-5">
            <div>
              <span className="text-[10px] text-white/40 uppercase block">Базовый клик</span>
              <span className="text-sm font-black text-amber-400">
                +{formatCompactRubles(config.baseClickPower)}
              </span>
            </div>
            <div className="w-[1px] bg-white/10" />
            <div>
              <span className="text-[10px] text-white/40 uppercase block">Новый цех</span>
              <span className="text-sm font-black text-emerald-400">
                Этаж {newLevel}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              triggerHaptic("medium");
              onClose();
            }}
            className="btn-pressable w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-gold to-amber-500 text-black font-extrabold text-sm tracking-wide shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} />
            Забрать награду и играть!
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
