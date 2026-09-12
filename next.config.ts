import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions bodies carry evidence photos; raise the default 1 MB cap.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
