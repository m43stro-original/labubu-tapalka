export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { senderTelegramId, targetQuery, amount } = body;

    const numAmount = Number(amount);
    if (!senderTelegramId || !targetQuery || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Некорректные параметры перевода" }, { status: 400 });
    }

    if (numAmount < 10) {
      return NextResponse.json({ error: "Минимальная сумма перевода — 10 ₽" }, { status: 400 });
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

    // Atomic transaction
    const [updatedSender, updatedReceiver, transferLog] = await prisma.$transaction([
      prisma.user.update({
        where: { id: sender.id },
        data: { balance: { decrement: numAmount } },
      }),
      prisma.user.update({
        where: { id: receiver.id },
        data: { balance: { increment: numAmount } },
      }),
      prisma.transferLog.create({
        data: {
          senderId: sender.id,
          receiverId: receiver.id,
          amount: numAmount,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      senderBalance: updatedSender.balance,
      receiverUsername: updatedReceiver.username || updatedReceiver.firstName || "Пользователь",
      amount: numAmount,
      transferId: transferLog.id,
    });
  } catch (err: unknown) {
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
