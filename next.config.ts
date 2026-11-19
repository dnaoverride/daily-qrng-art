import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["dnaoverride.noip.me"],
  serverExternalPackages: ["@napi-rs/canvas", "mysql2", "bcryptjs"],
  poweredByHeader: false,
  compress: false,
  async headers() {
    // Samo produkcija: tamo su imena chunk-ova content-hash-ovana, pa je immutable bezbedan.
    // U dev-u (Turbopack) imena NISU hash sadržaja — immutable bi zaglavio stari JS u browseru.
    if (process.env.NODE_ENV !== "production") return [];
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
    ];
  },
};

export default withNextIntl(nextConfig);
