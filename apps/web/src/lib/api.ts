export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const response = await fetch(`${apiUrl}${path}`, {
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
