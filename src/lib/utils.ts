import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRubles(amount: number): string {
  const rounded = Math.floor(amount);
  return new Intl.NumberFormat("ru-RU").format(rounded) + " ₽";
}

export function formatCompactRubles(amount: number): string {
  if (amount >= 1_000_000_000) {
    return (amount / 1_000_000_000).toFixed(2) + "B ₽";
  }
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(2) + "M ₽";
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(1) + "K ₽";
  }
  return Math.floor(amount) + " ₽";
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
