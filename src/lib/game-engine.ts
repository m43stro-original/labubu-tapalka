import { ConveyorFloor, User } from "@prisma/client";
import {
  FLOOR_CONFIGS,
  MAX_OFFLINE_SECONDS,
  MAX_TAPS_PER_SECOND,
  FEVER_MULTIPLIER,
} from "./constants";

export interface TapValidationResult {
  validatedTaps: number;
  newEnergy: number;
  earnedRubles: number;
  effectiveRegen: number;
}

/**
 * Calculates real-time passive income per second for all unlocked factory floors
 */
export function calculatePassiveIncomePerSecond(floors: ConveyorFloor[]): number {
  let totalPerSec = 0;

  for (const floor of floors) {
    if (!floor.isUnlocked) continue;
    const config = FLOOR_CONFIGS[floor.floorNumber - 1];
    if (!config) continue;

    // Drop interval between 1.0s and 4.0s based on dropSpeedLevel (1..10)
    const dropInterval = Math.max(1.0, 4.0 - (floor.dropSpeedLevel - 1) * 0.32);
    // Belt speed multiplier: 1.0x to 2.35x based on beltSpeedLevel (1..10)
    const beltMultiplier = 1 + (floor.beltSpeedLevel - 1) * 0.15;
    // Dispensers multiplier (1..4 pipes)
    const dispenserMultiplier = floor.dispenserCount;

    const dropsPerSecond = (1 / dropInterval) * dispenserMultiplier * beltMultiplier;
    const floorPerSec = dropsPerSecond * config.baseIncomePerDrop;
    totalPerSec += floorPerSec;
  }

  return totalPerSec;
}

/**
 * Calculates offline earnings safely capped at MAX_OFFLINE_SECONDS
 */
export function calculateOfflineEarnings(
  lastPassiveSync: Date,
  floors: ConveyorFloor[]
): { offlineSeconds: number; earnedRubles: number; passivePerSec: number } {
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - new Date(lastPassiveSync).getTime()) / 1000);
  const cappedSeconds = Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS);
  const passivePerSec = calculatePassiveIncomePerSecond(floors);
  const earnedRubles = Math.floor(cappedSeconds * passivePerSec);

  return {
    offlineSeconds: Math.floor(cappedSeconds),
    earnedRubles,
    passivePerSec,
  };
}

/**
 * Validates tap batches against server-calculated energy recovery and maximum tap rates.
 * Prevents arbitrary mining via curl or scripted API spam.
 */
export function validateTaps(
  user: User,
  clientTapCount: number,
  isFever = false
): TapValidationResult {
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - new Date(user.lastTapSync).getTime()) / 1000);

  // Calculate actual energy regenerated according to server clock
  const regeneratedEnergy = Math.min(
    user.maxEnergy,
    user.energy + elapsedSeconds * user.energyRegen
  );

  // Maximum human/autoclicker taps possible in elapsed time plus currently held energy
  const maxAllowableByTimeAndEnergy = Math.min(
    Math.floor(regeneratedEnergy),
    Math.ceil(elapsedSeconds * MAX_TAPS_PER_SECOND) + Math.floor(user.energy) + 5 // +5 tolerance buffer for latency
  );

  const validatedTaps = Math.max(
    0,
    Math.min(Math.floor(clientTapCount), maxAllowableByTimeAndEnergy)
  );

  const newEnergy = Math.max(0, regeneratedEnergy - validatedTaps);
  const multiplier = isFever ? FEVER_MULTIPLIER : 1;
  const earnedRubles = validatedTaps * user.clickPower * multiplier;

  return {
    validatedTaps,
    newEnergy,
    earnedRubles,
    effectiveRegen: regeneratedEnergy,
  };
}

/**
 * Economic Cost Calculations for Clicker & Factory Upgrades
 */
export function getClickPowerCost(level: number): number {
  return Math.floor(120 * Math.pow(1.62, Math.max(1, level) - 1));
}

export function getMaxEnergyCost(level: number): number {
  return Math.floor(300 * Math.pow(1.68, Math.max(1, level) - 1));
}

export function getEnergyRegenCost(level: number): number {
  return Math.floor(550 * Math.pow(1.78, Math.max(1, level) - 1));
}

export function getBeltSpeedCost(baseIncomePerDrop: number, currentLevel: number): number {
  const baseCost = Math.max(250, Math.floor(baseIncomePerDrop * 80));
  return Math.floor(baseCost * Math.pow(1.55, Math.max(1, currentLevel) - 1));
}

export function getDropSpeedCost(baseIncomePerDrop: number, currentLevel: number): number {
  const baseCost = Math.max(350, Math.floor(baseIncomePerDrop * 120));
  return Math.floor(baseCost * Math.pow(1.65, Math.max(1, currentLevel) - 1));
}

export function getDispenserCost(baseIncomePerDrop: number, currentCount: number): number {
  const baseCost = Math.max(750, Math.floor(baseIncomePerDrop * 250));
  return Math.floor(baseCost * Math.pow(3.5, Math.max(1, currentCount) - 1));
}
