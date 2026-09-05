"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { motion, useSpring, useMotionValue, useTransform } from "framer-motion";
import { LEVELS } from "@/lib/constants";
import { triggerHaptic, playTapSound, playCritSound } from "@/lib/sound-fx";

interface ClickerCircleProps {
  level: number;
  isFever: boolean;
  onTap: (clientX: number, clientY: number, isCrit: boolean) => void;
  disabled: boolean;
}

export const ClickerCircle: React.FC<ClickerCircleProps> = ({
  level,
  isFever,
  onTap,
  disabled,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentConfig = LEVELS[Math.min(level - 1, LEVELS.length - 1)] || LEVELS[0];

  // 3D Tilt motion values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Apple-recommended spring physics for fluid touch
  const rotateX = useSpring(useTransform(y, [-120, 120], [14, -14]), {
    damping: 20,
    stiffness: 300,
  });
  const rotateY = useSpring(useTransform(x, [-120, 120], [-14, 14]), {
    damping: 20,
    stiffness: 300,
  });

  const [isPressed, setIsPressed] = useState(false);

  // Instant response on pointerdown (kill latency: Apple WWDC rule #1)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set(e.clientX - centerX);
      y.set(e.clientY - centerY);
    }

    setIsPressed(true);

    // Roll crit chance (7%)
    const isCrit = Math.random() < 0.07;

    // Multimodal synchronization: haptics + sound in exact same frame
    if (isCrit) {
      triggerHaptic("heavy");
      playCritSound();
    } else {
      triggerHaptic("light");
      playTapSound();
    }

    onTap(e.clientX, e.clientY, isCrit);
  };

  const handlePointerUp = () => {
    setIsPressed(false);
    x.set(0);
    y.set(0);
  };

  // Tier-specific special aura classes
  const getTierAura = () => {
    if (level <= 2) {
      return "border-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.3)]";
    } else if (level <= 4) {
      return "border-cyan-400/50 shadow-[0_0_60px_rgba(6,182,212,0.4)]";
    } else if (level <= 6) {
      return "border-amber-400/60 shadow-[0_0_80px_rgba(245,158,11,0.5)]";
    } else {
      return "border-pink-500/70 shadow-[0_0_100px_rgba(236,72,153,0.65)]";
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative flex items-center justify-center cursor-pointer select-none touch-manipulation perspective-1000 py-2"
      style={{ perspective: 1000 }}
    >
      {/* Outer ambient glow ring */}
      <div
        className={`absolute w-72 h-72 rounded-full blur-2xl opacity-40 transition-opacity duration-300 pointer-events-none ${
          isFever ? "bg-orange-500 opacity-75 scale-110" : "bg-white/10"
        }`}
        style={{
          backgroundColor: isFever ? undefined : currentConfig.themeColor,
        }}
      />

      {/* 3D Tilt & Spring Container */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          scale: isPressed ? 0.94 : 1.0,
        }}
        transition={{
          type: "spring",
          damping: 16,
          stiffness: 400,
        }}
        className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-full flex items-center justify-center p-3 bg-gradient-to-b from-[#182030] to-[#0d121c] border-4 ${getTierAura()} transition-all duration-200`}
      >
        {/* Inner glass rim */}
        <div className="absolute inset-2 rounded-full border border-white/20 bg-gradient-to-tr from-white/5 via-transparent to-white/15 pointer-events-none" />

        {/* Labubu Center Image */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 pointer-events-none drop-shadow-2xl">
          <Image
            src={currentConfig.image}
            alt={currentConfig.name}
            fill
            priority
            className="object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
            sizes="(max-width: 640px) 192px, 224px"
          />
        </div>

        {/* Level badge floating on disc bottom */}
        <div className="absolute -bottom-2 bg-black/80 border border-white/20 px-3 py-1 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: currentConfig.themeColor }}
          />
          <span className="text-xs font-bold text-white tracking-wider">
            {currentConfig.name}
          </span>
        </div>
      </motion.div>
    </div>
  );
};
