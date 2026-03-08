import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool: mysql.Pool | undefined };

// Strip any Prisma-specific query params from the URL
const rawUrl = process.env.DATABASE_URL ?? "";
const baseUrl = rawUrl.split("?")[0];

// mysql2 createPool: pass URI string + query params (uri in object can be flaky)
const poolUrl =
  baseUrl || "mysql://localhost:3306/mydb";
const pool =
  globalForDb.pool ??
  mysql.createPool(
    `${poolUrl}${poolUrl.includes("?") ? "&" : "?"}connectionLimit=2&connectTimeout=30000`
  );

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });
