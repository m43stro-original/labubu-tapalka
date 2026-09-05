"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Volume2,
  VolumeX,
  Vibrate,
  ShieldAlert,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import {
  getSoundEnabled,
  setSoundEnabled,
  getHapticEnabled,
  setHapticEnabled,
  triggerHaptic,
} from "@/lib/sound-fx";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const router = useRouter();
  const [sound, setSound] = useState(getSoundEnabled());
  const [haptic, setHaptic] = useState(getHapticEnabled());
  const [adminTapCount, setAdminTapCount] = useState(0);

  if (!isOpen) return null;

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    triggerHaptic("selection");
  };

  const toggleHaptic = () => {
    const next = !haptic;
    setHaptic(next);
    setHapticEnabled(next);
    triggerHaptic("selection");
  };

  // Easter egg: 5 taps on version opens /admin
  const handleVersionTap = () => {
    const next = adminTapCount + 1;
    setAdminTapCount(next);
    triggerHaptic("light");

    if (next >= 5) {
      triggerHaptic("heavy");
      onClose();
      router.push("/admin");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-3xl bg-[#131926] border border-white/20 p-5 flex flex-col gap-4 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Настройки игры
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Audio & Haptic Toggles */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </div>
              <span className="text-xs font-semibold text-white">Звуковые эффекты</span>
            </div>
            <button
              onClick={toggleSound}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                sound ? "bg-blue-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  sound ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Vibrate size={18} />
              </div>
              <span className="text-xs font-semibold text-white">Вибрация (Haptics)</span>
            </div>
            <button
              onClick={toggleHaptic}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                haptic ? "bg-purple-500" : "bg-white/20"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  haptic ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>


        {/* Hidden Admin Direct Button */}
        <div className="pt-2">
          <button
            onClick={() => {
              triggerHaptic("selection");
              onClose();
              router.push("/admin");
            }}
            className="w-full py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs flex items-center justify-center gap-2"
          >
            <ShieldAlert size={15} />
            Админ-панель (/admin)
          </button>
        </div>

        {/* Version Footer with Easter Egg */}
        <div
          onClick={handleVersionTap}
          className="text-center pt-2 text-[10px] text-white/30 cursor-pointer select-none"
        >
          Labubu Empire v1.0.4 • Build 2026
          {adminTapCount > 0 && adminTapCount < 5 && (
            <span className="text-amber-400 block mt-0.5">
              Тапни еще {5 - adminTapCount} раз...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
