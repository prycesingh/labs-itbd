import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for pure logic (lib/**). Tests live next to the code they cover
// as *.test.ts. They must not touch the shared production database — keep
// DB access behind injected functions so the logic under test stays pure.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "interview-coach-main/**"],
  },
});
