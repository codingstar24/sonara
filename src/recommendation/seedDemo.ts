import { db } from '@/db/schema';
import type { Track, Artwork, PlayEvent, Playlist, PlaylistTrack, Like, ContextStats } from '@/db/types';
import { createDefaultTrackStats, addToDecayedCounter } from './decay';
import {
  HALF_LIFE_SHORT,
  HALF_LIFE_LONG,
  HALF_LIFE_PLAYS30,
  HALF_LIFE_SKIPS30,
  HALF_LIFE_CONTEXT,
} from '@/config/app';
import { useLibraryStore } from '@/app/stores';
import { useLikesStore } from '@/features/likes/likesStore';
import { usePlaylistStore } from '@/features/playlists/playlistStore';

interface DemoArtist {
  name: string;
  genre: string;
  albums: Array<{
    title: string;
    year: number;
    colors: [string, string];
    tracks: string[];
  }>;
}

const DEMO_ARTISTS: DemoArtist[] = [
  {
    name: 'The Lunar Echoes',
    genre: 'Indie Rock',
    albums: [
      {
        title: 'Midnight Satellite',
        year: 2021,
        colors: ['#2E0854', '#4B0082'],
        tracks: ['Gravity Wells', 'Starlight Overdrive', 'Zero Hour', 'Astral Glider', 'Lunar Drift', 'Eclipse in C Minor', 'Solar Flare', 'Desolate Orbit', 'Cosmic Dust', 'Final Transmission'],
      },
      {
        title: 'Ghost Pines',
        year: 2023,
        colors: ['#0f381e', '#235937'],
        tracks: ['Whispering Needles', 'Timberline', 'Fog at Dawn', 'Moss on Stone', 'Cabin Lantern', 'Winter Thaw', 'The Ridge', 'North Wind', 'Silent Canopy', 'Evergreen'],
      },
    ],
  },
  {
    name: 'Neon Voyager',
    genre: 'Synthwave',
    albums: [
      {
        title: 'Retrofutura',
        year: 2022,
        colors: ['#ff007f', '#7928ca'],
        tracks: ['Grid Runner', 'Miami 1984', 'Sunset Boulevard', 'Chrome Heart', 'Laser Highway', 'Digital Romance', 'Arcade Memories', 'Nightcall Protocol', 'Analog Dream', 'Overdrive Pulse'],
      },
      {
        title: 'Cyberpunk Odyssey',
        year: 2024,
        colors: ['#00f0ff', '#1a0033'],
        tracks: ['Sector 7', 'Neon Raindrops', 'Hacker Heist', 'Megacity Skyline', 'Android Tears', 'Sub-Level Zero', 'Augmented Pulse', 'Biolink', 'Ghost Signal', 'Reboot World'],
      },
    ],
  },
  {
    name: 'Komorebi Beats',
    genre: 'Lo-Fi Chill',
    albums: [
      {
        title: 'Rainy Afternoon',
        year: 2020,
        colors: ['#3b5998', '#6a82fb'],
        tracks: ['Warm Coffee', 'Window Droplets', 'Old Books', 'Vinyl Crackle', 'Cat on the Sill', 'Paper Cranes', 'Gentle Breeze', 'Dusk Falls', 'Tired Eyes', 'Slumber'],
      },
      {
        title: 'Late Night Study',
        year: 2023,
        colors: ['#2c3e50', '#fd746c'],
        tracks: ['Pencil Sketch', 'Midnight Tea', 'Desk Lamp', 'Focus Mode', 'Pages Turning', 'Clock Ticking', 'Soft Blanket', 'Quiet Thoughts', 'Dawn Horizon', 'Tomorrow Again'],
      },
    ],
  },
  {
    name: 'Amber Keys',
    genre: 'Nu-Jazz',
    albums: [
      {
        title: 'Velvet Groove',
        year: 2019,
        colors: ['#8E2DE2', '#4A00E0'],
        tracks: ['Blue Midnight', 'Satin Shuffle', 'Smoke & Mirror', 'Cinnamon Spice', 'Downtempo Swing', 'City Lights', 'Saxophone Reverie', 'Bass Walk', 'Last Call', 'After Hours'],
      },
      {
        title: 'Golden Hour Trio',
        year: 2022,
        colors: ['#f12711', '#f5af19'],
        tracks: ['Sunset Rooftop', 'Warm Brass', 'Bossa Nova Sunset', 'Amber Nectar', 'Sunday Afternoon', 'Gentle Syncopation', 'Rhythm & Hue', 'Silk Strings', 'Velvet Hush', 'Encore Serenade'],
      },
    ],
  },
  {
    name: 'Aura Cascades',
    genre: 'Dream Pop',
    albums: [
      {
        title: 'Pastel Skies',
        year: 2021,
        colors: ['#ff9a9e', '#fecfef'],
        tracks: ['Cotton Clouds', 'Shoegaze Shimmer', 'Mirage Lake', 'Floating Away', 'Petal Dance', 'Lavender Haze', 'Echoes of Spring', 'Prism Light', 'Distant Laughter', 'Daydreamer'],
      },
      {
        title: 'Sea of Glass',
        year: 2023,
        colors: ['#a1c4fd', '#c2e9fb'],
        tracks: ['Tidal Bloom', 'Crystal Shore', 'Deep Turquoise', 'Sea Glass', 'Pelican Flight', 'Coral Reefs', 'Driftwood', 'Wavecrest', 'Lighthouse Beacon', 'Abyssal Calm'],
      },
    ],
  },
  {
    name: 'Evelyn Vance',
    genre: 'Modern Classical',
    albums: [
      {
        title: 'Resonant Strings',
        year: 2018,
        colors: ['#141E30', '#243B55'],
        tracks: ['Adagio in D Minor', 'Cello Soliloquy', 'Rain on Cathedral', 'Paganini Variations', 'Winter Solstice', 'The Waltz of Leaves', 'Elegie', 'Symphonic Tide', 'Fading Echo', 'Requiem for Autumn'],
      },
      {
        title: 'Nocturne Solitude',
        year: 2022,
        colors: ['#0B486B', '#F56217'],
        tracks: ['Piano Preludes', 'Moonlit Frost', 'Silence Between Keys', 'Starlight Sonata', 'Reverie in Blue', 'Shadow Play', 'The Wanderer', 'Unspoken Grace', 'Midnight Cadenza', 'Dawn Awakening'],
      },
    ],
  },
  {
    name: 'Solaris Bloom',
    genre: 'Ambient',
    albums: [
      {
        title: 'Deep Orbit',
        year: 2020,
        colors: ['#000428', '#004e92'],
        tracks: ['Interstellar Vacuum', 'Pulsar Harmony', 'Weightless Drift', 'Solar Wind', 'Nebula Veil', 'Europa Ocean', 'Titan Dawn', 'Event Horizon', 'Cosmic Background', 'Singularity'],
      },
      {
        title: 'Bioluminescence',
        year: 2023,
        colors: ['#134E5E', '#71B280'],
        tracks: ['Deep Trench', 'Glowing Canopy', 'Spore Clouds', 'Mycelium Whisper', 'Phosphor Wave', 'Canopy Night', 'Flora Pulse', 'Underworld Spark', 'Emerald Moss', 'Silent Biome'],
      },
    ],
  },
  {
    name: 'Pulse Dynamics',
    genre: 'Deep House',
    albums: [
      {
        title: 'Sundown Sessions',
        year: 2021,
        colors: ['#3023AE', '#c86dd7'],
        tracks: ['Balearic Breeze', 'Deep Resonance', 'Subtle Thump', 'Groove Continuum', 'Midnight Club', 'Hypnotic Chords', 'Warehouse Echoes', 'Bassline Therapy', 'Sunrise Revival', 'Last Track Home'],
      },
      {
        title: 'Club Horizon',
        year: 2024,
        colors: ['#ff4e50', '#f9d423'],
        tracks: ['Underground Beat', 'Strobe Flash', 'Sub-Bass Odyssey', 'Filter Sweep', 'Vocal Chops', 'Four on the Floor', 'Euphoria Rising', 'Dark Room', 'Afterparty Shuffle', 'Morning Light'],
      },
    ],
  },
];

