import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["dnaoverride.noip.me"],
  output: "standalone",
  async rewrites() {
    return [
      { source: "/next/:path*", destination: "/_next/:path*" },
    ];
  },
};

export default nextConfig;
