// App-wide constants and tunable algorithm parameters
export const APP_NAME = 'Sonara';
export const APP_VERSION = '1.0.0';
export const APP_AUTHOR = 'zohair';
export const APP_CREDITS = 'Designed and developed by zohair';

// --- Layout ---
export const SIDEBAR_DEFAULT_WIDTH = 320;
export const SIDEBAR_MIN_WIDTH = 72;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_COLLAPSE_THRESHOLD = 160;
export const SIDEBAR_ICON_RAIL_WIDTH = 72;
export const RIGHT_PANEL_DEFAULT_WIDTH = 340;
export const RIGHT_PANEL_MIN_WIDTH = 280;
export const RIGHT_PANEL_MAX_WIDTH = 420;
export const RIGHT_PANEL_AUTO_HIDE_WIDTH = 1100;
export const MIN_WINDOW_WIDTH = 900;
export const MIN_WINDOW_HEIGHT = 600;
export const TOP_BAR_HEIGHT = 56;
export const PLAYER_BAR_HEIGHT = 80;

// --- Row sizes ---
export const ROW_HEIGHT_COMFORTABLE = 56;
export const ROW_HEIGHT_COMPACT = 32;

// --- Timing ---
export const SEARCH_DEBOUNCE_MS = 120;
export const SCROLL_RESTORE_DELAY_MS = 50;
export const ROUTE_TRANSITION_MS = 150;
export const THEME_TRANSITION_MS = 150;
export const DYNAMIC_HEADER_FADE_MS = 400;
export const DYNAMIC_HEADER_HEIGHT = 340;

// --- Playback ---
export const CROSSFADE_MIN = 0;
export const CROSSFADE_MAX = 12;
export const CROSSFADE_DEFAULT = 0;
export const PRELOAD_BEFORE_END_S = 15;
export const SKIP_FADE_MS = 150;
export const CONSECUTIVE_FAIL_LIMIT = 5;
export const POSITION_SAVE_INTERVAL_MS = 5000;
export const LONG_TRACK_THRESHOLD_S = 1200; // 20 minutes
export const RESTART_THRESHOLD_S = 3;

// --- Sleep timer ---
export const SLEEP_FADE_DURATION_S = 20;
export const SLEEP_FADE_MIN_S = 0;
export const SLEEP_FADE_MAX_S = 30;
export const SLEEP_CHECK_INTERVAL_MS = 500;

// --- Import ---
export const WORKER_POOL_SIZE_FACTOR = 1; // min(4, cores - FACTOR)
export const IMPORT_BATCH_SIZE = 25;
export const MIN_TRACK_DURATION_S = 0;
export const ARTWORK_FULL_MAX_PX = 1000;
export const ARTWORK_THUMB_MAX_PX = 160;
export const ARTWORK_COVER_FILENAMES = ['cover', 'folder', 'front', 'album'];

// --- Thumbnails ---
export const THUMBNAIL_CACHE_SIZE = 300;
export const DOMINANT_COLOR_SAMPLE_SIZE = 16;

// --- Recommendation half-lives (in milliseconds) ---
export const HALF_LIFE_SHORT = 3 * 24 * 60 * 60 * 1000;    // 3 days
export const HALF_LIFE_LONG = 30 * 24 * 60 * 60 * 1000;    // 30 days
export const HALF_LIFE_CONTEXT = 7 * 24 * 60 * 60 * 1000;  // 7 days
export const HALF_LIFE_PLAYS30 = 30 * 24 * 60 * 60 * 1000;
export const HALF_LIFE_SKIPS30 = 30 * 24 * 60 * 60 * 1000;

// --- Play event classification ---
export const COUNTED_MIN_S = 30;
export const COUNTED_MIN_FRACTION = 0.5;
export const COMPLETED_MIN_FRACTION = 0.9;
export const EARLY_SKIP_MAX_S = 10;
export const EARLY_SKIP_MIN_DURATION_S = 20;
export const REPLAY_BONUS_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// --- Event weights ---
export const WEIGHT_COMPLETED = 1.0;
export const WEIGHT_COUNTED = 0.6;
export const WEIGHT_REPLAY_BONUS = 0.4;
export const WEIGHT_EARLY_SKIP = -0.7;

