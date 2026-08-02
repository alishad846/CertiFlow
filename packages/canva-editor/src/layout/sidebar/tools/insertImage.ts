import axios from 'axios';

/**
 * Reads a raster blob's intrinsic pixel dimensions. The upload endpoint does not report width/height,
 * and addImageLayer needs a real box size — a missing one makes it compute NaN → the layer serialises
 * with null size/position and renders at 0,0 with no size. We measure locally, exactly like the
 * general Image-upload tab does, so Signature/Draw layers always get a valid box.
 */
async function measureBlob(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close?.();
      if (size.width > 0 && size.height > 0) return size;
    } catch {
      // fall through to the <img> path
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event);
    };
    img.src = url;
  });
}

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
  // Measure BEFORE upload so we always have a valid box size (the endpoint omits width/height).
  const size = await measureBlob(blob).catch(() => ({ width: 480, height: 200 }));
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
    const width = Number(img.width) || size.width;
    const height = Number(img.height) || size.height;
    actions.addImageLayer({ url: img.url, thumb: img.url }, { width, height });
  }
}
