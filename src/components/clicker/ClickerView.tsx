"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Zap, Sparkles, ArrowRight } from "lucide-react";
import { ClickerCircle } from "./ClickerCircle";
import { ComboFeverBar } from "./ComboFeverBar";
import { FloatingNumbers, FloatingItem } from "./FloatingNumber";
import { UpgradesModal } from "./UpgradesModal";
import { LevelUpModal } from "./LevelUpModal";
import { formatRubles, formatCompactRubles } from "@/lib/utils";
import { CRIT_MULTIPLIER, FEVER_MULTIPLIER, LEVELS } from "@/lib/constants";
import { triggerHaptic } from "@/lib/sound-fx";

interface ClickerViewProps {
  user: any;
  onRefreshUser: (updatedUser?: any) => void;
  onTapEarned: (earned: number, newEnergy: number) => void;
}

export const ClickerView: React.FC<ClickerViewProps> = ({
  user,
  onRefreshUser,
  onTapEarned,
}) => {
  const [floatingItems, setFloatingItems] = useState<FloatingItem[]>([]);

  // Balanced Combo state (requires sustained clicks, +25% bonus)
  const [comboCount, setComboCount] = useState(0);
  const [isFever, setIsFever] = useState(false);
  const [feverTimeLeft, setFeverTimeLeft] = useState(0);

  // Modals
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);
  const [newLevelCelebration, setNewLevelCelebration] = useState<number | null>(null);

  // Sync batching
  const pendingTapsRef = useRef(0);
  const nextFloatingIdRef = useRef(1);
  const isSyncingRef = useRef(false);

  const userRef = useRef(user);
  userRef.current = user;

  const isFeverRef = useRef(isFever);
  isFeverRef.current = isFever;

  const onRefreshUserRef = useRef(onRefreshUser);
  onRefreshUserRef.current = onRefreshUser;

  // Next level evolution info
  const nextLevelIndex = user.clickLevel; // 1-based level, index in 0-based LEVELS array is current clickLevel
  const hasNextLevel = nextLevelIndex < LEVELS.length;
  const nextLevelConfig = hasNextLevel ? LEVELS[nextLevelIndex] : null;

  // Combo decay ticker & Fever countdown
  useEffect(() => {
    const comboInterval = setInterval(() => {
      if (isFever) {
        setFeverTimeLeft((prev) => {
          if (prev <= 0.1) {
            setIsFever(false);
            setComboCount(0);
            return 0;
          }
          return prev - 0.1;
        });
      } else {
        setComboCount((prev) => Math.max(0, prev - 1.5));
      }
    }, 100);

    return () => clearInterval(comboInterval);
  }, [isFever]);

  // Flush pending taps to server
  const flushTaps = React.useCallback(async () => {
    if (pendingTapsRef.current <= 0 || isSyncingRef.current) return;
    const tapsToSync = pendingTapsRef.current;
    pendingTapsRef.current = 0;
    isSyncingRef.current = true;

    try {
      const res = await fetch("/api/tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: userRef.current.telegramId,
          tapCount: tapsToSync,
          isFever: isFeverRef.current,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Reconcile server balance
        onRefreshUserRef.current({
          ...userRef.current,
          balance: data.balance,
          energy: data.energy,
        });
      } else {
        // Restore taps if sync was rejected by server
        pendingTapsRef.current += tapsToSync;
      }
    } catch (err) {
      pendingTapsRef.current += tapsToSync;
      console.error("Failed to sync taps:", err);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Sync pending taps to server periodically and reliably on unmount or tab switch
  useEffect(() => {
    const syncInterval = setInterval(flushTaps, 800);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushTaps();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", flushTaps);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", flushTaps);
      flushTaps();
    };
  }, [flushTaps]);

  // Handle tap on center circle
  const handleTap = (clientX: number, clientY: number, isCrit: boolean) => {
    if (user.energy < 1) {
      triggerHaptic("warning");
      return;
    }

    // Deduct energy & grant rubles
    const tapPower = user.clickPower;
    const multiplier = (isCrit ? CRIT_MULTIPLIER : 1) * (isFever ? FEVER_MULTIPLIER : 1);
    const earned = Math.round(tapPower * multiplier);
    const newEnergy = Math.max(0, user.energy - 1);

    // Update parent immediately in 0ms!
    onTapEarned(earned, newEnergy);
    pendingTapsRef.current += 1;

    // Immediately flush if batch reaches 8 taps
    if (pendingTapsRef.current >= 8) {
      flushTaps();
    }

    // Spawn floating number
    const newItem: FloatingItem = {
      id: nextFloatingIdRef.current++,
      x: clientX,
      y: clientY,
      text: isCrit ? `КРИТ! +${earned} ₽` : `+${earned} ₽`,
      isCrit,
    };
    setFloatingItems((prev) => [...prev.slice(-15), newItem]);

    // Increase combo
    if (!isFever) {
      setComboCount((prev) => {
        const next = prev + 2;
        if (next >= 100) {
          setIsFever(true);
          setFeverTimeLeft(5); // 5 seconds balanced duration
          triggerHaptic("heavy");
          return 100;
        }
        return next;
      });
    }
  };

  const handleUpgrade = async (type: "click_power" | "max_energy" | "energy_regen" | "level_up") => {
    const res = await fetch("/api/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId: user.telegramId,
        upgradeType: type,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Upgrade failed");
    }

    if (type === "level_up") {
      setNewLevelCelebration(data.user.clickLevel);
    }

    onRefreshUser(data.user);
  };

  return (
    <div className="relative flex-1 flex flex-col items-center gap-3 pb-36 pt-1 px-4 select-none overflow-y-auto w-full max-w-md mx-auto touch-pan-y">
      {/* Floating numbers container */}
      <FloatingNumbers
        items={floatingItems}
        onRemove={(id) => setFloatingItems((prev) => prev.filter((i) => i.id !== id))}
      />

      {/* Combo / Fever Meter */}
      <div className="w-full">
        <ComboFeverBar
          comboProgress={comboCount}
          isFever={isFever}
          feverTimeLeft={feverTimeLeft}
        />
      </div>

      {/* Center Interactive Tap Area */}
      <div className="w-full flex flex-col items-center justify-center my-0.5">
        <ClickerCircle
          level={user.clickLevel}
          isFever={isFever}
          onTap={handleTap}
          disabled={user.energy < 1}
        />

        {/* Tap Power Indicator */}
        <div className="flex items-center gap-1.5 text-xs text-white/60 mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
          <span>Сила тапа:</span>
          <span className="font-bold text-brand-ruble">
            +{Math.round(user.clickPower * (isFever ? FEVER_MULTIPLIER : 1))} ₽
          </span>
          {isFever && <span className="text-amber-400 font-extrabold">(+25%)</span>}
        </div>
      </div>

      {/* Middle Section: Dedicated Evolution Progress Card */}
      {nextLevelConfig ? (
        <div className="w-full max-w-sm my-2 glass-panel rounded-2xl p-3 flex flex-col gap-2 border border-pink-500/30 bg-gradient-to-r from-pink-950/25 via-[#131722] to-purple-950/25 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0">
                <Image
                  src={nextLevelConfig.image}
                  alt={nextLevelConfig.name}
                  fill
                  className="object-contain"
                  sizes="32px"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-white text-xs">
                  {nextLevelConfig.name} (Ур. {nextLevelConfig.level})
                </span>
                <span className="text-[10px] text-white/50">
                  До следующей эволюции
                </span>
              </div>
            </div>
            <span className="text-xs font-black text-brand-gold">
              {formatRubles(nextLevelConfig.minBalanceToUnlock)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-amber-400 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (user.balance / nextLevelConfig.minBalanceToUnlock) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] font-black text-white/80 whitespace-nowrap">
              {Math.min(100, Math.floor((user.balance / nextLevelConfig.minBalanceToUnlock) * 100))}%
            </span>
          </div>

          {/* Evolution action / remaining info */}
          <div className="flex items-center justify-between pt-0.5 text-[11px]">
            {user.balance >= nextLevelConfig.minBalanceToUnlock ? (
              <button
                onClick={() => {
                  triggerHaptic("heavy");
                  handleUpgrade("level_up");
                }}
                className="btn-pressable w-full py-2 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white font-extrabold text-xs shadow-md shadow-pink-500/30 animate-pulse flex items-center justify-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>Эволюционировать прямо сейчас!</span>
              </button>
            ) : (
              <span className="text-white/60 text-[10px]">
                Осталось: <strong className="text-pink-300">{formatRubles(nextLevelConfig.minBalanceToUnlock - user.balance)}</strong>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm my-2 glass-panel rounded-2xl p-2.5 text-center text-xs font-bold text-pink-400 border border-pink-500/20">
          👑 Достигнут максимальный уровень Лабубу (7/7)!
        </div>
      )}

      {/* Bottom Section: Energy & Dedicated Upgrades Button */}
      <div className="w-full max-w-sm flex flex-col gap-2.5">
        {/* Energy Status Card */}
        <div className="glass-panel rounded-2xl p-2.5 px-3.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Zap size={15} className="fill-cyan-400" />
              <span>Энергия</span>
            </div>
            <span className="text-white/80 font-mono">
              {Math.floor(user.energy)} / {user.maxEnergy}
            </span>
          </div>

          {/* Energy Progress Bar */}
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-150"
              style={{ width: `${Math.min(100, (user.energy / user.maxEnergy) * 100)}%` }}
            />
          </div>
        </div>

        {/* Dedicated Upgrades Button */}
        <button
          onClick={() => {
            triggerHaptic("selection");
            setIsUpgradesOpen(true);
          }}
          className="btn-pressable w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-brand-ruble/20 via-blue-600/20 to-brand-ruble/10 border border-brand-ruble/40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/10"
        >
          <Zap size={16} className="text-brand-ruble fill-brand-ruble" />
          <span>Прокачка кликов и энергии</span>
        </button>
      </div>

      {/* Upgrades Modal */}
      <UpgradesModal
        isOpen={isUpgradesOpen}
        onClose={() => setIsUpgradesOpen(false)}
        user={user}
        onUpgrade={handleUpgrade}
      />

      {/* Level Up Modal */}
      {newLevelCelebration && (
        <LevelUpModal
          newLevel={newLevelCelebration}
          onClose={() => setNewLevelCelebration(null)}
        />
      )}
    </div>
  );
};
