import type { Track, TrackLite } from '@/db/types';

/**
 * Generate standard M3U8 content for a list of tracks
 */
export function generateM3U8Content(playlistName: string, tracks: (Track | TrackLite)[]): string {
  const lines: string[] = ['#EXTM3U', `#PLAYLIST:${playlistName}`];

  for (const track of tracks) {
    const dur = Math.round(track.duration);
    const artist = track.artist || 'Unknown Artist';
    const title = track.title || 'Unknown Title';
    lines.push(`#EXTINF:${dur},${artist} - ${title}`);

    // If relPath exists, use it; otherwise title.mp3
    if ('relPath' in track && track.relPath) {
      lines.push(track.relPath);
    } else {
      lines.push(`${artist} - ${title}.mp3`);
    }
  }

  return lines.join('\n');
}

/**
 * Trigger browser file download of the M3U8 playlist
 */
export function downloadPlaylistM3U8(playlistName: string, tracks: (Track | TrackLite)[]): void {
  const content = generateM3U8Content(playlistName, tracks);
  const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeFilename = playlistName.replace(/[/\\?%*:|"<>]/g, '_') + '.m3u8';

  const a = document.createElement('a');
  a.href = url;
  a.download = safeFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
