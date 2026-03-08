import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const baseUrl = process.env.DATABASE_URL ?? "";
const dbUrl =
  baseUrl === ""
    ? undefined
    : baseUrl.includes("?")
      ? `${baseUrl}&connection_limit=3&pool_timeout=10`
      : `${baseUrl}?connection_limit=3&pool_timeout=10`;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(dbUrl && { datasources: { db: { url: dbUrl } } }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;
