export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramIdStr = searchParams.get("telegramId");

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // 1. Auto-expire open duels older than 60s and refund creators
    const expiredDuels = await prisma.duel.findMany({
      where: {
        status: "OPEN",
        createdAt: { lt: oneMinuteAgo },
      },
    });

    for (const exp of expiredDuels) {
      await prisma.$transaction([
        prisma.duel.update({
          where: { id: exp.id },
          data: { status: "EXPIRED" },
        }),
        prisma.user.update({
          where: { id: exp.creatorId },
          data: { balance: { increment: exp.betAmount } },
        }),
      ]);
    }

    const openDuels = await prisma.duel.findMany({
      where: {
        status: "OPEN",
        createdAt: { gte: oneMinuteAgo },
      },
      include: {
        creator: { select: { username: true, firstName: true, telegramId: true, clickLevel: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    let userDuels: any[] = [];
    let currentUser: any = null;
    if (telegramIdStr) {
      const tId = BigInt(telegramIdStr);
      currentUser = await prisma.user.findUnique({ where: { telegramId: tId } });
      if (currentUser) {
        userDuels = await prisma.duel.findMany({
          where: {
            OR: [{ creatorId: currentUser.id }, { opponentId: currentUser.id }],
            status: "FINISHED",
          },
          include: {
            creator: { select: { username: true, firstName: true } },
            opponent: { select: { username: true, firstName: true } },
            winner: { select: { username: true, firstName: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });
      }
    }

    return NextResponse.json({
      openDuels: openDuels.map((d) => ({
        id: d.id,
        betAmount: d.betAmount,
        gameType: d.gameType,
        createdAt: d.createdAt,
        timeLeftSeconds: Math.max(0, Math.floor(60 - (Date.now() - new Date(d.createdAt).getTime()) / 1000)),
        creator: {
          username: d.creator.username || d.creator.firstName || "Игрок",
          telegramId: d.creator.telegramId.toString(),
          level: d.creator.clickLevel,
        },
      })),
      userDuels: userDuels.map((d) => ({
        id: d.id,
        betAmount: d.betAmount,
        gameType: d.gameType,
        winnerId: d.winnerId,
        isWin: currentUser ? d.winnerId === currentUser.id : false,
        resultData: d.resultData ? JSON.parse(d.resultData) : null,
      })),
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/duels:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, action, betAmount, gameType, duelId } = body;

    if (!telegramId || !action) {
      return NextResponse.json({ error: "Некорректные параметры" }, { status: 400 });
    }

    const tId = BigInt(telegramId);
    const user = await prisma.user.findUnique({
      where: { telegramId: tId },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (user.isBanned) {
      return NextResponse.json({ error: "Пользователь заблокирован" }, { status: 403 });
    }

    // 1. CREATE DUEL
    if (action === "create") {
      const numBet = Number(betAmount);
      if (isNaN(numBet) || numBet <= 0) {
        return NextResponse.json({ error: "Некорректная ставка" }, { status: 400 });
      }
      if (user.balance < numBet) {
        return NextResponse.json({ error: "Недостаточно рублей для ставки" }, { status: 400 });
      }

      const [updatedUser, duel] = await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { balance: { decrement: numBet } },
        }),
        prisma.duel.create({
          data: {
            creatorId: user.id,
            gameType: gameType === "DICE" ? "DICE" : "COIN",
            betAmount: numBet,
            status: "OPEN",
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        duelId: duel.id,
        balance: updatedUser.balance,
      });
    }

    // 2. JOIN EXISTING DUEL
    if (action === "join") {
      if (!duelId) {
        return NextResponse.json({ error: "Missing duelId" }, { status: 400 });
      }

      const duel = await prisma.duel.findUnique({
        where: { id: duelId },
        include: { creator: true },
      });

      if (!duel || duel.status !== "OPEN") {
        return NextResponse.json({ error: "Дуэль уже недоступна или завершена" }, { status: 400 });
      }

      // 60-second limit check
      if (new Date(duel.createdAt).getTime() < Date.now() - 60 * 1000) {
        await prisma.$transaction([
          prisma.duel.update({
            where: { id: duel.id },
            data: { status: "EXPIRED" },
          }),
          prisma.user.update({
            where: { id: duel.creatorId },
            data: { balance: { increment: duel.betAmount } },
          }),
        ]);
        return NextResponse.json({ error: "Время лобби истекло (1 минута)" }, { status: 400 });
      }

      if (duel.creatorId === user.id) {
        return NextResponse.json({ error: "Нельзя играть против самого себя" }, { status: 400 });
      }

      if (user.balance < duel.betAmount) {
        return NextResponse.json({ error: "Недостаточно рублей для принятия ставки" }, { status: 400 });
      }

      // Calculate duel outcome
      let winnerId = user.id;
      let resultData: Record<string, any> = {};

      if (duel.gameType === "COIN") {
        // 50/50 coin flip: 0 = Heads (Creator wins), 1 = Tails (Challenger wins)
        const coin = Math.random() < 0.5 ? "HEADS" : "TAILS";
        winnerId = coin === "HEADS" ? duel.creatorId : user.id;
        resultData = { coin, winnerSide: coin === "HEADS" ? "creator" : "opponent" };
      } else {
        // DICE: 2 dice for each player (2..12)
        const d1_c = Math.floor(Math.random() * 6) + 1;
        const d2_c = Math.floor(Math.random() * 6) + 1;
        const scoreCreator = d1_c + d2_c;

        let d1_o = Math.floor(Math.random() * 6) + 1;
        let d2_o = Math.floor(Math.random() * 6) + 1;
        let scoreOpponent = d1_o + d2_o;

        if (scoreCreator === scoreOpponent) {
          // Break ties
          scoreCreator > 6 ? scoreOpponent-- : scoreOpponent++;
        }

        winnerId = scoreCreator > scoreOpponent ? duel.creatorId : user.id;
        resultData = {
          creatorRoll: [d1_c, d2_c],
          creatorTotal: scoreCreator,
          opponentRoll: [d1_o, d2_o],
          opponentTotal: scoreOpponent,
        };
      }

      const prizePool = duel.betAmount * 2;

      // Optimistic lock: ensure status is STILL "OPEN" before accepting
      const duelLock = await prisma.duel.updateMany({
        where: { id: duel.id, status: "OPEN" },
        data: {
          opponentId: user.id,
          status: "FINISHED",
          winnerId,
          resultData: JSON.stringify(resultData),
        },
      });

      if (duelLock.count === 0) {
        return NextResponse.json({ error: "Дуэль уже принята другим игроком" }, { status: 400 });
      }

      // Atomic balance update
      await prisma.$transaction([
        // Deduct bet from challenger
        prisma.user.update({
          where: { id: user.id },
          data: { balance: { decrement: duel.betAmount } },
        }),
        // Award prize pool to winner
        prisma.user.update({
          where: { id: winnerId },
          data: {
            balance: { increment: prizePool },
            totalEarned: { increment: prizePool },
          },
        }),
      ]);

      const isUserWinner = winnerId === user.id;

      return NextResponse.json({
        success: true,
        duelId: duel.id,
        isWinner: isUserWinner,
        winnerId,
        prize: prizePool,
        gameType: duel.gameType,
        resultData,
      });
    }

    // 3. CANCEL OPEN DUEL & REFUND (Before 60 seconds)
    if (action === "cancel") {
      if (!duelId) {
        return NextResponse.json({ error: "Missing duelId" }, { status: 400 });
      }

      // Optimistic cancel lock: ensure duel is still OPEN and belongs to creator
      const duelCancel = await prisma.duel.updateMany({
        where: { id: duelId, status: "OPEN", creatorId: user.id },
        data: { status: "CANCELLED" },
      });

      if (duelCancel.count === 0) {
        return NextResponse.json({ error: "Лобби уже закрыто или принято другим игроком" }, { status: 400 });
      }

      const duel = await prisma.duel.findUnique({ where: { id: duelId } });
      const refundAmount = duel ? duel.betAmount : 0;

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { balance: { increment: refundAmount } },
      });

      return NextResponse.json({
        success: true,
        balance: updatedUser.balance,
      });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Error in POST /api/duels:", err);
    return NextResponse.json(
      { error: "Internal server error: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
