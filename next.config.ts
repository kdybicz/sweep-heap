import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.E2E_SERVER === "1" ? ".next-e2e" : ".next",
  typescript: {
    tsconfigPath: process.env.E2E_SERVER === "1" ? "tsconfig.e2e.json" : "tsconfig.json",
  },
};

export default nextConfig;
