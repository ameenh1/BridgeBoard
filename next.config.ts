import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up looking for a
  // lockfile and can latch onto an unrelated one outside the repo.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
