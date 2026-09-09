"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Factory,
  Lock,
  Zap,
  Gauge,
  Timer,
  Cpu,
  ChevronUp,
  ChevronDown,
  Layers,
} from "lucide-react";
import { ConveyorBelt } from "./ConveyorBelt";
import { FLOOR_CONFIGS, LEVELS } from "@/lib/constants";
import { formatRubles, formatCompactRubles } from "@/lib/utils";
import { triggerHaptic, playCoinSound } from "@/lib/sound-fx";
import { getBeltSpeedCost, getDropSpeedCost, getDispenserCost } from "@/lib/game-engine";

interface FactoryViewProps {
  user: any;
  onRefreshUser: (updatedUser?: any) => void;
  onLocalEarn: (amount: number) => void;
  onViewFloor?: (floorNum: number) => void;
}

export const FactoryView: React.FC<FactoryViewProps> = ({
  user,
  onRefreshUser,
  onLocalEarn,
  onViewFloor,
}) => {
  const [selectedFloorNum, setSelectedFloorNum] = useState(1);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    onViewFloor?.(selectedFloorNum);
  }, [selectedFloorNum, onViewFloor]);

  // Check if user has unlocked the factory yet
  const isFactoryUnlocked = user.floors?.some((f: any) => f.isUnlocked);

  // Find currently selected floor in user.floors
  const currentFloor =
    user.floors?.find((f: any) => f.floorNumber === selectedFloorNum) || {
      floorNumber: selectedFloorNum,
      isUnlocked: false,
      beltSpeedLevel: 1,
      dropSpeedLevel: 1,
      dispenserCount: 1,
    };

  const floorConfig =
    FLOOR_CONFIGS[selectedFloorNum - 1] || FLOOR_CONFIGS[0];
  const levelConfig =
    LEVELS[selectedFloorNum - 1] || LEVELS[0];

  // Upgrade costs from centralized game engine
  const beltCost = getBeltSpeedCost(floorConfig.baseIncomePerDrop, currentFloor.beltSpeedLevel);
  const dropCost = getDropSpeedCost(floorConfig.baseIncomePerDrop, currentFloor.dropSpeedLevel);
  const dispCost = getDispenserCost(floorConfig.baseIncomePerDrop, currentFloor.dispenserCount);

  // Perform factory upgrade action
  const handleFactoryAction = async (action: string) => {
    if (isUpgrading) return;
    try {
      setIsUpgrading(true);
      triggerHaptic("medium");

      const res = await fetch("/api/factory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.telegramId,
          action,
          floorNumber: selectedFloorNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        triggerHaptic("error");
        alert(data.error || "Ошибка при улучшении фабрики");
        return;
      }

      playCoinSound();
      triggerHaptic("success");
      onRefreshUser(data.user);
    } catch (err) {
      console.error(err);
      triggerHaptic("error");
    } finally {
      setIsUpgrading(false);
    }
  };

  // If the factory is not unlocked at all, show the locked factory screen
  if (!isFactoryUnlocked) {
    const unlockCost = FLOOR_CONFIGS[0].unlockCost;
    const canAfford = user.balance >= unlockCost;

    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-24 pt-2 select-none overflow-y-auto max-w-md mx-auto w-full text-center">
        <div className="w-full glass-panel rounded-3xl p-6 flex flex-col items-center border border-dashed border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-[#131722] to-[#0c0f17] shadow-2xl">
          {/* Animated Lock badge */}
          <div className="relative w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
            <Lock size={36} className="text-amber-400" />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-ruble/20 border border-brand-ruble flex items-center justify-center text-xs">
              🏭
            </div>
          </div>

          <h2 className="text-lg font-black text-white">
            Фабрика Лабубу заблокирована
          </h2>
          <p className="text-xs text-white/60 mt-1 mb-5 max-w-xs leading-relaxed">
            Постройте конвейер и начните автоматическое производство фигурок Лабубу для получения пассивного дохода в рублях!
          </p>

          {/* Perks list */}
          <div className="w-full flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 text-left text-xs mb-5">
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Пассивный доход</strong> каждую секунду</span>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Работает даже когда вы <strong>оффлайн</strong></span>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>7 этажей конвейеров с Лабубу</span>
            </div>
          </div>

          {/* Cost badge */}
          <div className="flex items-center justify-between w-full p-3 rounded-2xl bg-black/40 border border-white/10 mb-4">
            <span className="text-xs text-white/60">Стоимость постройки:</span>
            <span className="text-sm font-black text-brand-gold">
              {formatRubles(unlockCost)}
            </span>
          </div>

          {/* Action button */}
          <button
            disabled={!canAfford || isUpgrading}
            onClick={() => handleFactoryAction("unlock_floor")}
            className={`btn-pressable w-full py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
              canAfford
                ? "bg-gradient-to-r from-brand-gold via-amber-500 to-amber-600 text-black shadow-amber-500/25 animate-pulse"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
          >
            <Factory size={16} />
            <span>
              {canAfford
                ? `Разблокировать Фабрику за ${formatRubles(unlockCost)}`
                : `Не хватает: ${formatRubles(unlockCost - user.balance)}`}
            </span>
          </button>

          {!canAfford && (
            <span className="text-[11px] text-white/40 mt-2">
              Тапайте по Лабубу в кликере, чтобы накопить рубли!
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-4 pb-24 pt-2 select-none overflow-y-auto max-w-md mx-auto w-full">
      {/* Floor selector bar */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-2 mb-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Этаж {selectedFloorNum}
            </h3>
            <span className="text-[10px] text-white/50">
              Конвейер {selectedFloorNum} из 7
            </span>
          </div>
        </div>

        {/* Floor quick picker pills */}
        <div className="flex items-center gap-1">
          {FLOOR_CONFIGS.map((fc) => {
            const isUnl = user.floors?.find((f: any) => f.floorNumber === fc.floor)?.isUnlocked;
            const isSel = selectedFloorNum === fc.floor;
            return (
              <button
                key={fc.floor}
                onClick={() => {
                  triggerHaptic("selection");
                  setSelectedFloorNum(fc.floor);
                }}
                className={`w-7 h-7 rounded-lg text-xs font-black transition-all ${
                  isSel
                    ? "bg-brand-gold text-black shadow-md shadow-amber-500/30 scale-105"
                    : isUnl
                    ? "bg-white/10 text-white/80 hover:bg-white/20"
                    : "bg-black/40 text-white/25 border border-white/5"
                }`}
              >
                {fc.floor}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Floor Visual Area */}
      {currentFloor.isUnlocked ? (
        <div className="flex flex-col gap-3">
          {/* Animated Conveyor Screen */}
          <ConveyorBelt
            key={`floor-${selectedFloorNum}-${currentFloor.dispenserCount}`}
            floorNumber={selectedFloorNum}
            labubuImage={levelConfig.image}
            beltSpeedLevel={currentFloor.beltSpeedLevel}
            dropSpeedLevel={currentFloor.dropSpeedLevel}
            dispenserCount={currentFloor.dispenserCount}
            baseIncomePerDrop={floorConfig.baseIncomePerDrop}
            onCoinEarned={onLocalEarn}
          />

          {/* Floor Stats & Upgrade Dashboard */}
          <div className="glass-panel rounded-3xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <Factory size={15} className="text-brand-ruble" />
                Модернизация этажа {selectedFloorNum}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-emerald-400">
                  +{formatCompactRubles(floorConfig.baseIncomePerDrop)} ₽ / шт
                </span>
                <span
                  className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[9px] font-black tracking-wide flex items-center gap-0.5 shadow-sm"
                  title="Бонус надзора директора: +50% к стоимости при личном присутствии на этаже!"
                >
                  ⭐ +50% LIVE
                </span>
              </div>
            </div>

            {/* Upgrades grid */}
            <div className="grid grid-cols-1 gap-2.5">
              {/* 1. Belt Speed */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <Gauge size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Скорость ленты</div>
                    <div className="text-[10px] text-white/50">
                      Уровень {currentFloor.beltSpeedLevel} / 10
                    </div>
                  </div>
                </div>

                <button
                  disabled={
                    currentFloor.beltSpeedLevel >= 10 ||
                    user.balance < beltCost ||
                    isUpgrading
                  }
                  onClick={() => handleFactoryAction("upgrade_belt_speed")}
                  className={`btn-pressable px-3 py-1.5 rounded-xl text-xs font-bold ${
                    currentFloor.beltSpeedLevel >= 10
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : user.balance >= beltCost
                      ? "bg-blue-500 hover:bg-blue-400 text-white shadow-md shadow-blue-500/20"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                >
                  {currentFloor.beltSpeedLevel >= 10 ? "МАКС" : formatCompactRubles(beltCost)}
                </button>
              </div>

              {/* 2. Drop Speed */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Timer size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Скорость сборки</div>
                    <div className="text-[10px] text-white/50">
                      Уровень {currentFloor.dropSpeedLevel} / 10
                    </div>
                  </div>
                </div>

                <button
                  disabled={
                    currentFloor.dropSpeedLevel >= 10 ||
                    user.balance < dropCost ||
                    isUpgrading
                  }
                  onClick={() => handleFactoryAction("upgrade_drop_speed")}
                  className={`btn-pressable px-3 py-1.5 rounded-xl text-xs font-bold ${
                    currentFloor.dropSpeedLevel >= 10
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : user.balance >= dropCost
                      ? "bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                >
                  {currentFloor.dropSpeedLevel >= 10 ? "МАКС" : formatCompactRubles(dropCost)}
                </button>
              </div>

              {/* 3. Dispenser Count (max 4) */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                    <Cpu size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Автоматы (трубы)</div>
                    <div className="text-[10px] text-white/50">
                      {currentFloor.dispenserCount} из 4 труб активно
                    </div>
                  </div>
                </div>

                <button
                  disabled={
                    currentFloor.dispenserCount >= 4 ||
                    user.balance < dispCost ||
                    isUpgrading
                  }
                  onClick={() => handleFactoryAction("upgrade_dispenser")}
                  className={`btn-pressable px-3 py-1.5 rounded-xl text-xs font-bold ${
                    currentFloor.dispenserCount >= 4
                      ? "bg-white/5 text-white/30 cursor-not-allowed"
                      : user.balance >= dispCost
                      ? "bg-purple-500 hover:bg-purple-400 text-white shadow-md shadow-purple-500/20"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
                >
                  {currentFloor.dispenserCount >= 4 ? "МАКС" : `+1 автом: ${formatCompactRubles(dispCost)}`}
                </button>
              </div>
            </div>

            {/* Industrial conveyor status tip */}
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-2 text-[11px] text-cyan-200/90">
              <span className="text-sm">💡</span>
              <span>
                Шкала на автомате показывает процесс создания фигурки. Если она заполнилась и <strong>горит красным</strong> — прокачайте <strong>«Скорость ленты»</strong>, чтобы фигурки сбрасывались мгновенно!
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Locked Floor State */
        <div className="glass-panel rounded-3xl p-8 flex flex-col items-center justify-center text-center my-auto border border-dashed border-white/20">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/15 flex items-center justify-center mb-4">
            <Lock size={28} className="text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-white">
            Этаж {selectedFloorNum} заблокирован
          </h3>
          <p className="text-xs text-white/60 max-w-xs mt-1 mb-6">
            Открой конвейер {selectedFloorNum}-го уровня для производства фигурок{" "}
            <span className="text-amber-400 font-semibold">{levelConfig.name}</span> и
            получения +{formatCompactRubles(floorConfig.baseIncomePerDrop)} ₽ за штуку!
          </p>

          <button
            disabled={user.balance < floorConfig.unlockCost || isUpgrading}
            onClick={() => handleFactoryAction("unlock_floor")}
            className={`btn-pressable w-full py-3.5 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 ${
              user.balance >= floorConfig.unlockCost
                ? "bg-gradient-to-r from-brand-gold to-amber-500 text-black shadow-lg shadow-amber-500/30"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
          >
            {user.balance >= floorConfig.unlockCost
              ? `Разблокировать этаж за ${formatRubles(floorConfig.unlockCost)}`
              : `Требуется: ${formatRubles(floorConfig.unlockCost)}`}
          </button>
        </div>
      )}
    </div>
  );
};
