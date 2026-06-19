const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function resolveApiUrl() {
  if (typeof window === 'undefined') {
    return configuredApiUrl;
  }

  try {
    const configured = new URL(configuredApiUrl);
    return `${configured.protocol}//${window.location.hostname}${configured.port ? `:${configured.port}` : ''}`;
  } catch {
    return configuredApiUrl;
  }
}

export const apiUrl = resolveApiUrl();

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.toLowerCase().includes('fetch')) {
      throw new Error(`Unable to reach the API at ${apiUrl}. Make sure the backend is running.`);
    }

    throw error;
  }

  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(data?.message ?? 'Request failed');
  }

  return data as T;
}
