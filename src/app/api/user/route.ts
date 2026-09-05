export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateOfflineEarnings } from "@/lib/game-engine";
import { FLOOR_CONFIGS, REFERRAL_BONUS_INVITEE, REFERRAL_BONUS_INVITER } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramIdStr = searchParams.get("telegramId");
    const username = searchParams.get("username") || undefined;
    const firstName = searchParams.get("firstName") || undefined;
    const refCode = searchParams.get("ref"); // referrer telegramId if invited

    if (!telegramIdStr) {
      return NextResponse.json({ error: "Missing telegramId" }, { status: 400 });
    }

    const telegramId = BigInt(telegramIdStr);

    let user = await prisma.user.findUnique({
      where: { telegramId },
      include: { floors: { orderBy: { floorNumber: "asc" } } },
    });

    // Create new user if not exists
    if (!user) {
      let startingBalance = 100;
      let referrerId: string | null = null;

      // Check referral invitation
      if (refCode && refCode !== telegramIdStr) {
        try {
          const referrerTelegramId = BigInt(refCode);
          const referrer = await prisma.user.findUnique({
            where: { telegramId: referrerTelegramId },
          });
          if (referrer) {
            referrerId = referrer.id;
            startingBalance += REFERRAL_BONUS_INVITEE;
            // Reward referrer
            await prisma.user.update({
              where: { id: referrer.id },
              data: {
                balance: { increment: REFERRAL_BONUS_INVITER },
                totalEarned: { increment: REFERRAL_BONUS_INVITER },
                referralCount: { increment: 1 },
                referralEarnings: { increment: REFERRAL_BONUS_INVITER },
              },
            });
          }
        } catch {
          // Ignore invalid referral code
        }
      }

      user = await prisma.user.create({
        data: {
          telegramId,
          username,
          firstName,
          balance: startingBalance,
          totalEarned: startingBalance,
          clickLevel: 1,
          clickPower: 1,
          energy: 500,
          maxEnergy: 500,
          energyRegen: 3,
          referrerId,
          floors: {
            create: FLOOR_CONFIGS.map((f) => ({
              floorNumber: f.floor,
              isUnlocked: false,
              beltSpeedLevel: 1,
              dropSpeedLevel: 1,
              dispenserCount: 1,
            })),
          },
        },
        include: { floors: { orderBy: { floorNumber: "asc" } } },
      });
    }

    if (user.isBanned) {
      return NextResponse.json(
        { error: "Ваш аккаунт заблокирован администратором." },
        { status: 403 }
      );
    }

    // Calculate offline passive income
    const offlineResult = calculateOfflineEarnings(user.lastPassiveSync, user.floors);

    // Calculate energy regenerated since last sync
    const now = new Date();
    const elapsedSec = (now.getTime() - new Date(user.lastTapSync).getTime()) / 1000;
    const currentEnergy = Math.min(user.maxEnergy, user.energy + elapsedSec * user.energyRegen);

    // If offline earnings accrued, credit them
    if (offlineResult.earnedRubles > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: offlineResult.earnedRubles },
          totalEarned: { increment: offlineResult.earnedRubles },
          energy: currentEnergy,
          lastPassiveSync: now,
          lastTapSync: now,
        },
        include: { floors: { orderBy: { floorNumber: "asc" } } },
      });
    }

    return NextResponse.json({
      user: {
        ...user,
        telegramId: user.telegramId.toString(),
        energy: currentEnergy,
      },
      offlineEarnings: offlineResult.earnedRubles,
      offlineSeconds: offlineResult.offlineSeconds,
      passivePerSec: offlineResult.passivePerSec,
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/user:", err);
    return NextResponse.json(
      { error: "Internal server error: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
