import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "video.twimg.com",
        pathname: "/**",
      },
    ],
    formats: ["image/webp"],
    minimumCacheTTL: 14_400,
  },
};

export default nextConfig;
