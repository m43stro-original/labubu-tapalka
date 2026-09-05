export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Ping PostgreSQL
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