// --- Ranking (7.3) ---
export const LIKE_BOOST = 1.3;
export const PLAYLIST_BOOST_PER = 0.05;
export const PLAYLIST_BOOST_CAP = 4;
export const SKIP_PENALTY_MAX = 0.5;
export const SKIP_PENALTY_WEIGHT = 0.6;
export const TIME_AFFINITY_WEIGHT = 0.75;
export const TIME_AFFINITY_MIN_PLAYS = 5;
export const COOLDOWN_FACTOR = 0.4;
export const COOLDOWN_WINDOW_MS = 45 * 60 * 1000;
export const DIVERSITY_ARTIST_DECAY = 0.75;
export const MAX_CONSECUTIVE_SAME_ALBUM = 3;
export const EXPLORATION_FRACTION = 0.15;
export const TOP_TRACKS_FOR_EXPLORATION = 20;

// --- Similarity (7.4) ---
export const SIM_SAME_ARTIST = 0.35;
export const SIM_SAME_ALBUM = 0.20;
export const SIM_GENRE_JACCARD = 0.20;
export const SIM_YEAR_PROXIMITY = 0.10;
export const SIM_CO_LISTENING = 0.10;
export const SIM_SAME_FOLDER = 0.05;
export const SIM_YEAR_RANGE = 10;
export const CO_LISTENING_SESSION_GAP_MS = 30 * 60 * 1000;

// --- Personalization ---
export const PERSONALIZATION_THRESHOLD = 100;
export const PERSONALIZATION_MIN_SHOW = 0.2;

// --- Daily Mix ---
export const DAILY_MIX_MAX = 6;
export const DAILY_MIX_MIN_TRACKS = 20;
export const DAILY_MIX_SIZE = 50;
export const DAILY_MIX_FAMILIAR_PCT = 0.55;
export const DAILY_MIX_REDISCOVERY_PCT = 0.25;
export const DAILY_MIX_DISCOVERY_PCT = 0.20;
export const DAILY_MIX_FAMILIAR_FIRST = 5;
export const DAILY_MIX_REDISCOVERY_DAYS = 14;
export const DAILY_MIX_TOP_TRACKS = 300;

// --- Home ---
export const QUICK_PICKS_COUNT = 8;
export const RECS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const HOME_SHELF_MIN_ITEMS = 4;

// --- Queue ---
export const QUEUE_HISTORY_CAP = 500;
export const AUTOPLAY_APPEND_COUNT = 30;

// --- Supported formats ---
export const SUPPORTED_EXTENSIONS = new Set([
  'mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'oga', 'opus', 'webm',
]);
export const KNOWN_UNSUPPORTED_EXTENSIONS = new Set([
  'wma', 'alac', 'ape', 'aiff', 'aif', 'dsf', 'dff', 'mpc', 'tak', 'tta', 'wv',
]);
export const AUDIO_EXTENSIONS = new Set([
  ...SUPPORTED_EXTENSIONS, ...KNOWN_UNSUPPORTED_EXTENSIONS,
]);

// --- Equalizer ---
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_MIN_DB = -12;
export const EQ_MAX_DB = 12;
export const EQ_Q = 1.0;

// --- Dayparts ---
export const DAYPARTS = {
  morning: { start: 5, end: 11, greeting: 'Good morning', shelfTitle: 'Morning picks' },
  afternoon: { start: 11, end: 17, greeting: 'Good afternoon', shelfTitle: 'Afternoon picks' },
  evening: { start: 17, end: 22, greeting: 'Good evening', shelfTitle: 'Evening picks' },
  night: { start: 22, end: 5, greeting: 'Good night', shelfTitle: 'Late-night picks' },
} as const;

export type Daypart = keyof typeof DAYPARTS;

export function getCurrentDaypart(): Daypart {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

// --- Playlist order key spacing ---
export const ORDER_KEY_INITIAL = 1000;
export const ORDER_KEY_GAP = 1000;
