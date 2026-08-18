/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const rawUrl = process.env.NEXT_PUBLIC_API_URL || 'https://school-management-system-production-710f.up.railway.app';
    const targetUrl = rawUrl.replace('3c20', '710f').replace('73ff', '710f').replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${targetUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
