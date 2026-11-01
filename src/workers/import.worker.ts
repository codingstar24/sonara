import { parseBlob } from 'music-metadata';
import { parseFilename } from '@/lib/filenameParser';
import { generateFingerprint } from '@/lib/fingerprint';
import { extractDominantColorFromPixels } from '@/lib/colorExtractor';
import { KNOWN_UNSUPPORTED_EXTENSIONS } from '@/config/app';

export interface WorkerParseRequest {
  taskId: string;
  sourceId: string;
  relPath: string;
  name: string;
  size: number;
  lastModified: number;
  blob: Blob;
}

export interface WorkerArtworkResult {
  id: string;
  full: Blob;
  thumb: Blob;
  dominantColor: string;
}

export interface WorkerParseResult {
  taskId: string;
  success: boolean;
  error?: string;
  track?: {
    id: string;
    sourceId: string;
    relPath: string;
    size: number;
    lastModified: number;
    fingerprint: string;
    title: string;
    artist: string;
    albumArtist: string;
    album: string;
    genres: string[];
    year?: number;
    trackNo?: number;
    discNo?: number;
    duration: number;
    bitrate?: number;
    sampleRate?: number;
    codec?: string;
    lossless?: boolean;
    artworkId?: string;
    addedAt: number;
    unsupported?: boolean;
  };
  artwork?: WorkerArtworkResult;
}

// Convert ArrayBuffer to hex string for artwork content hash
async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Resize image Blob using OffscreenCanvas
async function processImage(imageBlob: Blob): Promise<WorkerArtworkResult | null> {
  try {
    const buffer = await imageBlob.arrayBuffer();
    const hash = await computeHash(buffer);

    let fullBlob = imageBlob;
    let thumbBlob = imageBlob;
    let dominantColor = '#121212';

    if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
      const bitmap = await createImageBitmap(imageBlob);
      const { width, height } = bitmap;

      // 1. Full cover (max 1000px)
      const maxFull = 1000;
      let fullW = width;
      let fullH = height;
      if (width > maxFull || height > maxFull) {
        if (width > height) {
          fullW = maxFull;
          fullH = Math.round((height * maxFull) / width);
        } else {
          fullH = maxFull;
          fullW = Math.round((width * maxFull) / height);
        }
      }

      const canvasFull = new OffscreenCanvas(fullW, fullH);
      const ctxFull = canvasFull.getContext('2d');
      if (ctxFull) {
        ctxFull.drawImage(bitmap, 0, 0, fullW, fullH);
        fullBlob = await canvasFull.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
      }

      // 2. Thumb cover (max 160px)
      const maxThumb = 160;
      let thumbW = width;
      let thumbH = height;
      if (width > maxThumb || height > maxThumb) {
        if (width > height) {
          thumbW = maxThumb;
          thumbH = Math.round((height * maxThumb) / width);
        } else {
          thumbH = maxThumb;
          thumbW = Math.round((width * maxThumb) / height);
        }
      }

      const canvasThumb = new OffscreenCanvas(thumbW, thumbH);
      const ctxThumb = canvasThumb.getContext('2d');
      if (ctxThumb) {
        ctxThumb.drawImage(bitmap, 0, 0, thumbW, thumbH);
        thumbBlob = await canvasThumb.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
      }

      // 3. Dominant color (16x16 sample)
      const canvasColor = new OffscreenCanvas(16, 16);
      const ctxColor = canvasColor.getContext('2d');
      if (ctxColor) {
        ctxColor.drawImage(bitmap, 0, 0, 16, 16);
        const imgData = ctxColor.getImageData(0, 0, 16, 16);
        dominantColor = extractDominantColorFromPixels(imgData.data);
      }

      bitmap.close();
    }

    return {
      id: hash,
      full: fullBlob,
      thumb: thumbBlob,
      dominantColor,
    };
  } catch (err) {
    console.warn('Failed to process embedded artwork:', err);
    return null;
  }
}

self.onmessage = async (e: MessageEvent<WorkerParseRequest>) => {
  const req = e.data;
  const ext = req.name.split('.').pop()?.toLowerCase() ?? '';
  const isKnownUnsupported = KNOWN_UNSUPPORTED_EXTENSIONS.has(ext);

  try {
    let title = '';
    let artist = 'Unknown Artist';
    let albumArtist = '';
    let album = '';
    let genres: string[] = [];
    let year: number | undefined;
    let trackNo: number | undefined;
    let discNo: number | undefined;
    let duration = 0;
    let bitrate: number | undefined;
    let sampleRate: number | undefined;
    let codec: string | undefined;
    let lossless: boolean | undefined;
    let artwork: WorkerArtworkResult | null = null;

    try {
      const metadata = await parseBlob(req.blob);
      const common = metadata.common;
      const format = metadata.format;

      title = common.title || '';
      artist = common.artist || common.artists?.join(', ') || 'Unknown Artist';
      albumArtist = common.albumartist || '';
      album = common.album || '';
      genres = common.genre ? [...common.genre] : [];
      year = common.year;
      trackNo = common.track?.no ?? undefined;
      discNo = common.disk?.no ?? undefined;
      duration = format.duration || 0;
      bitrate = format.bitrate;
      sampleRate = format.sampleRate;
      codec = format.codec;
      lossless = format.lossless;

      // Embedded picture
      const picture = common.picture?.[0];
      if (picture && picture.data) {
        const picBlob = new Blob([picture.data as unknown as BlobPart], { type: picture.format || 'image/jpeg' });
        artwork = await processImage(picBlob);
      }
    } catch {
      // Audio parsing error, fallback to filename
    }

    // Fallbacks if tags missing
    if (!title || artist === 'Unknown Artist' || !album) {
      const fallback = parseFilename(req.name, req.relPath);
      if (!title) title = fallback.title;
      if (artist === 'Unknown Artist' && fallback.artist !== 'Unknown Artist') {
        artist = fallback.artist;
      }
      if (!album && fallback.album) {
        album = fallback.album;
      }
      if (!trackNo && fallback.trackNo) {
        trackNo = fallback.trackNo;
      }
    }

    if (!album) album = 'Unknown Album';
    if (!albumArtist) albumArtist = artist;

    const fingerprint = generateFingerprint(title, artist, duration, req.size);
    const trackId = `${req.sourceId}:${req.relPath}`;

    const result: WorkerParseResult = {
      taskId: req.taskId,
      success: true,
      track: {
        id: trackId,
        sourceId: req.sourceId,
        relPath: req.relPath,
        size: req.size,
        lastModified: req.lastModified,
        fingerprint,
        title,
        artist,
        albumArtist,
        album,
        genres,
        year,
        trackNo,
        discNo,
        duration,
        bitrate,
        sampleRate,
        codec,
        lossless,
        artworkId: artwork?.id,
        addedAt: Date.now(),
        unsupported: isKnownUnsupported,
      },
      artwork: artwork ?? undefined,
    };

    self.postMessage(result);
  } catch (err: any) {
    self.postMessage({
      taskId: req.taskId,
      success: false,
      error: err?.message || 'Unknown parse error',
    } as WorkerParseResult);
  }
};
