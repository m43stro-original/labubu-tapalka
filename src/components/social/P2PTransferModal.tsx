"use client";

import React, { useState } from "react";
import { X, Send, ArrowRight, CheckCircle2 } from "lucide-react";
import { formatRubles } from "@/lib/utils";
import { triggerHaptic, playCoinSound } from "@/lib/sound-fx";

interface P2PTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onTransferSuccess: (newBalance: number) => void;
}

export const P2PTransferModal: React.FC<P2PTransferModalProps> = ({
  isOpen,
  onClose,
  user,
  onTransferSuccess,
}) => {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ name: string; amount: number } | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    const num = Number(amount);
    if (!recipient.trim() || isNaN(num) || num < 10) {
      triggerHaptic("warning");
      alert("Укажите получателя и сумму (минимум 10 ₽)");
      return;
    }

    if (user.balance < num) {
      triggerHaptic("error");
      alert("Недостаточно рублей на балансе");
      return;
    }

    try {
      setLoading(true);
      triggerHaptic("medium");

      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderTelegramId: user.telegramId,
          targetQuery: recipient.trim(),
          amount: num,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        triggerHaptic("error");
        alert(data.error || "Не удалось совершить перевод");
        return;
      }

      playCoinSound();
      triggerHaptic("success");
      setSuccessInfo({ name: data.receiverUsername, amount: num });
      onTransferSuccess(data.senderBalance);
    } catch (err) {
      console.error(err);
      triggerHaptic("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-3xl bg-[#141a27] border border-white/20 p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Send size={16} className="text-brand-ruble" />
            Перевод рублей игроку
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70"
          >
            <X size={16} />
          </button>
        </div>

        {successInfo ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-lg font-bold text-white">Перевод выполнен!</h4>
            <p className="text-xs text-white/60 mt-1">
              Отправлено <span className="text-brand-gold font-bold">{formatRubles(successInfo.amount)}</span> пользователю{" "}
              <span className="text-white font-bold">{successInfo.name}</span>
            </p>
            <button
              onClick={() => {
                setSuccessInfo(null);
                onClose();
              }}
              className="btn-pressable mt-5 w-full py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs"
            >
              Отлично
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Recipient Input */}
            <div>
              <label className="text-xs text-white/60 block mb-1">
                Получатель (@username или Telegram ID):
              </label>
              <input
                type="text"
                placeholder="@username или 10002"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-ruble/60"
              />
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex justify-between items-center text-xs text-white/60 mb-1">
                <span>Сумма (₽):</span>
                <span>Доступно: {formatRubles(user.balance)}</span>
              </div>
              <input
                type="number"
                placeholder="1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-ruble/60"
              />
            </div>

            {/* Quick amount presets */}
            <div className="flex gap-2">
              {[100, 500, 2000, 10000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val.toString())}
                  className="flex-1 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-white/70 hover:bg-white/10"
                >
                  +{val}
                </button>
              ))}
            </div>

            <button
              disabled={loading}
              onClick={handleSend}
              className="btn-pressable w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-brand-ruble to-blue-600 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              <Send size={15} />
              {loading ? "Отправка..." : "Отправить рубли"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
