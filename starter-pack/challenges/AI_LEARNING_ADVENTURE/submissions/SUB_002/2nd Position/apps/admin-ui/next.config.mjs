/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ['@ai-learning-adventure/types'],
  async rewrites() {
    const apiTarget = process.env.UPSTREAM_API_ORIGIN ?? 'http://127.0.0.1:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
