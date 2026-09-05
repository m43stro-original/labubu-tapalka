"use client";

import React, { useState, useEffect } from "react";
import { TopHeader } from "@/components/navigation/TopHeader";
import { BottomNav, NavTab } from "@/components/navigation/BottomNav";
import { ClickerView } from "@/components/clicker/ClickerView";
import { FactoryView } from "@/components/factory/FactoryView";
import { DuelsView } from "@/components/duels/DuelsView";
import { LeaderboardView } from "@/components/leaderboard/LeaderboardView";
import { SocialView } from "@/components/social/SocialView";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { calculatePassiveIncomePerSecond } from "@/lib/game-engine";
import { initSoundSettings, triggerHaptic, playCoinSound } from "@/lib/sound-fx";
import { formatRubles } from "@/lib/utils";

interface TelegramUserAuth {
  id: string;
  username: string;
  firstName: string;
}

// Helper to extract Telegram WebApp user from environment
function extractTelegramUser(): TelegramUserAuth | null {
  if (typeof window === "undefined") return null;

  try {
    const twa = (window as unknown as { Telegram?: { WebApp?: any } }).Telegram?.WebApp;
    if (twa) {
      // 1. Direct object
      if (twa.initDataUnsafe?.user?.id) {
        const u = twa.initDataUnsafe.user;
        return {
          id: u.id.toString(),
          username: u.username || "",
          firstName: u.first_name || "Тапер",
        };
      }

      // 2. Query string in initData
      if (twa.initData) {
        const p = new URLSearchParams(twa.initData);
        const userStr = p.get("user");
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u?.id) {
            return {
              id: u.id.toString(),
              username: u.username || "",
              firstName: u.first_name || "Тапер",
            };
          }
        }
      }
    }

    // 3. Check hash for tgWebAppData
    if (window.location.hash) {
      const hash = window.location.hash.substring(1);
      const p = new URLSearchParams(hash);
      const tgWebAppData = p.get("tgWebAppData");
      if (tgWebAppData) {
        const innerParams = new URLSearchParams(tgWebAppData);
        const userStr = innerParams.get("user");
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u?.id) {
            return {
              id: u.id.toString(),
              username: u.username || "",
              firstName: u.first_name || "Тапер",
            };
          }
        }
      }
    }

    // 4. Search query parameters
    if (window.location.search) {
      const p = new URLSearchParams(window.location.search);
      const tId = p.get("telegramId") || p.get("tgId");
      if (tId) {
        return {
          id: tId,
          username: p.get("username") || "",
          firstName: p.get("firstName") || "Тапер",
        };
      }
    }
  } catch (e) {
    console.error("Failed to extract Telegram user:", e);
  }

  return null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("clicker");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<{ amount: number; seconds: number } | null>(null);

  // Authenticated Telegram identity
  const [tgUser, setTgUser] = useState<TelegramUserAuth | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Initialize and detect user on mount
  useEffect(() => {
    initSoundSettings();

    // Preload all 7 character tiers into browser memory cache
    if (typeof window !== "undefined") {
      [1, 2, 3, 4, 5, 6, 7].forEach((lvl) => {
        const img = new Image();
        img.src = `/images/${lvl}lvl.png`;
      });

      const twa = (window as unknown as { Telegram?: { WebApp?: any } }).Telegram?.WebApp;
      if (twa) {
        try {
          twa.ready();
          twa.expand();
          twa.enableClosingConfirmation?.();
          twa.setHeaderColor?.("#090c10");
          twa.setBackgroundColor?.("#090c10");
        } catch (e) {
          console.error("Error configuring Telegram WebApp:", e);
        }
      }

      // Read referral code
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get("tgWebAppStartParam") || urlParams.get("start") || urlParams.get("ref");
      if (refCode) {
        sessionStorage.setItem("referral_code", refCode);
      }

      // Detect Telegram user with retry
      let attempts = 0;
      const detectUser = () => {
        const found = extractTelegramUser();
        if (found) {
          setTgUser(found);
          setAuthChecked(true);
          fetchUser(found.id, found.username, found.firstName);
        } else if (attempts < 12) {
          attempts++;
          setTimeout(detectUser, 60);
        } else {
          setAuthChecked(true);
          setLoading(false);
        }
      };

      detectUser();
    }
  }, []);

  // Fetch or initialize user from server
  const fetchUser = async (tgId: string, uName = "", fName = "") => {
    try {
      setLoading(true);
      const refCode = typeof window !== "undefined" ? sessionStorage.getItem("referral_code") || "" : "";
      const url = `/api/user?telegramId=${tgId}&username=${encodeURIComponent(uName)}&firstName=${encodeURIComponent(fName)}&ref=${refCode}`;

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);

        // Only show offline notice if earnings are significant (>= 10 rubles)
        // AND user has an unlocked factory producing passive income
        const hasUnlockedFloor = data.user.floors?.some((f: any) => f.isUnlocked);
        if (hasUnlockedFloor && data.offlineEarnings >= 10 && data.offlineSeconds >= 30) {
          setOfflineNotice({
            amount: data.offlineEarnings,
            seconds: data.offlineSeconds,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load user:", err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time passive income accumulation ticker
  useEffect(() => {
    if (!user || !user.floors) return;
    const passiveRate = calculatePassiveIncomePerSecond(user.floors);
    if (passiveRate <= 0) return;

    const ticker = setInterval(() => {
      setUser((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          balance: prev.balance + passiveRate * 0.5,
          totalEarned: prev.totalEarned + passiveRate * 0.5,
        };
      });
    }, 500);

    return () => clearInterval(ticker);
  }, [user?.floors]);

  // Smooth continuous energy regeneration ticker
  useEffect(() => {
    if (!user) return;
    const energyTicker = setInterval(() => {
      setUser((prev: any) => {
        if (!prev || prev.energy >= prev.maxEnergy) return prev;
        return {
          ...prev,
          energy: Math.min(prev.maxEnergy, prev.energy + prev.energyRegen * 0.1),
        };
      });
    }, 100);

    return () => clearInterval(energyTicker);
  }, [user?.maxEnergy, user?.energyRegen]);

  // Immediate 0ms local tap earnings updater
  const handleLocalTapEarned = (earned: number, newEnergy: number) => {
    setUser((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        balance: prev.balance + earned,
        totalEarned: prev.totalEarned + earned,
        energy: newEnergy,
      };
    });
  };

  // Loading state
  if (loading && !user) {
    return (
      <div className="h-screen w-screen bg-[#090c10] flex flex-col items-center justify-center text-white">
        <div className="w-14 h-14 rounded-full border-4 border-brand-gold/30 border-t-brand-gold animate-spin mb-4" />
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Загрузка Labubu Empire...
        </span>
      </div>
    );
  }

  // Not in Telegram screen (prevents mock user logins)
  if (authChecked && !tgUser) {
    return (
      <div className="h-screen w-screen bg-[#090c10] flex flex-col items-center justify-center p-6 text-center text-white select-none">
        <div className="w-20 h-20 rounded-3xl bg-brand-ruble/15 border border-brand-ruble/30 flex items-center justify-center mb-5 text-4xl shadow-xl">
          🤖
        </div>
        <h1 className="text-xl font-black mb-2">Labubu Empire в Telegram</h1>
        <p className="text-xs text-white/60 mb-6 max-w-xs leading-relaxed">
          Игра открывается прямо внутри Telegram. Нажмите кнопку ниже, чтобы запустить официального бота:
        </p>
        <a
          href="https://t.me/CO2TAPBOT"
          className="btn-pressable w-full max-w-xs py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
        >
          Запустить @CO2TAPBOT
        </a>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-[#090c10] flex flex-col items-center justify-center p-6 text-center text-white">
        <p className="text-sm text-white/70 mb-4">Не удалось подключиться к серверу.</p>
        <button
          onClick={() => tgUser && fetchUser(tgUser.id, tgUser.username, tgUser.firstName)}
          className="px-6 py-3 rounded-xl bg-brand-gold text-black font-bold text-xs"
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  const passivePerSec = user.floors ? calculatePassiveIncomePerSecond(user.floors) : 0;

  return (
    <main className="relative flex flex-col h-screen max-w-md mx-auto overflow-hidden bg-[#090c10]">
      {/* Top Header with Profile & Ruble Balance */}
      <TopHeader
        user={user}
        passiveIncomePerSec={passivePerSec}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Tab Screen Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {activeTab === "clicker" && (
          <ClickerView
            user={user}
            onRefreshUser={(updated) => setUser(updated || user)}
            onTapEarned={handleLocalTapEarned}
          />
        )}

        {activeTab === "factory" && (
          <FactoryView
            user={user}
            onRefreshUser={(updated) => setUser(updated || user)}
            onLocalEarn={(amount) => {
              setUser((prev: any) => ({
                ...prev,
                balance: prev.balance + amount,
                totalEarned: prev.totalEarned + amount,
              }));
            }}
          />
        )}

        {activeTab === "duels" && (
          <DuelsView
            user={user}
            onRefreshUser={(updated) => setUser(updated || user)}
          />
        )}

        {activeTab === "leaderboard" && <LeaderboardView user={user} />}

        {activeTab === "social" && (
          <SocialView
            user={user}
            onRefreshUser={(updated) => setUser(updated || user)}
          />
        )}
      </div>

      {/* Bottom Tab Navigation */}
      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={user}
      />

      {/* Offline Earnings Welcome Notice */}
      {offlineNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl bg-[#141a27] border-2 border-emerald-500/40 p-6 flex flex-col items-center text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              ⚡
            </div>
            <h3 className="text-lg font-black text-white">С возвращением!</h3>
            <p className="text-xs text-white/60 mt-1">
              Пока тебя не было, твои конвейеры заработали:
            </p>
            <div className="text-2xl font-black text-emerald-400 my-3">
              +{formatRubles(offlineNotice.amount)}
            </div>
            <button
              onClick={() => {
                triggerHaptic("success");
                playCoinSound();
                setOfflineNotice(null);
              }}
              className="btn-pressable w-full py-3 rounded-xl bg-emerald-500 text-black font-extrabold text-xs"
            >
              Забрать прибыль
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
