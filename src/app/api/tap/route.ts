export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTaps, calculateOfflineEarnings } from "@/lib/game-engine";
import { REFERRAL_PASSIVE_PERCENT } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, tapCount, isFever } = body;

    if (!telegramId || typeof tapCount !== "number" || tapCount <= 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const tId = BigInt(telegramId);
    const user = await prisma.user.findUnique({
      where: { telegramId: tId },
      include: { floors: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isBanned) {
      return NextResponse.json({ error: "Account is banned" }, { status: 403 });
    }

    // Anti-cheat validation: limits taps to actual energy regenerated + allowable tap frequency
    const validation = validateTaps(user, tapCount, Boolean(isFever));

    // Concurrently credit passive earnings so server balance stays 100% in sync with client!
    const passiveResult = calculateOfflineEarnings(user.lastPassiveSync, user.floors || []);
    const totalEarned = validation.earnedRubles + passiveResult.earnedRubles;

    if (user.referrerId && passiveResult.earnedRubles > 0) {
      const refBonus = Math.floor(passiveResult.earnedRubles * REFERRAL_PASSIVE_PERCENT);
      if (refBonus > 0) {
        prisma.user.update({
          where: { id: user.referrerId },
          data: {
            balance: { increment: refBonus },
            totalEarned: { increment: refBonus },
            referralEarnings: { increment: refBonus },
          },
        }).catch((e) => console.error("Referral tap cut error:", e));
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: totalEarned },
        totalEarned: { increment: totalEarned },
        energy: validation.newEnergy,
        lastTapSync: new Date(),
        lastPassiveSync: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      validatedTaps: validation.validatedTaps,
      earnedRubles: validation.earnedRubles,
      passiveEarned: passiveResult.earnedRubles,
      balance: updatedUser.balance,
      energy: validation.newEnergy,
      maxEnergy: updatedUser.maxEnergy,
    });
  } catch (err: unknown) {
    console.error("Error in POST /api/tap:", err);
    return NextResponse.json(
      { error: "Internal server error: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
