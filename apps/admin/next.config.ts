import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace paketleri TS kaynağından tüketilir (main: ./src/index.ts)
  transpilePackages: ['@viral-places/contracts', '@viral-places/domain', '@viral-places/pipeline', '@viral-places/policy', '@viral-places/scoring'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
