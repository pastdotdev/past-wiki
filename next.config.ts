import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A self-contained server in .next/standalone, which is what the Dockerfile ships.
  output: "standalone",
};

export default nextConfig;
