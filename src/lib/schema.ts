import {
  boolean,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("User", {
  id: varchar("id", { length: 191 }).primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  name: varchar("name", { length: 191 }),
  password: varchar("password", { length: 191 }),
  image: varchar("image", { length: 191 }),
  createdAt: datetime("createdAt", { fsp: 3 }).notNull(),
});

export const qrng_pool = mysqlTable(
  "qrng_pool",
  {
    id:        int("id").autoincrement().primaryKey(),
    values:    json("values").notNull().$type<number[]>(),
    fetchedAt: datetime("fetchedAt", { fsp: 3 }).notNull(),
    usedAt:    datetime("usedAt",    { fsp: 3 }),
    used:      boolean("used").notNull().default(false),
  },
  (t) => [index("qrng_pool_used_idx").on(t.used, t.fetchedAt)]
);

export const favorites = mysqlTable(
  "Favorite",
  {
    id: varchar("id", { length: 191 }).primaryKey(),
    userId: varchar("userId", { length: 191 }).notNull(),
    title: varchar("title", { length: 191 }).default("Bez naziva"),
    values: json("values").notNull().$type<number[]>(),
    scenarioName: varchar("scenarioName", { length: 191 }),
    isPublic: boolean("isPublic").notNull().default(false),
    shareToken: varchar("shareToken", { length: 191 }).unique(),
    createdAt: datetime("createdAt", { fsp: 3 }).notNull(),
  },
  (t) => [index("Favorite_userId_idx").on(t.userId)]
);
