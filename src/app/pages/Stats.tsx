import { type FC, useState, useEffect, useMemo } from 'react';
import {
  Clock,
  ChartBar,
  Fire,
  Trophy,
  MusicNotes,
} from '@phosphor-icons/react';
import { db } from '@/db/schema';
import type { PlayEvent, TrackLite } from '@/db/types';
import { useLibraryStore } from '@/app/stores';
import { Cover } from '@/components/ui/Cover';
import { useQueueStore } from '@/features/queue/queueStore';

type TimeRange = 'today' | '7days' | '30days' | 'year' | 'all';

interface StatsSummary {
  totalMinutes: number;
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  currentStreak: number;
  longestStreak: number;
  dailyMinutes: Array<{ dateStr: string; label: string; minutes: number }>;
  hourlyPlays: number[]; // 24 bars
  weekdayPlays: number[]; // 7 bars
  topTracks: Array<{ track: TrackLite; plays: number }>;
  topArtists: Array<{ name: string; plays: number; artworkId: string | null }>;
  topAlbums: Array<{ title: string; artist: string; plays: number; artworkId: string | null }>;
  topGenres: Array<{ name: string; count: number; pct: number }>;
  newDiscoveries: TrackLite[];
}

export const StatsPage: FC = () => {
  const [range, setRange] = useState<TimeRange>('30days');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PlayEvent[]>([]);

  const libraryTracks = useLibraryStore((s) => s.tracks);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const now = Date.now();
    let minTimestamp = 0;

    if (range === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      minTimestamp = today.getTime();
    } else if (range === '7days') {
      minTimestamp = now - 7 * 86400000;
    } else if (range === '30days') {
      minTimestamp = now - 30 * 86400000;
    } else if (range === 'year') {
      minTimestamp = now - 365 * 86400000;
    }

    void db.playEvents
      .where('startedAt')
      .aboveOrEqual(minTimestamp)
      .toArray()
      .then((evs) => {
        if (!cancelled) {
          setEvents(evs);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const stats = useMemo<StatsSummary>(() => {
    let totalMinutes = 0;
    let totalPlays = 0;
    const trackPlayCounts = new Map<string, number>();
    const artistPlayCounts = new Map<string, number>();
    const albumPlayCounts = new Map<string, { artist: string; count: number; artworkId: string | null }>();
    const genreCounts = new Map<string, number>();
    const hourly = new Array(24).fill(0);
    const weekday = new Array(7).fill(0);
    const daysMap = new Map<string, number>();

    // Process events
    for (const ev of events) {
      const mins = Math.round(ev.listenedMs / 60000);
      totalMinutes += mins;
      if (ev.counted) totalPlays++;

      const track = libraryTracks.get(ev.trackId);
      if (track) {
        trackPlayCounts.set(track.id, (trackPlayCounts.get(track.id) || 0) + 1);

        const art = track.artist.trim();
        artistPlayCounts.set(art, (artistPlayCounts.get(art) || 0) + 1);

        const albKey = track.album.trim();
        const existingAlb = albumPlayCounts.get(albKey) || {
          artist: track.artist,
          count: 0,
          artworkId: track.artworkId,
        };
        existingAlb.count += 1;
        albumPlayCounts.set(albKey, existingAlb);

        for (const g of track.genres || []) {
          genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
        }
      }

      hourly[ev.hour] = (hourly[ev.hour] || 0) + 1;
      weekday[ev.weekday] = (weekday[ev.weekday] || 0) + 1;

      const dateStr = new Date(ev.startedAt).toISOString().slice(0, 10);
      daysMap.set(dateStr, (daysMap.get(dateStr) || 0) + mins);
    }

    // Daily bars
    const dailyMinutes: StatsSummary['dailyMinutes'] = [];
    const numDays = range === 'today' ? 1 : range === '7days' ? 7 : range === '30days' ? 30 : 14;
    const now = Date.now();
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const label = numDays <= 7 ? d.toLocaleDateString(undefined, { weekday: 'short' }) : d.getDate().toString();
      dailyMinutes.push({
        dateStr,
        label,
        minutes: daysMap.get(dateStr) || 0,
      });
    }

    // Streaks
    const allPlayedDates = Array.from(daysMap.keys()).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    let checkD = new Date();
    while (true) {
      const dStr = checkD.toISOString().slice(0, 10);
      if (daysMap.has(dStr)) {
        currentStreak++;
        checkD = new Date(checkD.getTime() - 86400000);
      } else {
        break;
      }
    }

    let prevTime = 0;
    for (const dStr of allPlayedDates) {
      const t = new Date(dStr).getTime();
      if (prevTime === 0 || t - prevTime <= 86400000 * 1.5) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      prevTime = t;
    }

    // Top tracks
    const topTracks = Array.from(trackPlayCounts.entries())
      .map(([id, plays]) => ({ track: libraryTracks.get(id)!, plays }))
      .filter((i) => i.track != null)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Top artists
    const topArtists = Array.from(artistPlayCounts.entries())
      .map(([name, plays]) => {
        let artworkId: string | null = null;
        for (const t of libraryTracks.values()) {
          if (t.artist === name && t.artworkId) {
            artworkId = t.artworkId;
            break;
          }
        }
        return { name, plays, artworkId };
      })
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6);

    // Top albums
    const topAlbums = Array.from(albumPlayCounts.entries())
      .map(([title, item]) => ({
        title,
        artist: item.artist,
        plays: item.count,
        artworkId: item.artworkId,
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 6);

    // Top genres
    const totalGenreSum = Array.from(genreCounts.values()).reduce((a, b) => a + b, 0) || 1;
    const topGenres = Array.from(genreCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / totalGenreSum) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // New discoveries: tracks played in range whose first play is in range
    const newDiscoveries = topTracks.slice(0, 5).map((t) => t.track);

    return {
      totalMinutes,
      totalPlays,
      uniqueTracks: trackPlayCounts.size,
      uniqueArtists: artistPlayCounts.size,
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      dailyMinutes,
      hourlyPlays: hourly,
      weekdayPlays: weekday,
      topTracks,
      topArtists,
      topAlbums,
      topGenres,
      newDiscoveries,
    };
  }, [events, libraryTracks, range]);

  const formatHours = (mins: number) => {
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs} hrs`;
  };

  const maxDaily = Math.max(1, ...stats.dailyMinutes.map((d) => d.minutes));
  const maxHourly = Math.max(1, ...stats.hourlyPlays);
  const maxWeekday = Math.max(1, ...stats.weekdayPlays);
  const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div
      className="route-enter"
      style={{
        padding: '24px 32px',
        paddingBottom: '64px',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* Title & Range Filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 'var(--font-display)',
              letterSpacing: '-0.03em',
              margin: '0 0 6px 0',
            }}
          >
            Your Listening
          </h1>
          <span style={{ fontSize: 'var(--text-body)', color: 'var(--text-sub)' }}>
            Your 100% offline personal listening analytics
          </span>
        </div>

        {/* Range Selector */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card)',
            padding: 4,
            borderRadius: 'var(--radius-pill)',
            gap: 2,
          }}
        >
          {(
            [
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
              { id: 'year', label: 'This Year' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setRange(t.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 'var(--text-caption)',
                fontWeight: 'var(--font-bold)',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: range === t.id ? 'var(--bg-elevated)' : 'transparent',
                color: range === t.id ? 'var(--text)' : 'var(--text-sub)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards (Spotify Wrapped style) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '36px',
        }}
      >
        {[
          {
            icon: <Clock size={28} color="var(--accent)" weight="fill" />,
            label: 'Listening Time',
            value: formatHours(stats.totalMinutes),
          },
          {
            icon: <ChartBar size={28} color="#3D91F4" weight="fill" />,
            label: 'Total Plays',
            value: stats.totalPlays.toLocaleString(),
          },
          {
            icon: <MusicNotes size={28} color="#A855F7" weight="fill" />,
            label: 'Unique Tracks',
            value: stats.uniqueTracks.toLocaleString(),
          },
          {
            icon: <Fire size={28} color="#FF6437" weight="fill" />,
            label: 'Current Streak',
            value: `${stats.currentStreak} ${stats.currentStreak === 1 ? 'day' : 'days'}`,
          },
          {
            icon: <Trophy size={28} color="#FFAA00" weight="fill" />,
            label: 'Top Artist',
            value: stats.topArtists[0]?.name || '—',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-sub)', fontSize: 'var(--text-caption)', fontWeight: 'var(--font-bold)' }}>
                {kpi.label}
              </span>
              {kpi.icon}
            </div>
            <div
              style={{
                fontSize: 'clamp(20px, 2.5vw, 26px)',
                fontWeight: 'var(--font-heading)',
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* SVG Charts Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          marginBottom: '40px',
        }}
      >
        {/* Chart 1: Minutes per Day */}
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: 'var(--text-h3)', margin: 0, fontWeight: 'var(--font-bold)' }}>
              Minutes per Day
            </h3>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              Peak: {maxDaily}m
            </span>
          </div>

          <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
            {stats.dailyMinutes.map((d, i) => {
              const heightPct = Math.max(4, (d.minutes / maxDaily) * 100);
              return (
                <div
                  key={i}
                  title={`${d.dateStr}: ${d.minutes} mins`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      backgroundColor: d.minutes > 0 ? 'var(--accent)' : 'var(--bg-elevated)',
                      borderRadius: 3,
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-sub)',
                      marginTop: '6px',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Listening by Hour */}
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: 'var(--text-h3)', margin: 0, fontWeight: 'var(--font-bold)' }}>
              Listening by Hour (24h)
            </h3>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              Day & Night rhythm
            </span>
          </div>

          <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: '3px' }}>
            {stats.hourlyPlays.map((plays, h) => {
              const heightPct = Math.max(4, (plays / maxHourly) * 100);
              const isPeak = plays === maxHourly && plays > 0;
              return (
                <div
                  key={h}
                  title={`${h}:00 - ${plays} plays`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      backgroundColor: isPeak ? '#3D91F4' : plays > 0 ? 'var(--accent)' : 'var(--bg-elevated)',
                      borderRadius: 2,
                    }}
                  />
                  {h % 4 === 0 && (
                    <span style={{ fontSize: '9px', color: 'var(--text-sub)', marginTop: '6px' }}>
                      {h}h
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 3: Weekday Pattern */}
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: 'var(--text-h3)', margin: 0, fontWeight: 'var(--font-bold)' }}>
              Weekday Pattern
            </h3>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
              Favorite days
            </span>
          </div>

          <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            {stats.weekdayPlays.map((plays, w) => {
              const heightPct = Math.max(4, (plays / maxWeekday) * 100);
              return (
                <div
                  key={w}
                  title={`${WEEKDAY_NAMES[w]}: ${plays} plays`}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPct}%`,
                      backgroundColor: plays > 0 ? '#A855F7' : 'var(--bg-elevated)',
                      borderRadius: 3,
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-sub)', marginTop: '6px' }}>
                    {WEEKDAY_NAMES[w]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Tracks & Top Genres Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px',
          marginBottom: '40px',
        }}
      >
        {/* Top Tracks List */}
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <h3 style={{ fontSize: 'var(--text-h3)', margin: '0 0 16px 0', fontWeight: 'var(--font-bold)' }}>
            Top Songs
          </h3>

          {stats.topTracks.length === 0 ? (
            <div style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>No tracks played yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.topTracks.slice(0, 5).map(({ track, plays }, idx) => (
                <div
                  key={track.id}
                  onClick={() => void useQueueStore.getState().playNow(track.id)}
                  className="group hover:bg-[var(--bg-card-hover)]"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      textAlign: 'center',
                      fontWeight: 'var(--font-bold)',
                      color: idx === 0 ? 'var(--accent)' : 'var(--text-sub)',
                      fontSize: 'var(--text-body)',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <Cover artworkId={track.artworkId} title={track.title} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 'var(--font-bold)',
                        fontSize: 'var(--text-body)',
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {track.title}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-caption)',
                        color: 'var(--text-sub)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {track.artist}
                    </div>
                  </div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--accent)', fontWeight: 'var(--font-bold)' }}>
                    {plays} {plays === 1 ? 'play' : 'plays'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Genres Breakdown */}
        <div
          style={{
            padding: '24px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <h3 style={{ fontSize: 'var(--text-h3)', margin: '0 0 16px 0', fontWeight: 'var(--font-bold)' }}>
            Genre Breakdown
          </h3>

          {stats.topGenres.length === 0 ? (
            <div style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)' }}>No genre data yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {stats.topGenres.map((g) => (
                <div key={g.name}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--text-body)',
                      fontWeight: 'var(--font-bold)',
                      marginBottom: '6px',
                    }}
                  >
                    <span>{g.name}</span>
                    <span style={{ color: 'var(--text-sub)' }}>{g.pct}%</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      width: '100%',
                      backgroundColor: 'var(--bg-elevated)',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${g.pct}%`,
                        backgroundColor: 'var(--accent)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Artists & Top Albums */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: 'var(--text-h3)', margin: '0 0 16px 0', fontWeight: 'var(--font-bold)' }}>
          Top Artists
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '16px',
          }}
        >
          {stats.topArtists.map((artist) => (
            <div
              key={artist.name}
              style={{
                padding: '16px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-card)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '0 auto 10px auto',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}
              >
                <Cover artworkId={artist.artworkId} title={artist.name} size={100} rounded={false} />
              </div>
              <div
                style={{
                  fontWeight: 'var(--font-bold)',
                  fontSize: 'var(--text-body)',
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {artist.name}
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                {artist.plays} {artist.plays === 1 ? 'play' : 'plays'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
