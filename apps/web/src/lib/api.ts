const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const apiUrl = configuredApiUrl;

export function getApiUrl() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return configuredApiUrl;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers
  });

  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message ?? 'Request failed');
  }

  return data as T;
}
