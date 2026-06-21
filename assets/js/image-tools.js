export async function compressImage(file, options = {}) {
  const maxBytes = Number(options.maxBytes || 900000);
  const maxSide = Number(options.maxSide || 1600);
  const minQuality = 0.58;
  const startQuality = 0.86;

  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Choisissez une image valide.");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = startQuality;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 0.08);
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > maxBytes) {
    throw new Error(`La photo reste trop lourde après compression (${Math.round(blob.size / 1024)} Ko). Choisissez une image plus légère.`);
  }
  return blob;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Compression impossible.")), "image/jpeg", quality);
  });
}
