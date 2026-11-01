import { db } from '@/db/schema';

/**
 * Crop an image to square and resize to target dimension (e.g. 512x512)
 */
export async function cropImageToSquareBlob(
  imageSource: Blob | File,
  targetSize = 512
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageSource);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      // Center crop calculation
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - minDim) / 2;
      const sy = (img.naturalHeight - minDim) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create JPEG blob from canvas'));
          }
        },
        'image/jpeg',
        0.88
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for cropping'));
    };

    img.src = url;
  });
}

/**
 * Generate a 2x2 collage cover from the first 4 distinct artwork IDs
 */
export async function generateCollageCover(artworkIds: string[]): Promise<Blob | null> {
  const distinctIds = Array.from(new Set(artworkIds.filter(Boolean))).slice(0, 4);
  if (distinctIds.length === 0) return null;

  // If only 1 artwork, return its blob
  if (distinctIds.length < 4) {
    const art = await db.artwork.get(distinctIds[0]!);
    return art?.full instanceof Blob ? art.full : null;
  }

  // Load 4 artworks
  const blobs: Blob[] = [];
  for (const artId of distinctIds) {
    const art = await db.artwork.get(artId);
    if (art?.full instanceof Blob) {
      blobs.push(art.full);
    }
  }

  if (blobs.length < 4) return blobs[0] ?? null;

  const targetSize = 512;
  const half = targetSize / 2;
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const positions = [
    { x: 0, y: 0 },
    { x: half, y: 0 },
    { x: 0, y: half },
    { x: half, y: half },
  ];

  await Promise.all(
    blobs.slice(0, 4).map((blob, idx) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const minDim = Math.min(img.naturalWidth, img.naturalHeight);
          const sx = (img.naturalWidth - minDim) / 2;
          const sy = (img.naturalHeight - minDim) / 2;
          const pos = positions[idx]!;
          ctx.drawImage(img, sx, sy, minDim, minDim, pos.x, pos.y, half, half);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
    })
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (resBlob) => {
        resolve(resBlob);
      },
      'image/jpeg',
      0.88
    );
  });
}
