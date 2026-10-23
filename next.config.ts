import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev only: lets a phone on the same network load the dev server (HMR + /_next/* are blocked for other hosts).
  allowedDevOrigins: ["172.20.10.*", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
