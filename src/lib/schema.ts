import {
  boolean,
  datetime,
  index,
  json,
  mysqlTable,
  text,
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
