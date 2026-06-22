import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  env: {
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
};

export default nextConfig;
