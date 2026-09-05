"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords,
  Coins,
  Dices,
  Trophy,
  History,
  Clock,
  RotateCcw,
} from "lucide-react";
import { formatRubles, formatCompactRubles } from "@/lib/utils";
import { triggerHaptic, playDuelRollSound, playCritSound } from "@/lib/sound-fx";

interface DuelsViewProps {
  user: any;
  onRefreshUser: (updatedUser?: any) => void;
}

export const DuelsView: React.FC<DuelsViewProps> = ({ user, onRefreshUser }) => {
  const [openDuels, setOpenDuels] = useState<any[]>([]);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Create duel state
  const [betAmount, setBetAmount] = useState(100);
  const [gameType, setGameType] = useState<"COIN" | "DICE">("COIN");

  // Duel rolling / animated result modal
  const [activeDuelAnimation, setActiveDuelAnimation] = useState<any | null>(null);

  // Fetch duels list from server (server auto-expires duels > 60s and refunds)
  const fetchDuels = async () => {
    try {
      const res = await fetch(`/api/duels?telegramId=${user.telegramId}`);
      if (res.ok) {
        const data = await res.json();
        setOpenDuels(data.openDuels || []);
        setUserHistory(data.userDuels || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDuels();
    const interval = setInterval(fetchDuels, 4000);
    return () => clearInterval(interval);
  }, [user.telegramId]);

  // Live countdown timer for open duels (1 second tick)
  useEffect(() => {
    const timer = setInterval(() => {
      setOpenDuels((prev) =>
        prev
          .map((d) => {
            const elapsed = Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 1000);
            const remaining = Math.max(0, 60 - elapsed);
            return { ...d, timeLeftSeconds: remaining };
          })
          .filter((d) => d.timeLeftSeconds > 0)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle Create Duel
  const handleCreateDuel = async () => {
    if (betAmount < 10) {
      triggerHaptic("error");
      alert("Минимальная ставка — 10 ₽");
      return;
    }

    if (user.balance < betAmount) {
      triggerHaptic("error");
      alert("Недостаточно рублей на балансе");
      return;
    }

    try {
      setLoading(true);
      triggerHaptic("medium");

      const res = await fetch("/api/duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.telegramId,
          action: "create",
          betAmount,
          gameType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Ошибка при создании лобби");
        return;
      }

      triggerHaptic("success");
      onRefreshUser({ ...user, balance: data.balance });
      fetchDuels();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Cancel Duel by Creator (Refund)
  const handleCancelDuel = async (duelId: string) => {
    try {
      setLoading(true);
      triggerHaptic("medium");

      const res = await fetch("/api/duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.telegramId,
          action: "cancel",
          duelId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        triggerHaptic("success");
        onRefreshUser({ ...user, balance: data.balance });
        fetchDuels();
      } else {
        alert(data.error || "Не удалось отменить вызов");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Join Duel with another player
  const handleJoinDuel = async (duelId: string, requiredBet: number, duelGameType: "COIN" | "DICE") => {
    if (user.balance < requiredBet) {
      triggerHaptic("error");
      alert("Недостаточно рублей для принятия ставки");
      return;
    }

    try {
      setLoading(true);
      triggerHaptic("heavy");
      playDuelRollSound();

      // Show rolling suspense modal
      setActiveDuelAnimation({
        status: "rolling",
        gameType: duelGameType,
        betAmount: requiredBet,
      });

      const res = await fetch("/api/duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.telegramId,
          action: "join",
          duelId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActiveDuelAnimation(null);
        alert(data.error || "Не удалось запустить дуэль");
        fetchDuels();
        return;
      }

      // Allow 2 seconds of suspenseful roll animation
      setTimeout(() => {
        if (data.isWinner) {
          triggerHaptic("success");
          playCritSound();
        } else {
          triggerHaptic("error");
        }

        setActiveDuelAnimation({
          status: "result",
          isWinner: data.isWinner,
          prize: data.prize,
          gameType: data.gameType,
          resultData: data.resultData,
        });

        // Trigger balance refresh
        fetch(`/api/user?telegramId=${user.telegramId}`)
          .then((r) => r.json())
          .then((d) => d.user && onRefreshUser(d.user));
        fetchDuels();
      }, 2000);
    } catch (err) {
      console.error(err);
      setActiveDuelAnimation(null);
    } finally {
      setLoading(false);
    }
  };

  const myOpenDuels = openDuels.filter((d) => d.creator.telegramId === user.telegramId?.toString());
  const otherOpenDuels = openDuels.filter((d) => d.creator.telegramId !== user.telegramId?.toString());

  return (
    <div className="flex-1 flex flex-col px-4 pb-24 pt-2 select-none overflow-y-auto max-w-md mx-auto w-full">
      {/* Top Creation Panel */}
      <div className="glass-panel rounded-3xl p-4 mb-4 flex flex-col gap-3 border border-rose-500/20 bg-gradient-to-b from-[#171d2b] to-[#0f1420]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <Swords size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Казино PvP Дуэлей
              </h2>
              <span className="text-[10px] text-white/50">
                Сражения 1 на 1 только с реальными игроками
              </span>
            </div>
          </div>
        </div>

        {/* Custom Bet Input & Quick Modifiers */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>Сумма ставки:</span>
            <span>Доступно: <strong className="text-brand-gold font-bold">{formatRubles(user.balance)}</strong></span>
          </div>

          <div className="relative flex items-center">
            <input
              type="number"
              min="10"
              max={user.balance}
              value={betAmount}
              onChange={(e) => {
                const val = Math.max(0, Number(e.target.value));
                setBetAmount(val);
              }}
              placeholder="Введите ставку..."
              className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-2.5 text-sm font-bold text-white placeholder-white/30 focus:outline-none focus:border-rose-500/80"
            />
            <span className="absolute right-4 text-xs font-black text-brand-ruble pointer-events-none">
              ₽
            </span>
          </div>

          {/* Quick Modifier Chips */}
          <div className="flex items-center gap-1.5">
            {[100, 500, 2500, 10000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  triggerHaptic("selection");
                  setBetAmount(val);
                }}
                className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                  betAmount === val
                    ? "bg-rose-500/30 border-rose-500 text-rose-300 shadow-sm"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                }`}
              >
                {formatCompactRubles(val)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                setBetAmount(Math.floor(user.balance));
              }}
              className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-brand-gold/20 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/30 transition-all"
            >
              Ва-банк
            </button>
          </div>

          {/* Game Mode Selector */}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setGameType("COIN");
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                gameType === "COIN"
                  ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm"
                  : "bg-white/5 border-white/10 text-white/50"
              }`}
            >
              <Coins size={14} />
              Монетка (2x)
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("selection");
                setGameType("DICE");
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                gameType === "DICE"
                  ? "bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm"
                  : "bg-white/5 border-white/10 text-white/50"
              }`}
            >
              <Dices size={14} />
              Кости (2x)
            </button>
          </div>
        </div>

        {/* Create Lobby Action Button */}
        <button
          disabled={loading || betAmount <= 0 || user.balance < betAmount}
          onClick={handleCreateDuel}
          className={`btn-pressable w-full py-3 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
            user.balance >= betAmount && betAmount >= 10
              ? "bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 text-white shadow-rose-500/30"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          }`}
        >
          <Swords size={16} />
          <span>Создать вызов: {formatRubles(betAmount)} (1 минута)</span>
        </button>

        <div className="flex items-center justify-center gap-1 text-[10px] text-white/40 text-center">
          <Clock size={11} />
          <span>Лобби длится 60 сек. Если никто не примет, ставка вернётся на ваш баланс.</span>
        </div>
      </div>

      {/* My Active Created Lobbies */}
      {myOpenDuels.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between text-xs font-bold text-amber-300 px-1">
            <span>Мои открытые лобби ({myOpenDuels.length})</span>
          </div>

          {myOpenDuels.map((d) => (
            <div
              key={d.id}
              className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  {d.gameType === "COIN" ? <Coins size={18} /> : <Dices size={18} />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{d.gameType === "COIN" ? "Монетка" : "Кости"}</span>
                    <span className="text-brand-gold font-black">
                      {formatRubles(d.betAmount)}
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-300/80 flex items-center gap-1">
                    <Clock size={10} />
                    <span>Осталось: {d.timeLeftSeconds ?? 60} сек.</span>
                  </div>
                </div>
              </div>

              <button
                disabled={loading}
                onClick={() => handleCancelDuel(d.id)}
                className="btn-pressable px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 font-bold text-[11px] border border-white/10 flex items-center gap-1"
              >
                <RotateCcw size={12} />
                <span>Отменить</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Open Duels Lobby List from other players */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex items-center justify-between text-xs font-bold text-white/70 px-1">
          <span>Вызовы других игроков ({otherOpenDuels.length})</span>
          <button onClick={fetchDuels} className="text-[11px] text-brand-ruble">
            Обновить
          </button>
        </div>

        {otherOpenDuels.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6 text-center text-xs text-white/40 flex flex-col items-center gap-1.5">
            <Clock size={20} className="text-white/20 mb-1" />
            <span>Сейчас нет открытых вызовов от других игроков.</span>
            <span className="text-[10px] text-white/30">Создайте своё лобби выше и ждите соперника!</span>
          </div>
        ) : (
          otherOpenDuels.map((d) => (
            <div
              key={d.id}
              className="glass-panel rounded-2xl p-3 flex items-center justify-between gap-2 border border-white/10"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 shrink-0">
                  {d.gameType === "COIN" ? <Coins size={20} /> : <Dices size={20} />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{d.creator.username}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white/70">
                      Ур. {d.creator.level}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/70">
                    Ставка: <span className="text-brand-gold font-bold">{formatRubles(d.betAmount)}</span>
                  </div>
                  <div className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">
                    <Clock size={10} />
                    <span>Осталось: {d.timeLeftSeconds ?? 60}с</span>
                  </div>
                </div>
              </div>

              <button
                disabled={loading || user.balance < d.betAmount}
                onClick={() => handleJoinDuel(d.id, d.betAmount, d.gameType)}
                className={`btn-pressable px-4 py-2 rounded-xl font-bold text-xs shadow-md ${
                  user.balance >= d.betAmount
                    ? "bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                Принять
              </button>
            </div>
          ))
        )}
      </div>

      {/* Duel History Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white/70 px-1">
          <History size={14} className="text-brand-ruble" />
          <span>История завершённых дуэлей</span>
        </div>

        {userHistory.length === 0 ? (
          <div className="glass-panel rounded-2xl p-4 text-center text-xs text-white/40">
            Здесь будет отображаться история ваших завершённых матчей
          </div>
        ) : (
          userHistory.map((h) => (
            <div
              key={h.id}
              className="glass-panel rounded-2xl p-2.5 px-3.5 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {h.gameType === "COIN" ? "🪙" : "🎲"}
                </span>
                <div>
                  <span className="font-bold text-white">
                    {h.gameType === "COIN" ? "Монетка" : "Кости"} • {formatRubles(h.betAmount)}
                  </span>
                </div>
              </div>

              <span
                className={`font-black text-xs px-2.5 py-1 rounded-lg ${
                  h.isWin
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {h.isWin ? `+${formatRubles(h.betAmount * 2)}` : `-${formatRubles(h.betAmount)}`}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Duel Live Rolling Suspense Modal */}
      {activeDuelAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-3xl bg-[#151c2a] border-2 border-white/20 p-6 flex flex-col items-center text-center shadow-2xl"
          >
            {activeDuelAnimation.status === "rolling" ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center animate-spin text-black shadow-[0_0_40px_rgba(245,158,11,0.5)] mb-4">
                  {activeDuelAnimation.gameType === "COIN" ? (
                    <Coins size={44} />
                  ) : (
                    <Dices size={44} />
                  )}
                </div>
                <h3 className="text-lg font-black text-white animate-pulse">
                  ОПРЕДЕЛЕНИЕ ПОБЕДИТЕЛЯ...
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Банк: {formatRubles(activeDuelAnimation.betAmount * 2)}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center py-3 w-full">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 shadow-xl ${
                    activeDuelAnimation.isWinner
                      ? "bg-emerald-500 text-black shadow-emerald-500/40"
                      : "bg-rose-500/30 text-rose-400 border border-rose-500/50"
                  }`}
                >
                  <Trophy size={38} />
                </div>

                <h3
                  className={`text-2xl font-black ${
                    activeDuelAnimation.isWinner ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {activeDuelAnimation.isWinner ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
                </h3>

                {activeDuelAnimation.isWinner ? (
                  <p className="text-sm font-bold text-white mt-1">
                    Ты выиграл банк:{" "}
                    <span className="text-brand-gold font-extrabold text-base">
                      +{formatRubles(activeDuelAnimation.prize)}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-white/60 mt-1">
                    Удача в следующий раз будет на твоей стороне!
                  </p>
                )}

                {/* Roll details breakdown */}
                {activeDuelAnimation.resultData && (
                  <div className="w-full bg-white/5 rounded-2xl p-3 my-4 text-xs flex justify-around">
                    {activeDuelAnimation.gameType === "COIN" ? (
                      <div>
                        <span className="text-white/50 block">Выпало:</span>
                        <span className="text-white font-bold">
                          {activeDuelAnimation.resultData.coin === "HEADS" ? "ОРЁЛ" : "РЕШКА"}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="text-white/50 block">Соперник:</span>
                          <span className="text-rose-400 font-black text-sm">
                            {activeDuelAnimation.resultData.creatorTotal || "5"}
                          </span>
                        </div>
                        <div className="w-[1px] bg-white/10" />
                        <div>
                          <span className="text-white/50 block">Твой бросок:</span>
                          <span className="text-emerald-400 font-black text-sm">
                            {activeDuelAnimation.resultData.opponentTotal || "8"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setActiveDuelAnimation(null)}
                  className="btn-pressable w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                >
                  Закрыть
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};
