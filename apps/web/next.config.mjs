import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  transpilePackages: ['@certiflow/shared'],
  allowedDevOrigins: [
    'localhost:3000',
    'localhost',
    '127.0.0.1:3000',
    '127.0.0.1',
    '192.168.0.106:3000',
    '192.168.0.106',
    '192.168.0.105:3000',
    '192.168.0.105',
    '192.168.56.1:3000',
    '192.168.56.1',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.0.106:3000',
    'http://192.168.0.106',
    'http://192.168.0.105:3000',
    'http://192.168.0.105',
    'http://192.168.56.1:3000',
    'http://192.168.56.1'
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      }
    ];
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
