import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["dnaoverride.noip.me"],
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
