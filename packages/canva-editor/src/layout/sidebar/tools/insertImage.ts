import axios from 'axios';

/**
 * Uploads a PNG/JPEG blob to the editor's user-uploads endpoint and drops it onto the canvas as an
 * image layer. Shared by the Signature and Draw tools (both produce a rasterised drawing).
 */
export async function uploadAndInsertImage(
  config: any,
  actions: any,
  blob: Blob,
  filename: string,
  opts: { asBackground?: boolean } = {}
): Promise<void> {
  const form = new FormData();
  form.append('file', new File([blob], filename, { type: blob.type || 'image/png' }));
  const res = await axios.post(`${config.apis.url}${config.apis.uploadUserImage}`, form, {
    withCredentials: true,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  // The upload endpoint returns a { data: [...] } envelope; tolerate a bare array too.
  const body = res.data;
  const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  const item = list[0];
  const img = item?.img;
  if (!img?.url) {
    throw new Error('Upload did not return an image url');
  }
  if (opts.asBackground) {
    // Full-page, behind all content (watermark).
    actions.addBackgroundImageLayer({ url: img.url, thumb: img.url });
  } else {
    actions.addImageLayer({ url: img.url, thumb: img.url }, { width: img.width, height: img.height });
  }
}
