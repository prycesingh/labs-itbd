import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import * as path from "path";

// Force Drizzle to load .env.local
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  dialect: "mysql",
  schema: [
    "./DB/schema.ts",
    "./DB/interviewSchema.ts",
    "./DB/emailAssessmentSchema.ts",
    "./DB/labsSchema.ts",
  ],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // MariaDB compatibility: skip check constraint introspection
  introspect: {
    casing: "preserve",
  },
  migrations: {
    table: "__drizzle_migrations__",
  },
  breakpoints: true,
  verbose: true,
  strict: true,
});
