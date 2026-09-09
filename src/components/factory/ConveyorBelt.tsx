"use client";

import React, { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { playCoinSound, triggerHaptic } from "@/lib/sound-fx";

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

      // Kinematic constants for 100% collision-free, packed flow
      const spriteSize = 44;
      const SLOT_WIDTH = 50; // Minimum center-to-center distance (44px sprite + 6px gap)
      const beltY = h - 56;
      const beltHeight = 22;
      const groundY = beltY - 16;
      const nozzleY = 36;
      const vaultX = w - 62;

      // Belt speed scaling across 10 levels (px per frame)
      const beltSpeed = 1.1 + (currentBeltSpeedLevel - 1) * 0.38;

      // Production cadence: level 1 = 1350ms, level 10 = 480ms
      const dropIntervalMs = Math.max(
        480,
        Math.floor(1350 * Math.pow(0.895, currentDropSpeedLevel - 1))
      );

      // Total fall duration in frames (distance ~135px with vy=2.8, g=0.55)
      const FALL_FRAMES = 18;

      // Pipe coordinates evenly distributed across working portion of belt
      let pipeFractions: number[] = [];
      if (currentDispCount === 1) pipeFractions = [0.35];
      else if (currentDispCount === 2) pipeFractions = [0.22, 0.52];
      else if (currentDispCount === 3) pipeFractions = [0.16, 0.36, 0.56];
      else pipeFractions = [0.14, 0.29, 0.44, 0.59];

      // Track blockage status per dispenser for HUD and LED status
      const blockedPipes: boolean[] = new Array(pipeFractions.length).fill(false);

      // Evaluate drop eligibility for each dispenser
      for (let i = 0; i < pipeFractions.length; i++) {
        const px = w * pipeFractions[i];

        // 1. Predictive Collision Check
        // Evaluates whether any figurine currently falling or riding on the belt
        // will occupy the landing zone [px - SLOT_WIDTH, px + SLOT_WIDTH] at any time
        // between now (t=0) and landing time (t=FALL_FRAMES).
        let isBlocked = false;

        for (const item of itemsRef.current) {
          if (item.isFalling) {
            if (Math.abs(item.x - px) < SLOT_WIDTH) {
              isBlocked = true;
              break;
            }
          } else {
            // Riding on belt moving right: interval of item's presence during fall
            // Overlaps pipe zone if item.x <= px + SLOT_WIDTH && item.x + beltSpeed*FALL_FRAMES >= px - SLOT_WIDTH
            const willIntersect =
              item.x <= px + SLOT_WIDTH &&
              item.x + beltSpeed * FALL_FRAMES >= px - SLOT_WIDTH;

            if (willIntersect) {
              isBlocked = true;
              break;
            }
          }
        }

        blockedPipes[i] = isBlocked;

        if (lastDropTimesRef.current[i] === undefined) {
          // Stagger initial dispenser firing smoothly
          lastDropTimesRef.current[i] = now - (i * (dropIntervalMs / currentDispCount));
        }

        const timeSinceLastDrop = now - lastDropTimesRef.current[i];

        // Only drop if timer is ready AND landing zone is guaranteed 100% clear
        if (timeSinceLastDrop >= dropIntervalMs && !isBlocked) {
          lastDropTimesRef.current[i] = now;
          itemsRef.current.push({
            id: nextIdRef.current++,
            x: px,
            y: nozzleY,
            vy: 2.8,
            isFalling: true,
            scaleX: 0.88,
            scaleY: 1.15,
            squashTimer: 0,
          });

          // Small steam puff on dispenser drop
          for (let p = 0; p < 3; p++) {
            particlesRef.current.push({
              x: px + (Math.random() - 0.5) * 8,
              y: nozzleY + 6,
              vx: (Math.random() - 0.5) * 1.5,
              vy: Math.random() * -1.5,
              alpha: 0.6,
              color: "#94a3b8",
              size: 2.5 + Math.random() * 2,
            });
          }

          // Safety buffer
          if (itemsRef.current.length > 40) {
            itemsRef.current = itemsRef.current.slice(-30);
          }
        }
      }

      // 1. Draw Pipes with glowing status LEDs and Waiting tags
      pipeFractions.forEach((frac, i) => {
        const px = w * frac;
        const isBlocked = blockedPipes[i];

        // Pipe body
        const grad = ctx.createLinearGradient(px - 14, 0, px + 14, 0);
        grad.addColorStop(0, "#334155");
        grad.addColorStop(0.5, isBlocked ? "#475569" : "#64748b");
        grad.addColorStop(1, "#1e293b");

        ctx.fillStyle = grad;
        ctx.fillRect(px - 13, 0, 26, 36);

        // Pipe rim nozzle
        ctx.fillStyle = isBlocked ? "#450a0a" : "#064e3b";
        ctx.fillRect(px - 16, 34, 32, 6);

        // Status LED ring
        ctx.beginPath();
        ctx.arc(px, 16, 6, 0, Math.PI * 2);
        ctx.fillStyle = isBlocked ? "#7f1d1d" : "#064e3b";
        ctx.fill();
        ctx.strokeStyle = isBlocked ? "#ef4444" : "#10b981";
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Pulsing inner LED dot
        const pulse = Math.sin(now * 0.008) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(px, 16, isBlocked ? 2.5 + pulse * 1.0 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isBlocked ? "#f87171" : "#34d399";
        ctx.fill();

        // Label on pipe
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        if (isBlocked) {
          ctx.fillStyle = "#fca5a5";
          ctx.fillText("ЖДЁТ", px, 30);
        } else {
          ctx.fillStyle = "#86efac";
          ctx.fillText("ГОТОВ", px, 30);
        }
      });

      // 2. Draw Conveyor Belt Frame & Rollers
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, beltY, w, beltHeight);

      // Belt moving treads (continuous smooth scrolling without offset resets)
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

      // Sort items on the belt by x from right to left to prevent overlap queuing
      const beltItems = itemsRef.current
        .filter((it) => !it.isFalling)
        .sort((a, b) => b.x - a.x);

      for (let b = 1; b < beltItems.length; b++) {
        const ahead = beltItems[b - 1];
        const cur = beltItems[b];
        if (ahead.x - cur.x < SLOT_WIDTH) {
          cur.x = ahead.x - SLOT_WIDTH;
        }
      }

      for (let i = 0; i < itemsRef.current.length; i++) {
        const item = itemsRef.current[i];

        if (item.isFalling) {
          item.y += item.vy;
          item.vy += 0.55; // gravity

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
            // Realistic vault reward timing: credited precisely as figurine enters safe
            const income = Math.floor(
              currentBaseIncome * (1 + (currentBeltSpeedLevel - 1) * 0.15)
            );
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

      // 7. Top Traffic / Congestion Status Badge on Canvas
      const isAnyBlocked = blockedPipes.some(Boolean);
      const hudX = w - 12;
      const hudY = 12;

      ctx.save();
      ctx.textAlign = "right";
      ctx.font = "bold 10px sans-serif";

      if (isAnyBlocked) {
        // Red / Amber Congestion alert pill
        ctx.fillStyle = "rgba(245, 158, 11, 0.16)";
        ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(hudX - 160, hudY, 160, 20, 6) : ctx.fillRect(hudX - 160, hudY, 160, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#fbbf24";
        ctx.fillText("⚠️ ЛЕНТА ПЕРЕПОЛНЕНА", hudX - 10, hudY + 14);
      } else {
        // Green Smooth Flow pill
        ctx.fillStyle = "rgba(16, 185, 129, 0.14)";
        ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(hudX - 130, hudY, 130, 20, 6) : ctx.fillRect(hudX - 130, hudY, 130, 20);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#34d399";
        ctx.fillText("⚡ ПОТОК В НОРМЕ", hudX - 10, hudY + 14);
      }
      ctx.restore();

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

      {/* Top Banner Tag */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-[10px] text-white/80 backdrop-blur-md shadow-sm">
        <Sparkles size={11} className="text-amber-400" />
        <span>Этаж {floorNumber} • {dispenserCount} {dispenserCount === 1 ? "автомат" : dispenserCount < 5 ? "автомата" : "автоматов"}</span>
      </div>

      {/* High-Performance 60 FPS HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none select-none pointer-events-none"
      />
    </div>
  );
};