function createSvgArtworkBlob(title: string, artist: string, colors: [string, string]): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors[0]}" />
        <stop offset="100%" stop-color="${colors[1]}" />
      </linearGradient>
    </defs>
    <rect width="500" height="500" fill="url(#g)" />
    <circle cx="250" cy="220" r="120" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="4" />
    <circle cx="250" cy="220" r="60" fill="rgba(255,255,255,0.08)" />
    <path d="M190 280 C 220 230, 280 230, 310 280" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.8"/>
    <text x="250" y="380" font-family="Inter, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="1">${title.replace(
      /&/g,
      '&amp;'
    )}</text>
    <text x="250" y="415" font-family="Inter, sans-serif" font-size="16" fill="rgba(255,255,255,0.7)" text-anchor="middle">${artist.replace(
      /&/g,
      '&amp;'
    )}</text>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

export async function seedDemoData(): Promise<void> {
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  // 1. Create or ensure Demo Source
  const sourceId = 'demo-source-1';
  await db.sources.put({
    id: sourceId,
    kind: 'directory-handle',
    name: 'Demo Music Library',
    addedAt: now - ninetyDaysMs,
    lastScanAt: now,
    autoScan: false,
  });

  const tracksToInsert: Track[] = [];
  const artworkToInsert: Artwork[] = [];
  const likesToInsert: Like[] = [];
  const allGeneratedTrackIds: string[] = [];

  let trackCounter = 1;

  for (const artist of DEMO_ARTISTS) {
    for (const album of artist.albums) {
      const artId = `art-${artist.name.toLowerCase().replace(/\s+/g, '-')}-${album.title.toLowerCase().replace(/\s+/g, '-')}`;
      const blob = createSvgArtworkBlob(album.title, artist.name, album.colors);

      artworkToInsert.push({
        id: artId,
        full: blob,
        thumb: blob,
        dominantColor: album.colors[0],
      });

      album.tracks.forEach((trackTitle, trackIndex) => {
        const trackId = `demo-t-${trackCounter++}`;
        allGeneratedTrackIds.push(trackId);

        const duration = 160 + ((trackCounter * 37) % 180);
        const addedAt = now - ninetyDaysMs + (trackCounter % 60) * 24 * 60 * 60 * 1000;

        const track: Track = {
          id: trackId,
          sourceId,
          relPath: `${artist.genre}/${artist.name}/${album.title}/${trackIndex + 1} - ${trackTitle}.mp3`,
          size: Math.round(duration * 40000),
          lastModified: addedAt,
          fingerprint: `fp-${trackId}`,
          title: trackTitle,
          artist: artist.name,
          albumArtist: artist.name,
          album: album.title,
          genres: [artist.genre],
          year: album.year,
          trackNo: trackIndex + 1,
          discNo: 1,
          duration,
          bitrate: 320,
          sampleRate: 44100,
          codec: 'mp3',
          lossless: false,
          artworkId: artId,
          addedAt,
          missing: false,
          unsupported: false,
          overrides: null,
          hiddenFromRecs: false,
        };

        tracksToInsert.push(track);

        // Make ~20% liked
        if ((trackCounter * 17) % 100 < 22) {
          likesToInsert.push({
            trackId,
            likedAt: addedAt + 500000,
          });
        }
      });
    }
  }

  // 2. Synthesize PlayEvents, TrackStats, and ContextStats across 90 days
  const playEventsToInsert: PlayEvent[] = [];
  const trackStatsMap = new Map<string, ReturnType<typeof createDefaultTrackStats>>();
  const contextStatsMap = new Map<string, ContextStats>();

  for (const t of tracksToInsert) {
    trackStatsMap.set(t.id, createDefaultTrackStats(t.id, t.addedAt));
  }

  // Generate ~1400 listen sessions over the last 90 days
  const totalSessions = 1400;
  for (let i = 0; i < totalSessions; i++) {
    // Distribute timestamps more heavily towards recent days
    const dayOffset = Math.pow(Math.random(), 1.5) * 90;
    // Hour affinity: peak in evening (19:00 - 23:00) or morning (8:00 - 10:00)
    let sessionHour = 20;
    const r = Math.random();
    if (r < 0.45) {
      sessionHour = 18 + Math.floor(Math.random() * 5); // 18-22
    } else if (r < 0.7) {
      sessionHour = 8 + Math.floor(Math.random() * 3); // 8-10
    } else {
      sessionHour = Math.floor(Math.random() * 24);
    }

    const sessionTime =
      now - Math.round(dayOffset * 24 * 60 * 60 * 1000) + (sessionHour - 12) * 3600 * 1000;
    const dateObj = new Date(sessionTime);
    const hour = dateObj.getHours();
    const weekday = dateObj.getDay();

    // Pick track: top tracks get chosen more often
    const trackIndex = Math.floor(Math.pow(Math.random(), 2) * tracksToInsert.length);
    const chosenTrack = tracksToInsert[trackIndex] || tracksToInsert[0]!;

    const durationMs = chosenTrack.duration * 1000;
    const isEarlySkip = Math.random() < 0.08;
    const isCompleted = !isEarlySkip && Math.random() > 0.15;
    const listenedMs = isEarlySkip
      ? Math.round(Math.random() * 8000)
      : isCompleted
      ? durationMs
      : Math.round(durationMs * (0.5 + Math.random() * 0.4));

    const counted = listenedMs >= Math.min(30000, durationMs * 0.5);

    const event: PlayEvent = {
      id: `pe_demo_${i}`,
      trackId: chosenTrack.id,
      startedAt: sessionTime,
      listenedMs,
      durationMs,
      completed: isCompleted,
      counted,
      earlySkip: isEarlySkip,
      source: 'demo',
      contextType: 'album',
      contextId: chosenTrack.album,
      hour,
      weekday,
    };
    playEventsToInsert.push(event);

    // Update track stats
    const stats = trackStatsMap.get(chosenTrack.id)!;
    if (counted) stats.playCount += 1;
    if (isEarlySkip) stats.skipCount += 1;
    stats.lastPlayedAt = Math.max(stats.lastPlayedAt || 0, sessionTime);
    stats.totalListenMs += listenedMs;
    stats.hourHist[hour] = (stats.hourHist[hour] || 0) + 1;
    stats.weekdayHist[weekday] = (stats.weekdayHist[weekday] || 0) + 1;

    const weight = isCompleted ? 1.0 : counted ? 0.6 : isEarlySkip ? -0.7 : 0;
    stats.shortScore = addToDecayedCounter(stats.shortScore, weight, sessionTime, HALF_LIFE_SHORT);
    stats.longScore = addToDecayedCounter(stats.longScore, weight, sessionTime, HALF_LIFE_LONG);

    if (counted) {
      stats.plays30 = addToDecayedCounter(stats.plays30, 1.0, sessionTime, HALF_LIFE_PLAYS30);
    }
    if (isEarlySkip) {
      stats.skips30 = addToDecayedCounter(stats.skips30, 1.0, sessionTime, HALF_LIFE_SKIPS30);
    }

    // Context stats for the album
    const ctxKey = `album:${chosenTrack.album}`;
    let cStat = contextStatsMap.get(ctxKey);
    if (!cStat) {
      cStat = {
        key: ctxKey,
        score: { value: 0, updatedAt: sessionTime },
        lastPlayedAt: sessionTime,
        plays: 0,
      };
      contextStatsMap.set(ctxKey, cStat);
    }
    cStat.lastPlayedAt = Math.max(cStat.lastPlayedAt, sessionTime);
    if (counted) {
      cStat.plays += 1;
      cStat.score = addToDecayedCounter(cStat.score, 1.0, sessionTime, HALF_LIFE_CONTEXT);
    }
  }

  // 3. Create 4 Demo Playlists
  const demoPlaylists: Array<{ name: string; desc: string; genre: string }> = [
    { name: 'Late Night Synthesis', desc: 'Hypnotic synthwave and driving beats.', genre: 'Synthwave' },
    { name: 'Lo-Fi Chill Sanctuary', desc: 'Soft tapes, quiet rain and mellow keys.', genre: 'Lo-Fi Chill' },
    { name: 'Indie Rock Roadtrip', desc: 'Guitars, horizon and open roads.', genre: 'Indie Rock' },
    { name: 'Ambient Sleep Space', desc: 'Gentle modular soundscapes for dreaming.', genre: 'Ambient' },
  ];

  const playlistsToInsert: Playlist[] = [];
  const playlistTracksToInsert: PlaylistTrack[] = [];

  demoPlaylists.forEach((pl, plIdx) => {
    const plId = `demo-pl-${plIdx + 1}`;
    playlistsToInsert.push({
      id: plId,
      name: pl.name,
      description: pl.desc,
      kind: 'manual',
      smartRules: null,
      coverArtworkId: null,
      customCover: null,
      parentFolderId: null,
      sortMode: 'custom',
      createdAt: now - 30 * 86400000,
      updatedAt: now,
    });

    const matchingTracks = tracksToInsert.filter((t) => t.genres.includes(pl.genre));
    matchingTracks.slice(0, 15).forEach((t, tIdx) => {
      playlistTracksToInsert.push({
        id: `pt_${plId}_${t.id}`,
        playlistId: plId,
        trackId: t.id,
        order: (tIdx + 1) * 1000,
        addedAt: now - 30 * 86400000 + tIdx * 1000,
      });
    });
  });

  // Batch insert into Dexie
  await db.transaction(
    'rw',
    [
      db.sources,
      db.tracks,
      db.artwork,
      db.likes,
      db.playEvents,
      db.trackStats,
      db.contextStats,
      db.playlists,
      db.playlistTracks,
    ],
    async () => {
      await db.sources.bulkPut([
        {
          id: sourceId,
          kind: 'directory-handle',
          name: 'Demo Music Library',
          addedAt: now - ninetyDaysMs,
          lastScanAt: now,
          autoScan: false,
        },
      ]);
      await db.artwork.bulkPut(artworkToInsert);
      await db.tracks.bulkPut(tracksToInsert);
      await db.likes.bulkPut(likesToInsert);
      await db.playEvents.bulkPut(playEventsToInsert);
      await db.trackStats.bulkPut(Array.from(trackStatsMap.values()));
      await db.contextStats.bulkPut(Array.from(contextStatsMap.values()));
      await db.playlists.bulkPut(playlistsToInsert);
      await db.playlistTracks.bulkPut(playlistTracksToInsert);
    }
  );

  // Hydrate in-memory stores
  useLibraryStore.setState({ loaded: false, loading: false });
  await useLibraryStore.getState().hydrate();
  await useLikesStore.getState().hydrate();
  await usePlaylistStore.getState().hydrate();
}
