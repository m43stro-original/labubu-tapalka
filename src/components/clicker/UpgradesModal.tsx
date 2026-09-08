"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, ArrowUpCircle, BatteryCharging } from "lucide-react";
import { formatRubles, formatCompactRubles } from "@/lib/utils";
import { triggerHaptic, playCoinSound } from "@/lib/sound-fx";
import { getClickPowerCost, getMaxEnergyCost, getEnergyRegenCost } from "@/lib/game-engine";

interface UpgradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    balance: number;
    clickLevel: number;
    clickUpgrade: number;
    clickPower: number;
    energy: number;
    maxEnergy: number;
    energyRegen: number;
  };
  onUpgrade: (type: "click_power" | "max_energy" | "energy_regen" | "level_up") => Promise<void>;
}

export const UpgradesModal: React.FC<UpgradesModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpgrade,
}) => {
  const [loadingType, setLoadingType] = useState<string | null>(null);

  if (!isOpen) return null;

  // Cost calculations
  const clickPowerCost = getClickPowerCost(user.clickUpgrade);
  const maxEnergyLevel = Math.floor((user.maxEnergy - 500) / 200) + 1;
  const maxEnergyCost = getMaxEnergyCost(maxEnergyLevel);
  const energyRegenLevel = Math.floor(user.energyRegen - 3) + 1;
  const energyRegenCost = getEnergyRegenCost(energyRegenLevel);

  const handleBuy = async (type: "click_power" | "max_energy" | "energy_regen" | "level_up") => {
    try {
      setLoadingType(type);
      triggerHaptic("medium");
      await onUpgrade(type);
      playCoinSound();
    } catch {
      triggerHaptic("error");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80">
        {/* Backdrop click dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* High-performance Drawer without backdrop blur choke */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#141a27] border-t border-white/20 rounded-t-3xl p-5 shadow-2xl flex flex-col gap-4 pb-12 will-change-transform"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap size={18} className="text-brand-ruble fill-brand-ruble" />
                Прокачка характеристик
              </h2>
              <p className="text-xs text-white/50">Увеличивай доход за тап, максимальную энергию и реген</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Upgrade Items List */}
          <div className="flex flex-col gap-2.5">
            {/* 1. Click Power */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Zap size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Сила клика</h4>
                  <p className="text-xs text-white/60">
                    Текущая: <span className="text-amber-300 font-bold">+{user.clickPower} ₽</span> (Ур. {user.clickUpgrade})
                  </p>
                </div>
              </div>
              <button
                disabled={user.balance < clickPowerCost || loadingType === "click_power"}
                onClick={() => handleBuy("click_power")}
                className={`btn-pressable px-3.5 py-2 rounded-xl text-xs font-bold ${
                  user.balance >= clickPowerCost
                    ? "bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                {loadingType === "click_power" ? "..." : formatRubles(clickPowerCost)}
              </button>
            </div>

            {/* 2. Max Energy */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <BatteryCharging size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Запас энергии</h4>
                  <p className="text-xs text-white/60">
                    Максимум: <span className="text-cyan-300 font-bold">{user.maxEnergy}</span> (+200)
                  </p>
                </div>
              </div>
              <button
                disabled={user.balance < maxEnergyCost || loadingType === "max_energy"}
                onClick={() => handleBuy("max_energy")}
                className={`btn-pressable px-3.5 py-2 rounded-xl text-xs font-bold ${
                  user.balance >= maxEnergyCost
                    ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-md shadow-cyan-500/20"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                {loadingType === "max_energy" ? "..." : formatRubles(maxEnergyCost)}
              </button>
            </div>

            {/* 3. Energy Regen */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <ArrowUpCircle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Скорость регена</h4>
                  <p className="text-xs text-white/60">
                    Восстановление: <span className="text-emerald-300 font-bold">+{user.energyRegen}/сек</span> (+1)
                  </p>
                </div>
              </div>
              <button
                disabled={user.balance < energyRegenCost || loadingType === "energy_regen"}
                onClick={() => handleBuy("energy_regen")}
                className={`btn-pressable px-3.5 py-2 rounded-xl text-xs font-bold ${
                  user.balance >= energyRegenCost
                    ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-500/20"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                {loadingType === "energy_regen" ? "..." : formatRubles(energyRegenCost)}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
