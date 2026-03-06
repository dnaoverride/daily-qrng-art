import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["dnaoverride.noip.me"],
  serverExternalPackages: ["@napi-rs/canvas"],
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "X-LiteSpeed-Cache-Control",
            value: "no-cache",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
