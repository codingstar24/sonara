/**
 * Dominant color extraction from image pixel data
 * Uses a 16x16 downsample, scores pixels by saturation and mid-lightness (0.3 - 0.7).
 */

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function extractDominantColorFromPixels(pixels: Uint8ClampedArray): string {
  let bestColor = '#121212';
  let bestScore = -1;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const a = pixels[i + 3] ?? 0;

    if (a < 128) continue; // ignore transparent pixels

    const [h, s, l] = rgbToHsl(r, g, b);

    // Filter out near-blacks and near-whites
    if (l < 15 || l > 85) continue;

    // Prefer saturated colors with mid-range lightness (0.35 - 0.65)
    const lightnessScore = 1 - Math.abs(l - 50) / 50;
    const saturationScore = s / 100;
    const score = saturationScore * 1.5 + lightnessScore;

    if (score > bestScore) {
      bestScore = score;
      bestColor = `hsl(${h}, ${Math.max(40, s)}%, ${Math.min(65, Math.max(35, l))}%)`;
    }
  }

  return bestColor;
}
