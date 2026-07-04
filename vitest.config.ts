import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      AUTH_URL: "http://localhost:3000",
      SMTP_HOST: "localhost",
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
