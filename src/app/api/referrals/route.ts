export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramIdStr = searchParams.get("telegramId");

    if (!telegramIdStr) {
      return NextResponse.json({ error: "Missing telegramId" }, { status: 400 });
    }

    const tId = BigInt(telegramIdStr);
    const user = await prisma.user.findUnique({
      where: { telegramId: tId },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const referredUsers = await prisma.user.findMany({
      where: { referrerId: user.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        clickLevel: true,
        balance: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "labubu_tapalka_bot";
    const refLink = `https://t.me/${botUsername}?start=ref_${user.telegramId}`;

    return NextResponse.json({
      refLink,
      referralCount: user.referralCount,
      referralEarnings: user.referralEarnings,
      friends: referredUsers.map((f) => ({
        id: f.id,
        name: f.username ? `@${f.username}` : f.firstName || "Друг",
        level: f.clickLevel,
        balance: f.balance,
        date: f.createdAt,
      })),
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/referrals:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
