export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LEVELS } from "@/lib/constants";
import { calculateOfflineEarnings } from "@/lib/game-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, upgradeType } = body;

    if (!telegramId || !upgradeType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tId = BigInt(telegramId);
    let user = await prisma.user.findUnique({
      where: { telegramId: tId },
      include: { floors: { orderBy: { floorNumber: "asc" } } },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Sync any passive earnings up to this moment
    const offlineResult = calculateOfflineEarnings(user.lastPassiveSync, user.floors);
    if (offlineResult.earnedRubles > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: offlineResult.earnedRubles },
          totalEarned: { increment: offlineResult.earnedRubles },
          lastPassiveSync: new Date(),
        },
        include: { floors: { orderBy: { floorNumber: "asc" } } },
      });
    }

    let cost = 0;
    const updates: Record<string, unknown> = {};

    if (upgradeType === "click_power") {
      const curUpgrade = user.clickUpgrade;
      cost = Math.floor(60 * Math.pow(1.52, curUpgrade - 1));

      if (user.balance < cost) {
        return NextResponse.json({ error: "Недостаточно рублей для прокачки клика" }, { status: 400 });
      }

      const powerBonus = Math.max(1, Math.round(user.clickLevel * 1.8));
      updates.balance = user.balance - cost;
      updates.clickUpgrade = curUpgrade + 1;
      updates.clickPower = user.clickPower + powerBonus;
    } else if (upgradeType === "max_energy") {
      const capLevel = Math.floor((user.maxEnergy - 500) / 200) + 1;
      cost = Math.floor(180 * Math.pow(1.58, capLevel - 1));

      if (user.balance < cost) {
        return NextResponse.json({ error: "Недостаточно рублей для запаса энергии" }, { status: 400 });
      }

      updates.balance = user.balance - cost;
      updates.maxEnergy = user.maxEnergy + 200;
      updates.energy = user.energy + 200;
    } else if (upgradeType === "energy_regen") {
      const regenLevel = Math.floor(user.energyRegen - 3) + 1;
      cost = Math.floor(350 * Math.pow(1.68, regenLevel - 1));

      if (user.balance < cost) {
        return NextResponse.json({ error: "Недостаточно рублей для скорости регенерации" }, { status: 400 });
      }

      updates.balance = user.balance - cost;
      updates.energyRegen = user.energyRegen + 1;
    } else if (upgradeType === "level_up") {
      if (user.clickLevel >= 7) {
        return NextResponse.json({ error: "Достигнут максимальный уровень Labubu!" }, { status: 400 });
      }

      const nextLevelIndex = user.clickLevel; // index in 0-based array is currentLevel
      const nextConfig = LEVELS[nextLevelIndex];

      if (!nextConfig) {
        return NextResponse.json({ error: "Уровень не найден" }, { status: 400 });
      }

      cost = nextConfig.minBalanceToUnlock;
      if (user.balance < cost) {
        return NextResponse.json(
          { error: `Для перехода на уровень ${nextConfig.level} нужно ${cost} ₽` },
          { status: 400 }
        );
      }

      updates.balance = user.balance - cost;
      updates.clickLevel = nextConfig.level;
      updates.clickPower = Math.max(user.clickPower, nextConfig.baseClickPower);
    } else {
      return NextResponse.json({ error: "Неизвестный тип прокачки" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      include: { floors: { orderBy: { floorNumber: "asc" } } },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        telegramId: updatedUser.telegramId.toString(),
      },
      cost,
    });
  } catch (err: unknown) {
    console.error("Error in POST /api/upgrade:", err);
    return NextResponse.json(
      { error: "Internal server error: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
