import { config } from "dotenv";
config(); // .env
config({ path: ".env.local" }); // .env.local (overrides)
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "mysql://localhost:3306/mydb",
  },
});
