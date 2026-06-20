import { NextRequest } from 'next/server';
import { apiUrl } from '../../../lib/api';

function isAllowedBackgroundPath(path: string) {
  return path.startsWith('/files/') || path.startsWith('/certificate-templates/');
}

export async function GET(request: NextRequest) {
  const backgroundPath = request.nextUrl.searchParams.get('path') ?? '';
  if (!backgroundPath) {
    return new Response('Missing background path', { status: 400 });
  }

  if (!isAllowedBackgroundPath(backgroundPath)) {
    return new Response('Invalid background path', { status: 400 });
  }

  const upstreamUrl = new URL(`${apiUrl}${backgroundPath}`);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (key !== 'path') {
      upstreamUrl.searchParams.set(key, value);
    }
  }

  const upstream = await fetch(upstreamUrl, {
    headers: {
      cookie: request.headers.get('cookie') ?? ''
    }
  });

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  const pageCount = upstream.headers.get('x-page-count');
  if (pageCount) {
    headers.set('X-Page-Count', pageCount);
  }
  headers.set('Cache-Control', 'no-store');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  return new Response(upstream.body, {
    status: upstream.status,
    headers
  });
}
