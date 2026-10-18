/** @type {import('next').NextConfig} */
const defaultDevOrigins = ["192.168.114.227"];

const envDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedDevOrigins = [...new Set([...defaultDevOrigins, ...envDevOrigins])];

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins,
};

export default nextConfig;
