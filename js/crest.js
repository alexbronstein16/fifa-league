// Shrink an image file to a square PNG (default 256×256) in the browser before upload.
// Transparent edges are trimmed, and the crest is centered without stretching.
export async function resizeCrest(file, size = 256) {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that image. Use a PNG or JPG.");
  }

  // find the visible area (skip fully transparent borders)
  const probe = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d");
  probe.drawImage(bmp, 0, 0);
  const { data, width, height } = probe.getImageData(0, 0, bmp.width, bmp.height);
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) { left = 0; top = 0; right = width - 1; bottom = height - 1; }
  const w = right - left + 1, h = bottom - top + 1;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const scale = Math.min(size / w, size / h);
  const dw = w * scale, dh = h * scale;
  ctx.drawImage(bmp, left, top, w, h, (size - dw) / 2, (size - dh) / 2, dw, dh);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("Couldn't process the image.")), "image/png"));
}
