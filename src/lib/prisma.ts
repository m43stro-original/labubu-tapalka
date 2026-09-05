import { PrismaClient } from "@prisma/client";

// Ensure BigInt serialization in JSON responses
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
