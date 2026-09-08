"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
  const nextIdRef = useRef(1);
  const animFrameIdRef = useRef<number>(0);
  const imageLoadedRef = useRef<HTMLImageElement | null>(null);
  const treadOffsetRef = useRef(0);

  // Synchronize dynamic props into refs to avoid restarting the 60 FPS animation loop
  const onCoinEarnedRef = useRef(onCoinEarned);
  onCoinEarnedRef.current = onCoinEarned;

  const beltSpeedLevelRef = useRef(beltSpeedLevel);
  beltSpeedLevelRef.current = beltSpeedLevel;

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

  // Drop frequency in ms
  const dropIntervalMs = Math.max(800, 3600 - (dropSpeedLevel - 1) * 280);

  // Periodic dispenser drop spawner with overlap prevention
  useEffect(() => {
    let pipeIndex = 0;

    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const w = canvas.clientWidth;
      if (w <= 0) return;

      // Calculate pipe positions
      const count = dispenserCountRef.current;
      let pipeFractions: number[] = [];
      if (count === 1) pipeFractions = [0.32];
      else if (count === 2) pipeFractions = [0.22, 0.52];
      else if (count === 3) pipeFractions = [0.18, 0.38, 0.60];
      else pipeFractions = [0.15, 0.32, 0.50, 0.68];

      // Find a pipe that has free space underneath (minimum 56px clearance from any figurine)
      let chosenFraction: number | null = null;
      for (let i = 0; i < pipeFractions.length; i++) {
        const candidateIdx = (pipeIndex + i) % pipeFractions.length;
        const frac = pipeFractions[candidateIdx];
        const px = w * frac;

        // Figurine center width is ~48px, require >= 56px to ensure zero overlap
        const isOccupied = itemsRef.current.some(
          (item) => Math.abs(item.x - px) < 56
        );

        if (!isOccupied) {
          chosenFraction = frac;
          pipeIndex = candidateIdx + 1;
          break;
        }
      }

      // Drop only if a clear pipe was found
      if (chosenFraction !== null) {
        const xPos = w * chosenFraction;
        itemsRef.current.push({
          id: nextIdRef.current++,
          x: xPos,
          y: 20, // top pipe exit
          vy: 1.5,
          isFalling: true,
          scaleX: 0.9,
          scaleY: 1.1,
          squashTimer: 0,
        });

        // Cap max items in memory
        if (itemsRef.current.length > 25) {
          itemsRef.current = itemsRef.current.slice(-20);
        }
      }
    }, dropIntervalMs);

    return () => clearInterval(interval);
  }, [dropIntervalMs]);

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

      const currentDispCount = dispenserCountRef.current;
      const currentBeltSpeedLevel = beltSpeedLevelRef.current;
      const currentBaseIncome = baseIncomePerDropRef.current;

      // Belt coordinates
      const beltY = h - 60;
      const beltHeight = 24;
      const vaultX = w - 65;
      const beltSpeed = 1.2 + (currentBeltSpeedLevel - 1) * 0.35;

      // 1. Draw Pipes at top
      let pipeFractions: number[] = [];
      if (currentDispCount === 1) pipeFractions = [0.32];
      else if (currentDispCount === 2) pipeFractions = [0.22, 0.52];
      else if (currentDispCount === 3) pipeFractions = [0.18, 0.38, 0.60];
      else pipeFractions = [0.15, 0.32, 0.50, 0.68];

      pipeFractions.forEach((frac) => {
        const px = w * frac;
        // Pipe body
        const grad = ctx.createLinearGradient(px - 14, 0, px + 14, 0);
        grad.addColorStop(0, "#475569");
        grad.addColorStop(0.5, "#94a3b8");
        grad.addColorStop(1, "#334155");

        ctx.fillStyle = grad;
        ctx.fillRect(px - 14, 0, 28, 42);

        // Pipe rim
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(px - 17, 38, 34, 8);

        // Pressure dial
        ctx.beginPath();
        ctx.arc(px, 20, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#0f172a";
        ctx.fill();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1.5;
        ctx.stroke();
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
      const rollerCount = Math.floor(w / 70);
      for (let r = 0; r <= rollerCount; r++) {
        const rx = 20 + r * 70;
        ctx.beginPath();
        ctx.arc(rx, beltY + beltHeight + 8, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#475569";
        ctx.fill();
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Draw Vault Box on the Right
      const vGrad = ctx.createLinearGradient(vaultX, beltY - 50, vaultX + 55, beltY);
      vGrad.addColorStop(0, "#334155");
      vGrad.addColorStop(0.5, "#1e293b");
      vGrad.addColorStop(1, "#090d16");

      ctx.fillStyle = vGrad;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(vaultX, beltY - 50, 58, 55, 10) : ctx.fillRect(vaultX, beltY - 50, 58, 55);
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Vault slot entrance
      ctx.fillStyle = "#020617";
      ctx.fillRect(vaultX - 2, beltY - 44, 5, 42);

      // Vault logo text
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("СЕЙФ", vaultX + 30, beltY - 22);

      // 4. Update and Draw Labubu Items
      const img = imageLoadedRef.current;
      const spriteSize = 48;
      const groundY = beltY - spriteSize / 2 + 6;

      const remainingItems: ItemPhys[] = [];

      for (let i = 0; i < itemsRef.current.length; i++) {
        const item = itemsRef.current[i];

        if (item.isFalling) {
          item.y += item.vy;
          item.vy += 0.45; // gravity

          if (item.y >= groundY) {
            item.y = groundY;
            item.isFalling = false;
            item.scaleY = 0.72; // squash on landing
            item.scaleX = 1.25;
            item.squashTimer = 8;
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
          if (item.x >= vaultX + 15) {
            // Realistic vault reward timing: credited precisely as figurine reaches safe
            const income = Math.floor(
              currentBaseIncome * (1 + (currentBeltSpeedLevel - 1) * 0.15)
            );
            onCoinEarnedRef.current(income);
            playCoinSound();
            triggerHaptic("light");

            // Add floating reward text
            floatingTextsRef.current.push({
              id: nextIdRef.current++,
              x: vaultX + 20,
              y: beltY - 55,
              text: `+${income} ₽`,
              alpha: 1.0,
            });

            continue; // item collected
          }
        }

        // Draw shadow under Labubu on belt
        if (!item.isFalling) {
          ctx.beginPath();
          ctx.ellipse(item.x, beltY - 2, 14 * item.scaleX, 3, 0, 0, Math.PI * 2);
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

      // 5. Update and Draw Floating Texts on Canvas
      const remainingTexts: FloatingText[] = [];
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";

      for (let t = 0; t < floatingTextsRef.current.length; t++) {
        const ft = floatingTextsRef.current[t];
        ft.y -= 1.0;
        ft.alpha -= 0.025;

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

      {/* Top Banner Tag */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-[10px] text-white/70 backdrop-blur-md">
        <Sparkles size={11} className="text-amber-400" />
        <span>Этаж {floorNumber} • {dispenserCount} автомата</span>
      </div>

      {/* High-Performance 60 FPS HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none select-none pointer-events-none"
      />
    </div>
  );
};
