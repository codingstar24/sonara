import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Shuffle,
  Clock,
  Fire,
  Sparkle,
  ArrowRight,
  Info,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { getCurrentDaypart, DAYPARTS } from '@/config/app';
import { useSettingsStore, useLibraryStore } from '../stores';
import { useQueueStore } from '@/features/queue/queueStore';
import {
  getHomeRecommendations,
  type HomeShelfData,
  type QuickPickItem,
} from '@/recommendation/recommendationService';
import { seedDemoData } from '@/recommendation/seedDemo';
import { Cover } from '@/components/ui/Cover';
import type { TrackLite } from '@/db/types';

export const HomePage: FC = () => {
  const navigate = useNavigate();
  const daypart = getCurrentDaypart();
  const greeting = DAYPARTS[daypart].greeting;
  const displayName = useSettingsStore((s) => s.displayName);

  const libraryTracks = useLibraryStore((s) => s.tracks);
  const totalTracks = useLibraryStore((s) => s.totalTracks);
  const libraryLoading = useLibraryStore((s) => s.loading);

  const [shelfData, setShelfData] = useState<HomeShelfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostPlayedTab, setMostPlayedTab] = useState<'today' | 'sevenDays' | 'thirtyDays' | 'allTime'>('sevenDays');
  const [isSeeding, setIsSeeding] = useState(false);

  // Check URL query for ?demo=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const isDemoRequested = params.get('demo') === '1' || hash.includes('demo=1');

    if (isDemoRequested && totalTracks === 0 && !isSeeding) {
      setIsSeeding(true);
      toast.info('Loading demo library with 400 tracks and 90 days of history...');
      void seedDemoData().then(() => {
        setIsSeeding(false);
        toast.success('Demo library loaded!');
      });
    }
  }, [totalTracks, isSeeding]);

  const fetchRecs = async (force = false) => {
    setLoading(true);
    try {
      const data = await getHomeRecommendations(libraryTracks, force);
      setShelfData(data);
    } catch (e) {
      console.warn('Failed to load home recommendations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!libraryLoading) {
      void fetchRecs(false);
    }
  }, [totalTracks, libraryLoading]);

  const handlePlayTracks = (tracks: TrackLite[], startIndex = 0, name = 'Home Selection') => {
    if (tracks.length === 0) return;
    const trackIds = tracks.map((t) => t.id);
    const startId = trackIds[startIndex] || trackIds[0];
    void useQueueStore.getState().playContext('songs', 'home', name, trackIds, startId);
  };

  const handleShuffleTracks = (tracks: TrackLite[], name = 'Home Selection') => {
    if (tracks.length === 0) return;
    const trackIds = tracks.map((t) => t.id);
    useQueueStore.getState().toggleShuffle();
    void useQueueStore.getState().playContext('songs', 'home', name, trackIds);
  };

  const handleQuickPickClick = (item: QuickPickItem) => {
    if (item.type === 'liked') {
      navigate('/liked');
    } else if (item.type === 'playlist') {
      navigate(`/playlist/${item.id}`);
    } else if (item.type === 'artist') {
      navigate(`/artist/${encodeURIComponent(item.title)}`);
    } else if (item.type === 'album') {
      navigate(`/album/${encodeURIComponent(item.id)}`);
    }
  };

  const handlePlayQuickPick = (e: React.MouseEvent, item: QuickPickItem) => {
    e.stopPropagation();
    if (item.trackIds.length === 0) return;
    void useQueueStore.getState().playContext(
      item.type === 'liked' ? 'liked' : 'playlist',
      item.id,
      item.title,
      item.trackIds,
      item.trackIds[0]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !shelfData) {
    return (
      <div className="route-enter" style={{ padding: '24px 32px' }}>
        <div style={{ height: 48, width: 320, background: 'var(--bg-elevated)', borderRadius: 8, marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 56, background: 'var(--bg-card)', borderRadius: 6 }} />
          ))}
        </div>
      </div>
    );
  }

  const isColdStart = (shelfData?.personalizationRamp || 0) < 0.2 && totalTracks < 20;

  return (
    <div className="route-enter" style={{ padding: '24px 32px', paddingBottom: '64px' }}>
      {/* Top Header & Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1
          style={{
            fontSize: 'clamp(26px, 3.5vw, 42px)',
            fontWeight: 'var(--font-display)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {greeting}{displayName ? `, ${displayName}` : ''}
        </h1>

        <button
          onClick={() => void fetchRecs(true)}
          title="Refresh recommendations"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-sub)',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 'var(--radius-pill)',
            fontSize: 'var(--text-caption)',
          }}
          className="hover:text-white"
        >
          <ArrowsClockwise size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Cold start greeting banner if library is empty or new */}
      {isColdStart && (
        <div
          style={{
            marginBottom: '32px',
            padding: '24px 28px',
            background: 'linear-gradient(135deg, rgba(30,215,96,0.15), rgba(18,18,18,0.8))',
            border: '1px solid rgba(30,215,96,0.25)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
          }}
        >
          <div>
            <h2 style={{ fontSize: 'var(--text-h3)', margin: '0 0 6px 0', color: 'var(--text)' }}>
              Welcome to Sonara
            </h2>
            <p style={{ margin: 0, color: 'var(--text-sub)', fontSize: 'var(--text-body)', maxWidth: 640 }}>
              Play a few songs and Sonara will start tailoring this page to your unique taste. Or load the synthetic demo library to explore all personalized shelves right now.
            </p>
          </div>

          <button
            onClick={() => {
              setIsSeeding(true);
              toast.info('Seeding demo library with 400 tracks...');
              void seedDemoData().then(() => {
                setIsSeeding(false);
                toast.success('Demo library loaded!');
                void fetchRecs(true);
              });
            }}
            disabled={isSeeding}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--accent)',
              color: '#000',
              fontWeight: 'var(--font-bold)',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              cursor: isSeeding ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sparkle size={18} weight="fill" />
            <span>{isSeeding ? 'Loading...' : 'Load Demo Library'}</span>
          </button>
        </div>
      )}

      {/* 1. Quick Picks Grid (8 tiles, 56px high, hover play button) */}
      {shelfData && shelfData.quickPicks.length > 0 && (
        <section style={{ marginBottom: '36px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {shelfData.quickPicks.slice(0, 8).map((item) => (
              <div
                key={item.id}
                onClick={() => handleQuickPickClick(item)}
                className="group"
                style={{
                  height: 56,
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                {/* Left artwork / icon */}
                <div style={{ width: 56, height: 56, flexShrink: 0 }}>
                  {item.type === 'liked' ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #450af5, #8e8ee5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Sparkle size={24} weight="fill" color="#fff" />
                    </div>
                  ) : (
                    <Cover artworkId={item.artworkId} title={item.title} size={56} rounded={false} />
                  )}
                </div>

                {/* Text Title */}
                <div style={{ padding: '0 14px', flex: 1, minWidth: 0 }}>
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
                    {item.title}
                  </div>
                </div>

                {/* Hover Play Button */}
                <button
                  onClick={(e) => handlePlayQuickPick(e, item)}
                  aria-label={`Play ${item.title}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    marginRight: '12px',
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    border: 'none',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  }}
                >
                  <Play size={18} weight="fill" style={{ marginLeft: 2 }} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. Continue Listening (if active) */}
      {shelfData?.continueListening && (
        <section style={{ marginBottom: '36px' }}>
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Cover
                artworkId={shelfData.continueListening.track.artworkId}
                title={shelfData.continueListening.track.title}
                size={64}
              />
              <div>
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--accent)', fontWeight: 'var(--font-bold)', textTransform: 'uppercase' }}>
                  Continue Listening
                </div>
                <div style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>
                  {shelfData.continueListening.track.title}
                </div>
                <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-sub)' }}>
                  {shelfData.continueListening.track.artist}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const track = shelfData.continueListening!.track;
                void useQueueStore.getState().playNow(track.id);
                useQueueStore.getState().seek(shelfData.continueListening!.positionMs / 1000);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: 'var(--accent)',
                color: '#000',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                fontWeight: 'var(--font-bold)',
                cursor: 'pointer',
              }}
            >
              <Play size={18} weight="fill" />
              <span>Resume at {formatTime(shelfData.continueListening.positionMs / 1000)}</span>
            </button>
          </div>
        </section>
      )}

      {/* 3. Picked for You Right Now (with "Why this?" tooltips) */}
      {shelfData && shelfData.pickedForYou.length >= 4 && (
        <section style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--font-heading)', margin: 0 }}>
                {shelfData.pickedForYouTitle}
              </h2>
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-sub)' }}>
                Curated for your current vibe & time of day
              </span>
            </div>
            <button
              onClick={() => handlePlayTracks(shelfData.pickedForYou.map((p) => p.track), 0, shelfData.pickedForYouTitle)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontWeight: 'var(--font-bold)',
                cursor: 'pointer',
              }}
            >
              Play all
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            {shelfData.pickedForYou.slice(0, 8).map((item) => (
              <div
                key={item.track.id}
                onClick={() => void useQueueStore.getState().playNow(item.track.id)}
                className="group"
                style={{
                  padding: '14px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-card)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Cover artworkId={item.track.artworkId} title={item.track.title} size={152} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void useQueueStore.getState().playNow(item.track.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      position: 'absolute',
                      right: 8,
                      bottom: 8,
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      border: 'none',
                      color: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                  >
                    <Play size={20} weight="fill" style={{ marginLeft: 2 }} />
                  </button>
                </div>

                <div
                  style={{
                    fontWeight: 'var(--font-bold)',
                    fontSize: 'var(--text-body)',
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: '4px',
                  }}
                >
                  {item.track.title}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-caption)',
                    color: 'var(--text-sub)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: '8px',
                  }}
                >
                  {item.track.artist}
                </div>

                {/* "Why this?" reason badge */}
                {item.reasons.length > 0 && (
                  <div
                    title={item.reasons.join(' · ')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      color: 'var(--text-sub)',
                      backgroundColor: 'var(--bg-elevated)',
                      padding: '3px 7px',
                      borderRadius: 'var(--radius-pill)',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Info size={12} color="var(--accent)" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.reasons[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Made For You — Daily Mixes 1-6 */}
      {shelfData && shelfData.dailyMixes.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--font-heading)', marginBottom: '16px' }}>
            Made For You
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            {shelfData.dailyMixes.map((mix) => (
              <div
                key={mix.id}
                onClick={() => handlePlayTracks(mix.tracks, 0, mix.name)}
                className="group"
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-card)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                {/* 2x2 Collage Cover with Tint Overlay and Mix Number */}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    borderRadius: 'var(--radius-card)',
                    overflow: 'hidden',
                    position: 'relative',
                    marginBottom: '12px',
                    background: mix.tintColor,
                  }}
                >
                  {/* Subtle 2x2 mosaic or icon */}
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gridTemplateRows: '1fr 1fr',
                      opacity: 0.85,
                    }}
                  >
                    {mix.artworkIds.slice(0, 4).map((artId, aIdx) => (
                      <div key={aIdx} style={{ overflow: 'hidden' }}>
                        <Cover artworkId={artId} title={`Mix ${mix.mixIndex}`} size={85} rounded={false} />
                      </div>
                    ))}
                  </div>

                  {/* Tint Overlay Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      backdropFilter: 'blur(8px)',
                      color: mix.tintColor,
                      fontSize: '12px',
                      fontWeight: 'var(--font-bold)',
                    }}
                  >
                    MIX {mix.mixIndex}
                  </div>

                  {/* Play Button Overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayTracks(mix.tracks, 0, mix.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      position: 'absolute',
                      right: 10,
                      bottom: 10,
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      border: 'none',
                      color: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                  >
                    <Play size={20} weight="fill" style={{ marginLeft: 2 }} />
                  </button>
                </div>

                <div
                  style={{
                    fontWeight: 'var(--font-bold)',
                    fontSize: 'var(--text-body)',
                    color: 'var(--text)',
                    marginBottom: '4px',
                  }}
                >
                  {mix.name}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-caption)',
                    color: 'var(--text-sub)',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {mix.subtitle}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. On Repeat (top tracks in last 14 days) */}
      {shelfData && shelfData.onRepeat.length >= 4 && (
        <section style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--font-heading)', margin: 0 }}>
              On Repeat
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handlePlayTracks(shelfData.onRepeat, 0, 'On Repeat')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                <Play size={14} weight="fill" />
                <span>Play all</span>
              </button>
              <button
                onClick={() => handleShuffleTracks(shelfData.onRepeat, 'On Repeat')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: 'none',
                  color: 'var(--text)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 'var(--font-bold)',
                  cursor: 'pointer',
                }}
              >
                <Shuffle size={14} />
                <span>Shuffle</span>
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px',
            }}
          >
            {shelfData.onRepeat.slice(0, 6).map((track) => (
              <div
                key={track.id}
                onClick={() => void useQueueStore.getState().playNow(track.id)}
                className="group"
                style={{
                  padding: '14px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-card)',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Cover artworkId={track.artworkId} title={track.title} size={152} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void useQueueStore.getState().playNow(track.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      position: 'absolute',
                      right: 8,
                      bottom: 8,
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      border: 'none',
                      color: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}
                  >
                    <Play size={20} weight="fill" style={{ marginLeft: 2 }} />
                  </button>
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
            ))}
          </div>
        </section>
      )}

      {/* 6. Your Most Played (with Segmented Control) */}
      {shelfData && (
        <section style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--font-heading)', margin: 0 }}>
              Your Most Played
            </h2>

            {/* Segmented Control */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-card)',
                padding: 3,
                borderRadius: 'var(--radius-pill)',
                gap: 2,
              }}
            >
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'sevenDays', label: '7 Days' },
                  { id: 'thirtyDays', label: '30 Days' },
                  { id: 'allTime', label: 'All Time' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMostPlayedTab(tab.id)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 'var(--text-caption)',
                    fontWeight: 'var(--font-bold)',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: mostPlayedTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
                    color: mostPlayedTab === tab.id ? 'var(--text)' : 'var(--text-sub)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {shelfData.mostPlayed[mostPlayedTab].length === 0 ? (
            <div style={{ color: 'var(--text-sub)', fontSize: 'var(--text-body)', padding: '16px 0' }}>
              No plays recorded for this time range yet.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {shelfData.mostPlayed[mostPlayedTab].slice(0, 6).map(({ track, playCount }) => (
                <div
                  key={track.id}
                  onClick={() => void useQueueStore.getState().playNow(track.id)}
                  className="group"
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-card)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'relative', marginBottom: '10px' }}>
                    <Cover artworkId={track.artworkId} title={track.title} size={152} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void useQueueStore.getState().playNow(track.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 8,
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent)',
                        border: 'none',
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      }}
                    >
                      <Play size={20} weight="fill" style={{ marginLeft: 2 }} />
                    </button>
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
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--accent)',
                      fontWeight: 'var(--font-bold)',
                      marginTop: '4px',
                    }}
                  >
                    {playCount} {playCount === 1 ? 'play' : 'plays'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 7. Top Artists (Circular Avatars) */}
      {shelfData && shelfData.topArtists.length >= 4 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: 'var(--text-h2)', fontWeight: 'var(--font-heading)', marginBottom: '16px' }}>
            Your Top Artists
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '16px',
            }}
          >
            {shelfData.topArtists.slice(0, 6).map((artist) => (
              <div
                key={artist.name}
                onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-card)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    width: 128,
                    height: 128,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    margin: '0 auto 12px auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  <Cover artworkId={artist.artworkId} title={artist.name} size={128} rounded={false} />
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
                  Artist · {artist.trackCount} songs
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Listening Snapshot Strip (Footer Banner) */}
      {shelfData && (
        <div
          onClick={() => navigate('/stats')}
          style={{
            marginTop: '48px',
            padding: '20px 24px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'background-color var(--transition-fast)',
          }}
          className="hover:bg-[var(--bg-card-hover)]"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={24} color="var(--accent)" weight="fill" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase' }}>
                  Today's Listening
                </div>
                <div style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>
                  {shelfData.snapshot.minutesToday} mins
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Fire size={24} color="#ff6437" weight="fill" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase' }}>
                  Listening Streak
                </div>
                <div style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>
                  {shelfData.snapshot.streakDays} {shelfData.snapshot.streakDays === 1 ? 'day' : 'days'}
                </div>
              </div>
            </div>

            {shelfData.snapshot.topArtistThisWeek && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', textTransform: 'uppercase' }}>
                  Top Artist
                </div>
                <div style={{ fontSize: 'var(--text-body)', fontWeight: 'var(--font-bold)', color: 'var(--text)' }}>
                  {shelfData.snapshot.topArtistThisWeek}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 'var(--font-bold)', fontSize: 'var(--text-body)' }}>
            <span>View Listening Stats</span>
            <ArrowRight size={18} />
          </div>
        </div>
      )}
    </div>
  );
};
