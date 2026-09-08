"use client";

import React, { useState, useEffect } from "react";
import { Trophy, Coins, Factory, Users, Award, Crown } from "lucide-react";
import { formatRubles, formatCompactRubles } from "@/lib/utils";
import { triggerHaptic } from "@/lib/sound-fx";

interface LeaderboardViewProps {
  user: any;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<"balance" | "factory" | "referrals">("balance");
  const [leaders, setLeaders] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number>(-1);
  const [loading, setLoading] = useState(true);

  const fetchLeaders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/leaderboard?type=${activeTab}&telegramId=${user.telegramId}`);
      if (res.ok) {
        const data = await res.json();
        setLeaders(data.leaders || []);
        setUserRank(data.userRank);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaders();
  }, [activeTab, user.telegramId]);

  return (
    <div className="flex-1 flex flex-col px-4 pb-28 pt-2 select-none overflow-y-auto max-w-md mx-auto w-full">
      {/* Category selector pills */}
      <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-2xl mb-4 backdrop-blur-md">
        <button
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("balance");
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "balance"
              ? "bg-brand-ruble text-black shadow-md shadow-cyan-500/20"
              : "text-white/60 hover:text-white"
          }`}
        >
          <Coins size={14} />
          По балансу
        </button>

        <button
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("factory");
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "factory"
              ? "bg-brand-gold text-black shadow-md shadow-amber-500/20"
              : "text-white/60 hover:text-white"
          }`}
        >
          <Factory size={14} />
          По цехам
        </button>

        <button
          onClick={() => {
            triggerHaptic("selection");
            setActiveTab("referrals");
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === "referrals"
              ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
              : "text-white/60 hover:text-white"
          }`}
        >
          <Users size={14} />
          Рефералы
        </button>
      </div>

      {/* Leaders List */}
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="text-center py-12 text-xs text-white/40">
            Загрузка таблицы рекордов...
          </div>
        ) : leaders.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-xs text-white/50">
            Список лидеров пока формируется. Стань первым!
          </div>
        ) : (
          leaders.map((leader) => {
            const isTop1 = leader.rank === 1;
            const isTop2 = leader.rank === 2;
            const isTop3 = leader.rank === 3;

            return (
              <div
                key={leader.id}
                className={`glass-panel rounded-2xl p-3 flex items-center justify-between gap-3 border ${
                  isTop1
                    ? "border-amber-400/40 bg-gradient-to-r from-amber-500/10 to-transparent"
                    : isTop2
                    ? "border-gray-300/30 bg-gradient-to-r from-gray-400/10 to-transparent"
                    : isTop3
                    ? "border-amber-700/30 bg-gradient-to-r from-amber-800/10 to-transparent"
                    : "border-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Rank badge */}
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      isTop1
                        ? "bg-brand-gold text-black shadow-lg shadow-amber-500/40"
                        : isTop2
                        ? "bg-gray-300 text-black"
                        : isTop3
                        ? "bg-amber-700 text-white"
                        : "bg-white/5 text-white/50"
                    }`}
                  >
                    {isTop1 ? <Crown size={14} /> : leader.rank}
                  </div>

                  {/* User Telegram Avatar */}
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white/10 border border-white/15 shrink-0">
                    <img
                      src={leader.photoUrl || `/images/${leader.clickLevel || 1}lvl.png`}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = `/images/${leader.clickLevel || 1}lvl.png`;
                      }}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="truncate max-w-[120px]">{leader.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white/60">
                        Ур. {leader.clickLevel}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40">
                      ID: {leader.telegramId}
                    </span>
                  </div>
                </div>

                {/* Score value */}
                <div className="text-right">
                  {activeTab === "balance" && (
                    <span className="text-xs font-black text-brand-ruble">
                      {formatCompactRubles(leader.balance)}
                    </span>
                  )}
                  {activeTab === "factory" && (
                    <span className="text-xs font-black text-emerald-400">
                      +{formatCompactRubles(leader.passivePerSec)}/сек
                    </span>
                  )}
                  {activeTab === "referrals" && (
                    <span className="text-xs font-black text-purple-400">
                      {leader.referralCount} друзей
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Rank for Current User */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 z-20 pointer-events-none">
        <div className="glass-panel rounded-2xl p-2.5 px-4 flex items-center justify-between border border-brand-ruble/40 shadow-2xl pointer-events-auto bg-[#101520]/95 backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand-ruble/20 text-brand-ruble flex items-center justify-center text-xs font-black">
              #{userRank > 0 ? userRank : "-"}
            </div>
            <span className="text-xs font-semibold text-white">Твоя позиция</span>
          </div>
          <span className="text-xs font-black text-brand-gold">
            {formatRubles(user.balance)}
          </span>
        </div>
      </div>
    </div>
  );
};
