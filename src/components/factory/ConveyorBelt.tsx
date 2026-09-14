"use client";

import React, { useEffect, useRef } from "react";
import { playCoinSound, triggerHaptic } from "@/lib/sound-fx";
import { getDropIntervalMs, getBeltSpeedPx } from "@/lib/game-engine";

interface ConveyorBeltProps {
  floorNumber: number;
  labubuImage: string;
  beltSpeedLevel: number;
  dropSpeedLevel: number;
  dispenserCount: number; // 1 to 4
  baseIncomePerDrop: number;
  onCoinEarned: (amount: number) => void;
}

interface ItemPhys {
  id: number;
  x: number;
  y: number;
  vy: number;
  isFalling: boolean;
  scaleX: number;
  scaleY: number;
  squashTimer: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

export const ConveyorBelt: React.FC<ConveyorBeltProps> = ({
  floorNumber,
  labubuImage,
  beltSpeedLevel,
  dropSpeedLevel,
  dispenserCount,
  baseIncomePerDrop,
  onCoinEarned,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<ItemPhys[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const nextIdRef = useRef(1);
  const animFrameIdRef = useRef<number>(0);
  const imageLoadedRef = useRef<HTMLImageElement | null>(null);
  const treadOffsetRef = useRef(0);
  const lastDropTimesRef = useRef<Record<number, number>>({});

  // Synchronize dynamic props into refs to avoid restarting the 60 FPS animation loop
  const onCoinEarnedRef = useRef(onCoinEarned);
  onCoinEarnedRef.current = onCoinEarned;

  const beltSpeedLevelRef = useRef(beltSpeedLevel);
  beltSpeedLevelRef.current = beltSpeedLevel;

  const dropSpeedLevelRef = useRef(dropSpeedLevel);
  dropSpeedLevelRef.current = dropSpeedLevel;

  const dispenserCountRef = useRef(dispenserCount);
  dispenserCountRef.current = dispenserCount;

  const baseIncomePerDropRef = useRef(baseIncomePerDrop);
  baseIncomePerDropRef.current = baseIncomePerDrop;

  // Preload Labubu image
  useEffect(() => {
    const img = new window.Image();
    img.src = labubuImage;
    img.onload = () => {
      imageLoadedRef.current = img;
    };
  }, [labubuImage]);

  // Main 60 FPS Canvas Physics & Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const render = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      const now = performance.now();
      const currentDispCount = dispenserCountRef.current;
      const currentBeltSpeedLevel = beltSpeedLevelRef.current;
      const currentDropSpeedLevel = dropSpeedLevelRef.current;
      const currentBaseIncome = baseIncomePerDropRef.current;

      // Kinematic constants
      const spriteSize = 42;
      const SAFE_LANDING_DIST = 44; // Clearance required on belt at landing moment
      const MIN_BELT_SPACING = 46; // Minimum spacing between items on belt
      const beltY = h - 56;
      const beltHeight = 22;
      const groundY = beltY - 15;
      const nozzleY = 38;
      const vaultX = w - 60;

      // Fast, physical fall: 14 frames (~230ms) from nozzle to belt
      const FALL_FRAMES = 14;

      const beltSpeed = getBeltSpeedPx(currentBeltSpeedLevel);
      const dropIntervalMs = getDropIntervalMs(currentDropSpeedLevel);

      // Pipe coordinates evenly spaced across belt
      let pipeFractions: number[] = [];
      if (currentDispCount === 1) pipeFractions = [0.38];
      else if (currentDispCount === 2) pipeFractions = [0.22, 0.54];
      else if (currentDispCount === 3) pipeFractions = [0.16, 0.37, 0.58];
      else pipeFractions = [0.12, 0.27, 0.42, 0.57];

      // Track progress and stalled status for each dispenser
      const dispenserStates: { progress: number; isStalled: boolean; px: number }[] = [];

      for (let i = 0; i < pipeFractions.length; i++) {
        const px = w * pipeFractions[i];

        if (lastDropTimesRef.current[i] === undefined) {
          // Stagger initial dispenser rhythm evenly across cycle
          lastDropTimesRef.current[i] = now - (i * (dropIntervalMs / currentDispCount));
        }

        const elapsed = now - lastDropTimesRef.current[i];
        const rawProgress = elapsed / dropIntervalMs;
        const progress = Math.min(1.0, Math.max(0.0, rawProgress));
        const isReadyToDrop = rawProgress >= 1.0;

        // Accurate Landing Clearance Check:
        // Does any item currently fall nearby, OR will any item on the belt be within
        // SAFE_LANDING_DIST (44px) at the exact moment of landing (FALL_FRAMES later)?
        const isBlocked = itemsRef.current.some((item) => {
          if (item.isFalling) {
            return Math.abs(item.x - px) < SAFE_LANDING_DIST;
          }
          const landingX = item.x + beltSpeed * FALL_FRAMES;
          return Math.abs(landingX - px) < SAFE_LANDING_DIST;
        });

        const isStalled = isReadyToDrop && isBlocked;
        dispenserStates.push({ progress, isStalled, px });

        // If crafting is complete and the landing spot is clear: DROP!
        if (isReadyToDrop && !isBlocked) {
          lastDropTimesRef.current[i] = now;
          itemsRef.current.push({
            id: nextIdRef.current++,
            x: px,
            y: nozzleY,
            vy: 3.8,
            isFalling: true,
            scaleX: 0.86,
            scaleY: 1.18,
            squashTimer: 0,
          });

          // Small steam puff on drop
          for (let p = 0; p < 3; p++) {
            particlesRef.current.push({
              x: px + (Math.random() - 0.5) * 8,
              y: nozzleY + 4,
              vx: (Math.random() - 0.5) * 1.5,
              vy: Math.random() * -1.2,
              alpha: 0.55,
              color: "#94a3b8",
              size: 2.5 + Math.random() * 1.5,
            });
          }

          if (itemsRef.current.length > 40) {
            itemsRef.current = itemsRef.current.slice(-30);
          }
        }
      }

      // 1. Draw Dispensers with Vertical Progress Bars
      const pulse = Math.sin(now * 0.012) * 0.35 + 0.65; // 0.3..1.0 pulse for stalled state

      dispenserStates.forEach((state) => {
        const { px, progress, isStalled } = state;
        const pipeW = 28;
        const pipeH = 38;

        // Metallic pipe body
        const grad = ctx.createLinearGradient(px - pipeW / 2, 0, px + pipeW / 2, 0);
        grad.addColorStop(0, "#1e293b");
        grad.addColorStop(0.5, "#334155");
        grad.addColorStop(1, "#0f172a");

        ctx.fillStyle = grad;
        ctx.fillRect(px - pipeW / 2, 0, pipeW, pipeH);

        // Pipe nozzle rim
        ctx.fillStyle = isStalled ? "#450a0a" : "#022c22";
        ctx.fillRect(px - pipeW / 2 - 3, pipeH - 2, pipeW + 6, 6);

        // Progress Bar Slot (Vertical capsule)
        const barSlotW = 9;
        const barSlotH = 24;
        const barSlotX = px - barSlotW / 2;
        const barSlotY = 6;

        // Slot background
        ctx.fillStyle = "#090d16";
        ctx.fillRect(barSlotX, barSlotY, barSlotW, barSlotH);
        ctx.strokeStyle = isStalled
          ? `rgba(239, 68, 68, ${pulse})`
          : "rgba(255, 255, 255, 0.18)";
        ctx.lineWidth = 1;
        ctx.strokeRect(barSlotX, barSlotY, barSlotW, barSlotH);

        // Progress Bar Fill (Rises from bottom to top)
        const fillHeight = Math.max(2, Math.floor(barSlotH * progress));
        const fillY = barSlotY + (barSlotH - fillHeight);

        ctx.save();
        if (isStalled) {
          // STALLED: Full bar glowing intense pulsing red
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 10 * pulse;
          ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
          ctx.fillRect(barSlotX + 1, barSlotY + 1, barSlotW - 2, barSlotH - 2);

          // Red LED indicator at nozzle
          ctx.beginPath();
          ctx.arc(px, pipeH + 7, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = "#f87171";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 8;
          ctx.fill();
        } else {
          // CRAFTING: Smooth cyan to emerald fill
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = 4;

          const fillGrad = ctx.createLinearGradient(0, barSlotY + barSlotH, 0, barSlotY);
          fillGrad.addColorStop(0, "#06b6d4");
          fillGrad.addColorStop(1, "#10b981");

          ctx.fillStyle = fillGrad;
          ctx.fillRect(barSlotX + 1, fillY, barSlotW - 2, fillHeight);

          // Green LED indicator at nozzle
          ctx.beginPath();
          ctx.arc(px, pipeH + 7, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = progress >= 0.95 ? "#34d399" : "#059669";
          ctx.fill();
        }
        ctx.restore();
      });

      // 2. Draw Conveyor Belt Frame & Rollers
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, beltY, w, beltHeight);

      // Belt moving treads (continuous smooth scrolling)
      treadOffsetRef.current = (treadOffsetRef.current + beltSpeed) % 24;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 4;
      for (let tx = -24 + treadOffsetRef.current; tx < w; tx += 24) {
        ctx.beginPath();
        ctx.moveTo(tx, beltY + 2);
        ctx.lineTo(tx + 12, beltY + beltHeight - 2);
        ctx.stroke();
      }

      // Belt top metal highlight line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, beltY);
      ctx.lineTo(w, beltY);
      ctx.stroke();

      // Mechanical rollers under belt
      const rollerCount = Math.floor(w / 65);
      for (let r = 0; r <= rollerCount; r++) {
        const rx = 18 + r * 65;
        ctx.beginPath();
        ctx.arc(rx, beltY + beltHeight + 7, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#475569";
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Draw Vault Box on the Right
      const vGrad = ctx.createLinearGradient(vaultX, beltY - 52, vaultX + 56, beltY);
      vGrad.addColorStop(0, "#334155");
      vGrad.addColorStop(0.5, "#1e293b");
      vGrad.addColorStop(1, "#090d16");

      ctx.fillStyle = vGrad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(vaultX, beltY - 52, 58, 54, 10) : ctx.fillRect(vaultX, beltY - 52, 58, 54);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Vault slot entrance
      ctx.fillStyle = "#020617";
      ctx.fillRect(vaultX - 2, beltY - 44, 5, 40);

      // Vault logo text & digital display
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("СЕЙФ", vaultX + 29, beltY - 24);

      // 4. Update and Draw Labubu Items
      const img = imageLoadedRef.current;
      const remainingItems: ItemPhys[] = [];

      // Maintain queue spacing between items on the belt
      const beltItems = itemsRef.current
        .filter((it) => !it.isFalling)
        .sort((a, b) => b.x - a.x);

      for (let b = 1; b < beltItems.length; b++) {
        const ahead = beltItems[b - 1];
        const cur = beltItems[b];
        if (ahead.x - cur.x < MIN_BELT_SPACING) {
          cur.x = ahead.x - MIN_BELT_SPACING;
        }
      }

      for (let i = 0; i < itemsRef.current.length; i++) {
        const item = itemsRef.current[i];

        if (item.isFalling) {
          item.y += item.vy;
          item.vy += 0.65; // gravity

          if (item.y >= groundY) {
            item.y = groundY;
            item.isFalling = false;
            item.scaleY = 0.74; // squash on landing
            item.scaleX = 1.26;
            item.squashTimer = 8;

            // Landing dust particles
            for (let p = 0; p < 3; p++) {
              particlesRef.current.push({
                x: item.x + (Math.random() - 0.5) * 16,
                y: beltY - 2,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -Math.random() * 1.2,
                alpha: 0.5,
                color: "#cbd5e1",
                size: 2,
              });
            }
          }
        } else {
          // Riding on conveyor belt
          item.x += beltSpeed;

          // Squash & stretch spring settling
          if (item.squashTimer > 0) {
            item.squashTimer--;
            item.scaleX += (1.0 - item.scaleX) * 0.25;
            item.scaleY += (1.0 - item.scaleY) * 0.25;
          } else {
            item.scaleX = 1.0;
            item.scaleY = 1.0;
          }

          // Check if entered vault
          if (item.x >= vaultX + 10) {
            // Live supervision bonus: +50% income when watching the factory floor directly!
            const income = Math.max(1, Math.round(currentBaseIncome * 1.5));
            onCoinEarnedRef.current(income);
            playCoinSound();
            triggerHaptic("light");

            // Gold coin flash particles at vault
            for (let g = 0; g < 5; g++) {
              particlesRef.current.push({
                x: vaultX + 12,
                y: beltY - 25 + (Math.random() - 0.5) * 15,
                vx: (Math.random() - 0.5) * 2.5,
                vy: -1.0 - Math.random() * 2.0,
                alpha: 1.0,
                color: "#fbbf24",
                size: 3,
              });
            }

            // Floating reward text
            floatingTextsRef.current.push({
              id: nextIdRef.current++,
              x: vaultX + 24,
              y: beltY - 56,
              text: `+${income} ₽`,
              alpha: 1.0,
            });

            continue; // item collected into safe
          }
        }

        // Draw shadow under Labubu on belt
        if (!item.isFalling) {
          ctx.beginPath();
          ctx.ellipse(item.x, beltY - 2, 13 * item.scaleX, 3, 0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          ctx.fill();
        }

        // Draw Labubu sprite with smooth transforms
        if (img) {
          ctx.save();
          ctx.translate(item.x, item.y);
          ctx.scale(item.scaleX, item.scaleY);
          ctx.drawImage(
            img,
            -spriteSize / 2,
            -spriteSize / 2,
            spriteSize,
            spriteSize
          );
          ctx.restore();
        }

        remainingItems.push(item);
      }

      itemsRef.current = remainingItems;

      // 5. Update and Draw Particles
      const nextParticles: Particle[] = [];
      for (let p = 0; p < particlesRef.current.length; p++) {
        const pt = particlesRef.current[p];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.alpha -= 0.03;

        if (pt.alpha > 0) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fillStyle = pt.color;
          ctx.globalAlpha = Math.max(0, pt.alpha);
          ctx.fill();
          ctx.globalAlpha = 1.0;
          nextParticles.push(pt);
        }
      }
      particlesRef.current = nextParticles;

      // 6. Update and Draw Floating Texts on Canvas
      const remainingTexts: FloatingText[] = [];
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";

      for (let t = 0; t < floatingTextsRef.current.length; t++) {
        const ft = floatingTextsRef.current[t];
        ft.y -= 1.1;
        ft.alpha -= 0.024;

        if (ft.alpha > 0) {
          ctx.fillStyle = `rgba(52, 211, 153, ${Math.max(0, ft.alpha)})`;
          ctx.fillText(ft.text, ft.x, ft.y);
          remainingTexts.push(ft);
        }
      }
      floatingTextsRef.current = remainingTexts;

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <div className="relative w-full h-64 bg-gradient-to-b from-[#111724] via-[#0c101a] to-[#070a10] rounded-3xl p-2 border border-white/10 shadow-inner overflow-hidden flex flex-col justify-end">
      {/* Background industrial texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none" />

      {/* High-Performance 60 FPS HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none select-none pointer-events-none"
      />
    </div>
  );
};
