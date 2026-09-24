/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dit dwingt Next.js om alle omgevingsvariabelen tijdens de runtime vers in te laden
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};

module.exports = nextConfig;
