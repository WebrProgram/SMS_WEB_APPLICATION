/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const targetUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://school-management-system-production-3c20.up.railway.app').replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${targetUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
