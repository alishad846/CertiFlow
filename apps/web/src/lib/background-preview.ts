export function getBackgroundPreviewSrc(backgroundUrl: string, page?: number) {
  if (!backgroundUrl) {
    return '';
  }

  const params = new URLSearchParams({ path: backgroundUrl });
  if (page && page > 0) {
    params.set('page', String(page));
  }
  return `/api/background?${params.toString()}`;
}
