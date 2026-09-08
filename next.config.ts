import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local-only OS: no image optimization CDN needed
  images: { unoptimized: true },
  experimental: {
    // Keep server actions available for future mutations
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
