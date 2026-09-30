/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow the LAN address used to test the dev server from another device.
  // This only affects `next dev`; production behavior is unchanged.
  allowedDevOrigins: ["192.168.114.227"],
};

export default nextConfig;
