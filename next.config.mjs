/** @type {import('next').NextConfig} */
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
