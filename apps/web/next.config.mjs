import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  transpilePackages: ['@certiflow/shared'],
  allowedDevOrigins: ['localhost', '127.0.0.1', '::1', '*.localhost', '10.*.*.*', '172.*.*.*', '192.168.*.*'],
  webpack(config, { dev }) {
    if (dev) {
      // Disable webpack's on-disk cache in dev to avoid flaky OneDrive/FS rename errors.
      config.cache = false;
    }

    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }
        ]
      }
    ];
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
