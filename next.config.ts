import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["@vercel/sandbox"],
  outputFileTracingIncludes: {
    "/api/sandbox": ["./lib/kayra-bridge.mjs"],
  },
};

export default nextConfig;
