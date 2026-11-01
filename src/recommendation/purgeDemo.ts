import { db } from '@/db/schema';

/**
 * Completely purges all synthetic demo and mock data from Dexie IndexedDB.
 * Ensures the user's music library only contains genuine user files and folders.
 */
export async function purgeAllDemoData(): Promise<void> {
  try {
    // 1. Delete all demo tracks
    const demoTracks = await db.tracks
      .filter((t) => t.id.startsWith('demo-') || t.sourceId.startsWith('demo-'))
      .toArray();
    if (demoTracks.length > 0) {
      await db.tracks.bulkDelete(demoTracks.map((t) => t.id));
    }

    // 2. Delete all demo sources
    const demoSources = await db.sources
      .filter(
        (s) =>
          s.id.startsWith('demo-') ||
          s.name.toLowerCase().includes('demo music') ||
          s.name.toLowerCase().includes('synthetic')
      )
      .toArray();
    if (demoSources.length > 0) {
      await db.sources.bulkDelete(demoSources.map((s) => s.id));
    }

    // 3. Delete all demo playlists and their playlist tracks
    const demoPlaylists = await db.playlists
      .filter((p) => p.id.startsWith('demo-') || p.id.startsWith('pl_demo_'))
      .toArray();
    if (demoPlaylists.length > 0) {
      const demoPlIds = demoPlaylists.map((p) => p.id);
      await db.playlists.bulkDelete(demoPlIds);
      const demoPlTracks = await db.playlistTracks
        .filter((pt) => demoPlIds.includes(pt.playlistId) || pt.trackId.startsWith('demo-'))
        .toArray();
      if (demoPlTracks.length > 0) {
        await db.playlistTracks.bulkDelete(demoPlTracks.map((pt) => pt.id));
      }
    }

    // 4. Delete demo likes
    const demoLikes = await db.likes
      .filter((l) => l.trackId.startsWith('demo-'))
      .toArray();
    if (demoLikes.length > 0) {
      await db.likes.bulkDelete(demoLikes.map((l) => l.trackId));
    }

    // 5. Delete demo track statistics
    const demoStats = await db.trackStats
      .filter((s) => s.trackId.startsWith('demo-'))
      .toArray();
    if (demoStats.length > 0) {
      await db.trackStats.bulkDelete(demoStats.map((s) => s.trackId));
    }

    // 6. Delete demo play events
    const demoEvents = await db.playEvents
      .filter((e) => e.trackId.startsWith('demo-') || e.source === 'demo')
      .toArray();
    if (demoEvents.length > 0) {
      await db.playEvents.bulkDelete(demoEvents.map((e) => e.id));
    }

    // 7. Delete demo artwork
    const demoArtwork = await db.artwork
      .filter((a) => a.id.startsWith('art-the-lunar') || a.id.startsWith('art-neon') || a.id.startsWith('art-demo'))
      .toArray();
    if (demoArtwork.length > 0) {
      await db.artwork.bulkDelete(demoArtwork.map((a) => a.id));
    }
  } catch (err) {
    console.warn('purgeAllDemoData: Error during demo data cleanup:', err);
  }
}
