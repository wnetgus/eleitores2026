import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Unique per build — used client-side to detect stale cached JS bundles
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
};

export default nextConfig;
