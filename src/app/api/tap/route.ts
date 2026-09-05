export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTaps } from "@/lib/game-engine";

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
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isBanned) {
      return NextResponse.json({ error: "Account is banned" }, { status: 403 });
    }

    // Anti-cheat validation: limits taps to actual energy regenerated + allowable tap frequency
    const validation = validateTaps(user, tapCount, Boolean(isFever));

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: validation.earnedRubles },
        totalEarned: { increment: validation.earnedRubles },
        energy: validation.newEnergy,
        lastTapSync: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      validatedTaps: validation.validatedTaps,
      earnedRubles: validation.earnedRubles,
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
