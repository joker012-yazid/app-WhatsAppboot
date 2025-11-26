/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Note: API proxying is handled by the API route at /app/api/[...path]/route.ts
  // This allows proper cookie handling for cross-origin scenarios
};

export default nextConfig;
