"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ArrowLeft,
  Search,
  PlusCircle,
  MinusCircle,
  Ban,
  CheckCircle,
  Users,
  Coins,
  Swords,
  RefreshCw,
} from "lucide-react";
import { formatRubles, formatCompactRubles } from "@/lib/utils";

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [isAuth, setIsAuth] = useState(false);
  const [search, setSearch] = useState("");
  const [data, setData] = useState<{
    stats: any;
    users: any[];
    recentLogs: any[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Check saved session PIN
  useEffect(() => {
    const savedPin = sessionStorage.getItem("admin_pin");
    if (savedPin) {
      setPin(savedPin);
      loadAdminData(savedPin);
    }
  }, []);

  const loadAdminData = async (pinCode: string, searchQuery = "") => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin?pin=${pinCode}&search=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        setIsAuth(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setIsAuth(true);
      sessionStorage.setItem("admin_pin", pinCode);
    } catch (err) {
      console.error(err);
      setIsAuth(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loadAdminData(pin, search);
  };

  const handleAction = async (action: "credit" | "debit" | "ban" | "unban", targetUserId: string) => {
    let amount = 0;
    let reason = "";

    if (action === "credit" || action === "debit") {
      const input = prompt(`Введите сумму рублей для ${action === "credit" ? "начисления" : "списания"}:`, "10000");
      if (!input || isNaN(Number(input))) return;
      amount = Number(input);
      reason = prompt("Причина действия (комментарий):", "Корректировка администратором") || "Admin Action";
    } else {
      const confirmAction = confirm(`Вы уверены, что хотите ${action === "ban" ? "заблокировать" : "разблокировать"} этого пользователя?`);
      if (!confirmAction) return;
      reason = prompt("Причина:", "Нарушение правил") || "Admin Action";
    }

    try {
      setLoading(true);
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          action,
          targetUserId,
          amount,
          reason,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || "Ошибка при выполнении действия");
        return;
      }

      alert("Действие успешно выполнено!");
      loadAdminData(pin, search);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // PIN Entry Gate
  if (!isAuth) {
    return (
      <div className="min-h-screen bg-[#090c10] text-white flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-3xl bg-[#121824] border border-white/20 p-6 flex flex-col gap-4 shadow-2xl"
        >
          <div className="flex items-center gap-2.5 text-rose-400">
            <ShieldAlert size={26} />
            <h2 className="text-lg font-bold">Скрытая Админ-Панель</h2>
          </div>
          <p className="text-xs text-white/50">
            Для доступа к управлению балансами и игроками введите PIN-код администратора:
          </p>

          <input
            type="password"
            placeholder="PIN-код (по умолч. admin2026)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg"
          >
            {loading ? "Проверка..." : "Войти в панель"}
          </button>

          <Link
            href="/"
            className="text-center text-xs text-white/40 hover:text-white mt-1"
          >
            Вернуться в игру
          </Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090c10] text-white p-4 max-w-4xl mx-auto flex flex-col gap-5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert size={20} className="text-rose-400" />
              Админ-панель Labubu Empire
            </h1>
            <span className="text-xs text-white/50">
              Управление экономикой и игроками
            </span>
          </div>
        </div>

        <button
          onClick={() => loadAdminData(pin, search)}
          className="btn-pressable px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {/* Global Economy Stats Grid */}
      {data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-panel rounded-2xl p-3.5 flex flex-col gap-1">
            <span className="text-[11px] text-white/50 uppercase font-semibold">Всего игроков</span>
            <span className="text-xl font-black text-white">{data.stats.totalUsers}</span>
          </div>

          <div className="glass-panel rounded-2xl p-3.5 flex flex-col gap-1">
            <span className="text-[11px] text-white/50 uppercase font-semibold">Общая масса</span>
            <span className="text-xl font-black text-brand-ruble">
              {formatCompactRubles(data.stats.totalRublesInCirculation)}
            </span>
          </div>

          <div className="glass-panel rounded-2xl p-3.5 flex flex-col gap-1">
            <span className="text-[11px] text-white/50 uppercase font-semibold">Сыграно дуэлей</span>
            <span className="text-xl font-black text-amber-400">{data.stats.totalDuels}</span>
          </div>

          <div className="glass-panel rounded-2xl p-3.5 flex flex-col gap-1">
            <span className="text-[11px] text-white/50 uppercase font-semibold">P2P переводов</span>
            <span className="text-xl font-black text-emerald-400">{data.stats.totalTransfers}</span>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Поиск игрока по @username, имени или ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-rose-500"
          />
        </div>
        <button
          onClick={() => loadAdminData(pin, search)}
          className="px-4 py-3 bg-rose-500 hover:bg-rose-400 text-white rounded-2xl font-bold text-xs"
        >
          Искать
        </button>
      </div>

      {/* Users List */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-bold text-white/60 uppercase tracking-wider px-1">
          Список игроков ({data?.users?.length || 0})
        </h2>

        <div className="flex flex-col gap-2.5">
          {data?.users?.map((u) => (
            <div
              key={u.id}
              className={`glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                u.isBanned ? "border-rose-500/50 bg-rose-950/20" : "border-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-white">
                  {u.clickLevel}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {u.username ? `@${u.username}` : u.firstName || "Без имени"}
                    </span>
                    {u.isBanned && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase">
                        ЗАБЛОКИРОВАН
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/50 flex gap-3 mt-0.5">
                    <span>ID: {u.telegramId}</span>
                    <span>Баланс: <strong className="text-brand-gold font-bold">{formatRubles(u.balance)}</strong></span>
                    <span>Этажей: {u.unlockedFloors}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => handleAction("credit", u.id)}
                  className="btn-pressable px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1"
                >
                  <PlusCircle size={14} />
                  +Начислить
                </button>

                <button
                  onClick={() => handleAction("debit", u.id)}
                  className="btn-pressable px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1"
                >
                  <MinusCircle size={14} />
                  -Списать
                </button>

                {u.isBanned ? (
                  <button
                    onClick={() => handleAction("unban", u.id)}
                    className="btn-pressable px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold flex items-center gap-1"
                  >
                    <CheckCircle size={14} />
                    Разбан
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction("ban", u.id)}
                    className="btn-pressable px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1"
                  >
                    <Ban size={14} />
                    Бан
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
