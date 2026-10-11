import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["@aws-app-monetization/sdk"],
  outputFileTracingExcludes: {
    "/*": [".monetize/**", ".env*", ".npmrc", ".aws/**"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
