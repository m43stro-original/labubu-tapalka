export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { senderTelegramId, targetQuery, amount } = body;

    const numAmount = Number(amount);
    if (!senderTelegramId || !targetQuery || !Number.isFinite(numAmount) || numAmount < 10 || Math.floor(numAmount) !== numAmount) {
      return NextResponse.json({ error: "Некорректная сумма перевода (минимум 10 ₽, целое число)" }, { status: 400 });
    }

    const sId = BigInt(senderTelegramId);
    const sender = await prisma.user.findUnique({
      where: { telegramId: sId },
    });

    if (!sender) {
      return NextResponse.json({ error: "Отправитель не найден" }, { status: 404 });
    }

    if (sender.isBanned) {
      return NextResponse.json({ error: "Ваш аккаунт заблокирован" }, { status: 403 });
    }

    if (sender.balance < numAmount) {
      return NextResponse.json({ error: "Недостаточно рублей на балансе" }, { status: 400 });
    }

    // Clean target query
    const cleanQuery = targetQuery.trim().replace(/^@/, "");

    // Search target by username OR telegramId
    let receiver = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanQuery, mode: "insensitive" } },
          ...(!isNaN(Number(cleanQuery)) ? [{ telegramId: BigInt(cleanQuery) }] : []),
        ],
      },
    });

    if (!receiver) {
      return NextResponse.json({ error: "Получатель не найден. Проверьте @username или ID." }, { status: 404 });
    }

    if (receiver.id === sender.id) {
      return NextResponse.json({ error: "Нельзя переводить рубли самому себе" }, { status: 400 });
    }

    if (receiver.isBanned) {
      return NextResponse.json({ error: "Получатель заблокирован" }, { status: 403 });
    }

    // Fully ACID atomic transfer transaction: guarantees rollback on any network or DB failure
    const result = await prisma.$transaction(async (tx) => {
      const senderLock = await tx.user.updateMany({
        where: { id: sender.id, balance: { gte: numAmount } },
        data: { balance: { decrement: numAmount } },
      });

      if (senderLock.count === 0) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const updatedReceiver = await tx.user.update({
        where: { id: receiver.id },
        data: { balance: { increment: numAmount } },
      });

      const transferLog = await tx.transferLog.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          amount: numAmount,
        },
      });

      const updatedSender = await tx.user.findUnique({ where: { id: sender.id } });

      return { updatedReceiver, transferLog, updatedSender };
    });

    return NextResponse.json({
      success: true,
      senderBalance: result.updatedSender?.balance ?? sender.balance - numAmount,
      receiverUsername: result.updatedReceiver.username || result.updatedReceiver.firstName || "Пользователь",
      amount: numAmount,
      transferId: result.transferLog.id,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "INSUFFICIENT_FUNDS") {
      return NextResponse.json({ error: "Недостаточно рублей на балансе" }, { status: 400 });
    }
    console.error("Error in POST /api/transfer:", err);
    return NextResponse.json(
      { error: "Ошибка при переводе: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const transfers = await prisma.transferLog.findMany({
      where: {
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      include: {
        sender: { select: { username: true, firstName: true, telegramId: true } },
        receiver: { select: { username: true, firstName: true, telegramId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      transfers: transfers.map((t) => ({
        id: t.id,
        amount: t.amount,
        createdAt: t.createdAt,
        type: t.senderId === user.id ? "out" : "in",
        otherParty:
          t.senderId === user.id
            ? t.receiver.username || t.receiver.firstName || t.receiver.telegramId.toString()
            : t.sender.username || t.sender.firstName || t.sender.telegramId.toString(),
      })),
    });
  } catch (err: unknown) {
    console.error("Error in GET /api/transfer:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
