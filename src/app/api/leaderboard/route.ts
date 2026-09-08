export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePassiveIncomePerSecond } from "@/lib/game-engine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "balance";
    const telegramIdStr = searchParams.get("telegramId");

    let leaders: any[] = [];
    let userRank = -1;

    if (type === "referrals") {
      leaders = await prisma.user.findMany({
        where: { isBanned: false },
        orderBy: { referralCount: "desc" },
        take: 50,
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          photoUrl: true,
          clickLevel: true,
          referralCount: true,
          balance: true,
        },
      });
    } else if (type === "factory") {
      const usersWithFloors = await prisma.user.findMany({
        where: { isBanned: false },
        include: { floors: true },
        take: 100,
      });

      const mapped = usersWithFloors.map((u) => ({
        id: u.id,
        telegramId: u.telegramId,
        username: u.username,
        firstName: u.firstName,
        photoUrl: u.photoUrl,
        clickLevel: u.clickLevel,
        passivePerSec: calculatePassiveIncomePerSecond(u.floors),
        balance: u.balance,
      }));

      mapped.sort((a, b) => b.passivePerSec - a.passivePerSec);
      leaders = mapped.slice(0, 50);
    } else {
      // Default: By Balance
      leaders = await prisma.user.findMany({
        where: { isBanned: false },
        orderBy: { balance: "desc" },
        take: 50,
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          photoUrl: true,
          clickLevel: true,
          balance: true,
          totalEarned: true,
        },
      });
    }

    if (telegramIdStr) {
      const tId = BigInt(telegramIdStr);
      const foundIdx = leaders.findIndex((l) => l.telegramId === tId);
      userRank = foundIdx !== -1 ? foundIdx + 1 : 99;
    }

    return NextResponse.json({
      leaders: leaders.map((l, index) => ({
        rank: index + 1,
        id: l.id,
        telegramId: l.telegramId.toString(),
        name: l.username ? `@${l.username}` : l.firstName || "Игрок Labubu",
        photoUrl: l.photoUrl || null,
        clickLevel: l.clickLevel,
        balance: l.balance,
        referralCount: l.referralCount ?? 0,
        passivePerSec: l.passivePerSec ?? 0,
      })),
      userRank,
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/leaderboard:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
