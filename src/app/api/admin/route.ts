export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_PIN = process.env.ADMIN_SECRET || "sekret5412";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pin = searchParams.get("pin");
    const search = searchParams.get("search") || "";

    if (pin !== ADMIN_PIN) {
      return NextResponse.json({ error: "Неверный пароль администратора" }, { status: 401 });
    }

    const [totalUsers, totalBalanceAgg, totalDuels, totalTransfers] = await Promise.all([
      prisma.user.count(),
      prisma.user.aggregate({ _sum: { balance: true } }),
      prisma.duel.count(),
      prisma.transferLog.count(),
    ]);

    let userWhere: any = {};
    if (search.trim()) {
      const clean = search.trim().replace(/^@/, "");
      userWhere = {
        OR: [
          { username: { contains: clean, mode: "insensitive" } },
          { firstName: { contains: clean, mode: "insensitive" } },
          ...(!isNaN(Number(clean)) ? [{ telegramId: BigInt(clean) }] : []),
        ],
      };
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        floors: { select: { floorNumber: true, isUnlocked: true } },
      },
    });

    const logs = await prisma.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      stats: {
        totalUsers,
        totalRublesInCirculation: totalBalanceAgg._sum.balance || 0,
        totalDuels,
        totalTransfers,
      },
      users: users.map((u) => ({
        id: u.id,
        telegramId: u.telegramId.toString(),
        username: u.username,
        firstName: u.firstName,
        balance: u.balance,
        clickLevel: u.clickLevel,
        clickPower: u.clickPower,
        energy: u.energy,
        maxEnergy: u.maxEnergy,
        isBanned: u.isBanned,
        referralCount: u.referralCount,
        unlockedFloors: u.floors.filter((f) => f.isUnlocked).length,
        createdAt: u.createdAt,
      })),
      recentLogs: logs,
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/admin:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin, action, targetUserId, amount, reason } = body;

    if (pin !== ADMIN_PIN) {
      return NextResponse.json({ error: "Неверный пароль администратора" }, { status: 401 });
    }

    if (!targetUserId || !action) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const numAmount = Number(amount) || 0;
    let updateData: Record<string, any> = {};

    if (action === "credit") {
      updateData = {
        balance: { increment: numAmount },
        totalEarned: { increment: numAmount },
      };
    } else if (action === "debit") {
      const newBal = Math.max(0, targetUser.balance - numAmount);
      updateData = { balance: newBal };
    } else if (action === "ban") {
      updateData = { isBanned: true };
    } else if (action === "unban") {
      updateData = { isBanned: false };
    } else {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUser.id },
        data: updateData,
      }),
      prisma.adminLog.create({
        data: {
          adminTelegramId: BigInt(77777),
          targetUserId: targetUser.id,
          action: action.toUpperCase(),
          amount: numAmount || null,
          reason: reason || "Admin Action",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        telegramId: updatedUser.telegramId.toString(),
      },
    });
  } catch (err: unknown) {
    console.error("Error in POST /api/admin:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
