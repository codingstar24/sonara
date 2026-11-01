import MiniSearch from 'minisearch';
import type { TrackLite } from '@/db/types';

export interface SearchDoc {
  id: string;
  type: 'track' | 'album' | 'artist' | 'playlist';
  title: string;
  artist?: string;
  album?: string;
  genres?: string;
  artworkId?: string;
}

export class SearchEngine {
  private miniSearch: MiniSearch<SearchDoc>;
  private indexed = false;

  constructor() {
    this.miniSearch = new MiniSearch<SearchDoc>({
      fields: ['title', 'artist', 'album', 'genres'],
      storeFields: ['id', 'type', 'title', 'artist', 'album', 'artworkId'],
      searchOptions: {
        boost: { title: 3, artist: 2, album: 1.5 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
  }

  public indexLibrary(
    tracks: TrackLite[],
    albums: { key: string; album: string; albumArtist: string; artworkId?: string | null }[],
    artists: { name: string; artworkId?: string | null }[],
    playlists: { id: string; name: string }[]
  ) {
    this.miniSearch.removeAll();

    const docs: SearchDoc[] = [];

    // Tracks
    for (const t of tracks) {
      docs.push({
        id: `track:${t.id}`,
        type: 'track',
        title: t.title,
        artist: t.artist,
        album: t.album,
        genres: t.genres.join(' '),
        artworkId: t.artworkId ?? undefined,
      });
    }

    // Albums
    for (const a of albums) {
      docs.push({
        id: `album:${a.key}`,
        type: 'album',
        title: a.album,
        artist: a.albumArtist,
        artworkId: a.artworkId ?? undefined,
      });
    }

    // Artists
    for (const art of artists) {
      docs.push({
        id: `artist:${art.name}`,
        type: 'artist',
        title: art.name,
        artworkId: art.artworkId ?? undefined,
      });
    }

    // Playlists
    for (const p of playlists) {
      docs.push({
        id: `playlist:${p.id}`,
        type: 'playlist',
        title: p.name,
      });
    }

    this.miniSearch.addAll(docs);
    this.indexed = true;
  }

  public search(query: string): SearchDoc[] {
    if (!query.trim() || !this.indexed) return [];
    const results = this.miniSearch.search(query.trim());
    return results.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      artist: r.artist,
      album: r.album,
      artworkId: r.artworkId,
    }));
  }
}

export const searchEngine = new SearchEngine();
