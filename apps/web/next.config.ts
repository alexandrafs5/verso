import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  agentRules: false,
  rewrites() {
    return [
      // The API serves /health outside the /api prefix (SPEC 01).
      { source: '/api/health', destination: `${apiUrl}/health` },
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
