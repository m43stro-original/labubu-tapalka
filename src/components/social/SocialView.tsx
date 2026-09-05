"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Copy,
  Share2,
  Gift,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { P2PTransferModal } from "./P2PTransferModal";
import { formatRubles, formatCompactRubles } from "@/lib/utils";
import { triggerHaptic } from "@/lib/sound-fx";

interface SocialViewProps {
  user: any;
  onRefreshUser: (updatedUser?: any) => void;
}

export const SocialView: React.FC<SocialViewProps> = ({ user, onRefreshUser }) => {
  const [refData, setRefData] = useState<{
    refLink: string;
    referralCount: number;
    friends: any[];
  }>({
    refLink: "",
    referralCount: 0,
    friends: [],
  });

  const [transfers, setTransfers] = useState<any[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Fetch referrals and transfer history
  const fetchData = async () => {
    try {
      const [refRes, txRes] = await Promise.all([
        fetch(`/api/referrals?telegramId=${user.telegramId}`),
        fetch(`/api/transfer?telegramId=${user.telegramId}`),
      ]);

      if (refRes.ok) {
        const d = await refRes.json();
        setRefData(d);
      }
      if (txRes.ok) {
        const t = await txRes.json();
        setTransfers(t.transfers || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.telegramId]);

  const handleCopyLink = () => {
    triggerHaptic("selection");
    if (refData.refLink) {
      navigator.clipboard.writeText(refData.refLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleShareTelegram = () => {
    triggerHaptic("medium");
    const shareText = "Заходи в тапалку Labubu Empire! Получи +1 000 ₽ на старте и строй свою фабрику:";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      refData.refLink
    )}&text=${encodeURIComponent(shareText)}`;
    window.open(shareUrl, "_blank");
  };

  return (
    <div className="flex-1 flex flex-col px-4 pb-28 pt-2 select-none overflow-y-auto max-w-md mx-auto w-full">
      {/* Referral Hub Banner */}
      <div className="glass-panel rounded-3xl p-4 mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 flex items-center justify-center">
            <Gift size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Приглашай друзей
            </h2>
            <span className="text-[10px] text-white/50">
              Получай +5 000 ₽ и 10% от их пассивного дохода!
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleCopyLink}
            className="btn-pressable flex-1 py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5"
          >
            {isCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            <span>{isCopied ? "Скопировано!" : "Копировать"}</span>
          </button>
          <button
            onClick={handleShareTelegram}
            className="btn-pressable flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
          >
            <Share2 size={16} />
            <span>В Telegram</span>
          </button>
        </div>
      </div>

      {/* P2P Transfers Action Card */}
      <div className="glass-panel rounded-3xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-brand-ruble/20 text-brand-ruble border border-brand-ruble/30 flex items-center justify-center">
            <Send size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Перевод рублей</h3>
            <p className="text-[10px] text-white/50">Отправляй рубли другим игрокам</p>
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic("selection");
            setIsTransferOpen(true);
          }}
          className="btn-pressable px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10"
        >
          Перевести
        </button>
      </div>

      {/* Friends List */}
      <div className="flex flex-col gap-2 mb-4">
        <span className="text-xs font-bold text-white/70 px-1">
          Приглашенные друзья ({refData.friends?.length || 0})
        </span>

        {refData.friends?.length === 0 ? (
          <div className="glass-panel rounded-2xl p-5 text-center text-xs text-white/40">
            У тебя пока нет приглашенных друзей. Отправь ссылку в Telegram!
          </div>
        ) : (
          refData.friends.map((friend) => (
            <div
              key={friend.id}
              className="glass-panel rounded-2xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/80">
                  {friend.name[0]?.toUpperCase() || "F"}
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">{friend.name}</span>
                  <span className="text-[10px] text-white/40">Уровень {friend.level}</span>
                </div>
              </div>
              <span className="text-xs font-bold text-brand-gold">
                {formatCompactRubles(friend.balance)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Transfers History */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-white/70 px-1">
          История переводов ({transfers.length})
        </span>

        {transfers.length === 0 ? (
          <div className="glass-panel rounded-2xl p-5 text-center text-xs text-white/40">
            История переводов пуста
          </div>
        ) : (
          transfers.map((tx) => (
            <div
              key={tx.id}
              className="glass-panel rounded-2xl p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    tx.type === "in"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {tx.type === "in" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {tx.type === "in" ? `От ${tx.otherParty}` : `Кому: ${tx.otherParty}`}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>

              <span
                className={`text-xs font-black ${
                  tx.type === "in" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {tx.type === "in" ? "+" : "-"}
                {formatRubles(tx.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* P2P Transfer Modal */}
      <P2PTransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        user={user}
        onTransferSuccess={(newBalance) => {
          onRefreshUser({ ...user, balance: newBalance });
          fetchData();
        }}
      />
    </div>
  );
};
