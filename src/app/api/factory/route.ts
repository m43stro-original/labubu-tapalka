export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FLOOR_CONFIGS } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, action, floorNumber } = body;

    if (!telegramId || !action || typeof floorNumber !== "number") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const tId = BigInt(telegramId);
    const user = await prisma.user.findUnique({
      where: { telegramId: tId },
      include: { floors: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const floor = user.floors.find((f) => f.floorNumber === floorNumber);
    if (!floor) {
      return NextResponse.json({ error: "Этаж не найден" }, { status: 404 });
    }

    const floorConfig = FLOOR_CONFIGS[floorNumber - 1];
    if (!floorConfig) {
      return NextResponse.json({ error: "Конфигурация этажа не найдена" }, { status: 404 });
    }

    let cost = 0;
    const floorUpdates: Record<string, unknown> = {};

    if (action === "unlock_floor") {
      if (floor.isUnlocked) {
        return NextResponse.json({ error: "Этаж уже открыт" }, { status: 400 });
      }

      cost = floorConfig.unlockCost;
      if (user.balance < cost) {
        return NextResponse.json(
          { error: `Для открытия этажа нужно ${cost} ₽` },
          { status: 400 }
        );
      }

      floorUpdates.isUnlocked = true;
    } else if (action === "upgrade_belt_speed") {
      if (!floor.isUnlocked) {
        return NextResponse.json({ error: "Сначала откройте этот этаж" }, { status: 400 });
      }
      if (floor.beltSpeedLevel >= 10) {
        return NextResponse.json({ error: "Максимальная скорость ленты достигнута" }, { status: 400 });
      }

      const baseCost = Math.max(100, Math.floor(floorConfig.baseIncomePerDrop * 40));
      cost = Math.floor(baseCost * Math.pow(1.42, floor.beltSpeedLevel - 1));

      if (user.balance < cost) {
        return NextResponse.json(
          { error: `Для ускорения конвейера нужно ${cost} ₽` },
          { status: 400 }
        );
      }

      floorUpdates.beltSpeedLevel = floor.beltSpeedLevel + 1;
    } else if (action === "upgrade_drop_speed") {
      if (!floor.isUnlocked) {
        return NextResponse.json({ error: "Сначала откройте этот этаж" }, { status: 400 });
      }
      if (floor.dropSpeedLevel >= 10) {
        return NextResponse.json({ error: "Максимальная скорость создания достигнута" }, { status: 400 });
      }

      const baseCost = Math.max(150, Math.floor(floorConfig.baseIncomePerDrop * 55));
      cost = Math.floor(baseCost * Math.pow(1.5, floor.dropSpeedLevel - 1));

      if (user.balance < cost) {
        return NextResponse.json(
          { error: `Для ускорения сборки нужно ${cost} ₽` },
          { status: 400 }
        );
      }

      floorUpdates.dropSpeedLevel = floor.dropSpeedLevel + 1;
    } else if (action === "upgrade_dispenser") {
      if (!floor.isUnlocked) {
        return NextResponse.json({ error: "Сначала откройте этот этаж" }, { status: 400 });
      }
      if (floor.dispenserCount >= 4) {
        return NextResponse.json({ error: "Максимум 4 автомата на конвейере" }, { status: 400 });
      }

      const baseCost = Math.max(300, Math.floor(floorConfig.baseIncomePerDrop * 120));
      cost = Math.floor(baseCost * Math.pow(3.2, floor.dispenserCount - 1));

      if (user.balance < cost) {
        return NextResponse.json(
          { error: `Для установки еще одного автомата нужно ${cost} ₽` },
          { status: 400 }
        );
      }

      floorUpdates.dispenserCount = floor.dispenserCount + 1;
    } else {
      return NextResponse.json({ error: "Неизвестное действие фабрики" }, { status: 400 });
    }

    // Atomic update
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { balance: { decrement: cost } },
        include: { floors: { orderBy: { floorNumber: "asc" } } },
      }),
      prisma.conveyorFloor.update({
        where: { id: floor.id },
        data: floorUpdates,
      }),
    ]);

    // Refetch refreshed floors
    const refreshedFloors = await prisma.conveyorFloor.findMany({
      where: { userId: user.id },
      orderBy: { floorNumber: "asc" },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        telegramId: updatedUser.telegramId.toString(),
        floors: refreshedFloors,
      },
      cost,
    });
  } catch (err: unknown) {
    console.error("Error in POST /api/factory:", err);
    return NextResponse.json(
      { error: "Internal server error: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
