export interface LevelConfig {
  level: number;
  name: string;
  image: string;
  minBalanceToUnlock: number;
  baseClickPower: number;
  basePassiveIncome: number;
  themeColor: string;
  glowClass: string;
  borderClass: string;
  particleColor: string;
  description: string;
}

export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: "Новичок Labubu",
    image: "/images/1lvl.png",
    minBalanceToUnlock: 0,
    baseClickPower: 1,
    basePassiveIncome: 2,
    themeColor: "#10b981",
    glowClass: "shadow-[0_0_40px_rgba(16,185,129,0.35)]",
    borderClass: "border-emerald-500/40",
    particleColor: "#10b981",
    description: "Первые шаги в мире Лабубу. Начни тапать и собирать первые рубли!",
  },
  {
    level: 2,
    name: "Хулиган Labubu",
    image: "/images/2lvl.png",
    minBalanceToUnlock: 2500,
    baseClickPower: 5,
    basePassiveIncome: 15,
    themeColor: "#84cc16",
    glowClass: "shadow-[0_0_50px_rgba(132,204,22,0.4)]",
    borderClass: "border-lime-500/50",
    particleColor: "#84cc16",
    description: "Дерзкий и быстрый. Приносит значительно больше рублей за каждый клик.",
  },
  {
    level: 3,
    name: "Стиляга Labubu",
    image: "/images/3lvl.png",
    minBalanceToUnlock: 25000,
    baseClickPower: 25,
    basePassiveIncome: 80,
    themeColor: "#06b6d4",
    glowClass: "shadow-[0_0_60px_rgba(6,182,212,0.45)]",
    borderClass: "border-cyan-400/60",
    particleColor: "#06b6d4",
    description: "Модный Лабубу с неоновым блеском. Электрические клики и высокий доход.",
  },
  {
    level: 4,
    name: "Магнат Labubu",
    image: "/images/4lvl.png",
    minBalanceToUnlock: 180000,
    baseClickPower: 120,
    basePassiveIncome: 450,
    themeColor: "#a855f7",
    glowClass: "shadow-[0_0_70px_rgba(168,85,247,0.5)]",
    borderClass: "border-purple-500/60",
    particleColor: "#c084fc",
    description: "Настоящий бизнесмен. Рубли текут рекой, фабрика работает на полную.",
  },
  {
    level: 5,
    name: "Шейх Labubu",
    image: "/images/5lvl.png",
    minBalanceToUnlock: 1200000,
    baseClickPower: 600,
    basePassiveIncome: 2500,
    themeColor: "#f59e0b",
    glowClass: "shadow-[0_0_80px_rgba(245,158,11,0.55)]",
    borderClass: "border-amber-400/70",
    particleColor: "#fbbf24",
    description: "Золотой Лабубу! Огненная аура, роскошь и колоссальный приток рублей.",
  },
  {
    level: 6,
    name: "Олигарх Labubu",
    image: "/images/6lvl.png",
    minBalanceToUnlock: 8000000,
    baseClickPower: 3000,
    basePassiveIncome: 15000,
    themeColor: "#ef4444",
    glowClass: "shadow-[0_0_90px_rgba(239,68,68,0.6)]",
    borderClass: "border-rose-500/70",
    particleColor: "#f87171",
    description: "Хозяин фабрик и конвейеров. Баланс исчисляется миллионами.",
  },
  {
    level: 7,
    name: "Владыка Labubu",
    image: "/images/7lvl.png",
    minBalanceToUnlock: 50000000,
    baseClickPower: 15000,
    basePassiveIncome: 100000,
    themeColor: "#ec4899",
    glowClass: "shadow-[0_0_100px_rgba(236,72,153,0.7)]",
    borderClass: "border-pink-500/80",
    particleColor: "#f472b6",
    description: "Абсолютная вершина эволюции. Радужная сверхновая мощь!",
  },
];

export const FLOOR_CONFIGS = [
  { floor: 1, unlockCost: 500, baseIncomePerDrop: 2, name: "Этаж 1" },
  { floor: 2, unlockCost: 15000, baseIncomePerDrop: 15, name: "Этаж 2" },
  { floor: 3, unlockCost: 120000, baseIncomePerDrop: 80, name: "Этаж 3" },
  { floor: 4, unlockCost: 900000, baseIncomePerDrop: 450, name: "Этаж 4" },
  { floor: 5, unlockCost: 6000000, baseIncomePerDrop: 2500, name: "Этаж 5" },
  { floor: 6, unlockCost: 45000000, baseIncomePerDrop: 15000, name: "Этаж 6" },
  { floor: 7, unlockCost: 250000000, baseIncomePerDrop: 100000, name: "Этаж 7" },
];

export const MAX_OFFLINE_SECONDS = 3 * 3600; // 3 hours
export const MAX_TAPS_PER_SECOND = 20; // Anti-cheat cap
export const CRIT_CHANCE = 0.07; // 7% crit chance
export const CRIT_MULTIPLIER = 5; // 5x
export const FEVER_DURATION_SECONDS = 5;
export const FEVER_MULTIPLIER = 1.25; // Balanced +25% bonus instead of overpowered 2x

export const REFERRAL_BONUS_INVITEE = 1000;
export const REFERRAL_BONUS_INVITER = 5000;
export const REFERRAL_PASSIVE_PERCENT = 0.10; // 10%
