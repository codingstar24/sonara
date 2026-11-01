# Sonara — Spotify-Style Local Music Player

> **Sonara** is a production-grade, 100% offline, privacy-first local music player web application designed with the exact visual language, layout, and UX polish of the Spotify desktop client. Built for audiophiles and power users who own their music library, Sonara requires zero cloud accounts, sends zero telemetry, and is architected to run seamlessly in the browser or packaged as a standalone Windows desktop executable via Electron.

---

## Table of Contents
1. [Core Features](#core-features)
2. [Design & Visual Language](#design--visual-language)
3. [Architecture Overview](#architecture-overview)
4. [Audio Engine & DSP Pipeline](#audio-engine--dsp-pipeline)
5. [Database Schema & Data Flow](#database-schema--data-flow)
6. [Recommendation Engine & Formulas](#recommendation-engine--formulas)
7. [Getting Started & Development](#getting-started--development)
8. [Keyboard Shortcuts Reference](#keyboard-shortcuts-reference)
9. [Browser Limitations & Workarounds](#browser-limitations--workarounds)
10. [Desktop Packaging (Electron)](#desktop-packaging-electron)

---

## Core Features

- **Spotify Desktop Aesthetic**: Exact 3-column layout (collapsible left navigation library, resizable right inspection panel, persistent 80px playback bottom bar, floating contextual cards, custom tooltips, and Spotify-dark theme with HSL green accent `#1ED760`).
- **100% Local & Offline**: Operates completely in the client without external APIs, analytics, or network dependencies.
- **Dual-Deck Web Audio Engine**: Gapless playback and sample-accurate crossfading (0–12 seconds) using two synchronized `HTMLAudioElement` nodes routed through a Web Audio API graph (`AudioContext` -> `BiquadFilterNode` bank -> `AnalyserNode` -> `GainNode`).
- **10-Band Graphic Equalizer**: Interactive SVG frequency curve with standard acoustic center frequencies (31Hz to 16kHz), gain range (-12dB to +12dB), preamp gain, and built-in genre presets (Acoustic, Bass Booster, Classical, Electronic, Flat, Rock, Vocal Booster, etc.).
- **60fps Real-Time Audio Visualizer**: Frequency spectrum and wave visualizer rendered on HTML5 Canvas using an active `AnalyserNode` (2048 FFT size, 0.8 smoothing time constant).
- **Synchronized LRC Lyrics**: Ultra-smooth auto-scrolling lyrics viewer with active line glow, click-to-seek, millisecond offset adjustments, and an inline editor to add or rectify lyrics on any track.
- **Smart Recommendations (Offline AI)**: Home page featuring daypart-aware greeting, Quick Picks 2x3 grid, "Picked for You Right Now" (with deterministic "Why this?" contextual explanations), Daily Mixes 1–6 (automatic genre & era clustering with 2x2 artwork collages), and "On Repeat".
- **Listening Stats & Wrapped**: Offline analytics computing listening minutes, total plays, day streaks, hourly circadian listening rhythm, weekday distributions, and genre breakdowns using pure-SVG charts.
- **Library Health Diagnostics**: Detects bit-identical duplicates (via content fingerprints), missing files, tracks without embedded artwork, short skits (<30s), and unsupported formats.
- **Global Command Palette (`Ctrl+K`)**: Rapid cmdk search for songs, albums, artists, playback controls, navigation, and audio tools.
- **Full Keyboard Navigation**: Space to toggle play/pause, `Ctrl + Left/Right` to skip, `Shift + Left/Right` for 5s seeks, `Ctrl + Up/Down` for volume, `L` to like, `S` to shuffle, `R` to repeat, `F` for fullscreen, `E` for EQ, `Y` for lyrics, and `Q` for queue.
- **JSON Backup & Restore**: Full export and restore with cryptographic fingerprint mapping so playlists, play counts, and likes survive library path migrations.

---

## Design & Visual Language

Sonara adopts Spotify's modern design system implemented strictly via CSS tokens (`tokens.css`) without ad-hoc utility clutter:
- **Color Palettes**:
  - Base Background: `#121212` (`--bg-base`)
  - Elevated Cards: `#181818` (`--bg-card`)
  - Card Hover: `#282828` (`--bg-card-hover`)
  - Active / Selection: `#333333` (`--bg-card-active`)
  - Accent Green: `#1ED760` (customizable in Settings to Purple, Blue, Amber, Rose, or Cyan)
  - Typography Colors: `#FFFFFF` (primary), `#A7A7A7` (subdued), `#727272` (tertiary)
- **Typography**: Inter Variable typography with strict scale (`--text-display` 24px, `--text-title` 18px, `--text-body` 14px, `--text-caption` 12px, `--text-micro` 11px).
- **Surfaces & Borders**: 8px rounded container panels, 4px/8px radii for media covers, 1px subtle borders (`#282828`), and elevation drop-shadows.

---

## Architecture Overview

Sonara follows a modular architecture cleanly decoupled by domains:

```
src/
├── app/                      # Application shell & orchestration
│   ├── App.tsx               # Root layout, routing, drag-and-drop listener
│   ├── TopBar.tsx            # Navigation history buttons, search, user avatar
│   ├── Sidebar.tsx           # Library sidebar with pinned items, playlists, smart lists
│   ├── PlayerBar.tsx         # Spotify-style 80px playback bottom bar with scrubbers
│   ├── RightPanel.tsx        # Resizable contextual panel (Now Playing, Lyrics, Queue)
│   ├── stores.ts             # Central UI, library, settings, and playback Zustand stores
│   └── pages/                # View components (Home, Search, Songs, Albums, Artists, etc.)
├── engine/                   # Audio playback engine
│   ├── audioEngine.ts        # Dual-deck Web Audio graph, crossfade, EQ, normalization
│   └── clock.ts              # High-precision rAF playback clock decoupled from React state
├── db/                       # Persistence layer
│   ├── schema.ts             # Dexie IndexedDB tables, schema indexes, default settings
│   └── types.ts              # Core TypeScript interfaces (Track, Album, Playlist, PlayEvent, etc.)
├── features/                 # Discrete functional sub-systems
│   ├── audio/                # Visualizer canvas and 10-band Equalizer modal
│   ├── import/               # File System Access API scanner & metadata extraction pipeline
│   ├── lyrics/               # LRC parser, active line tracker, synchronized lyrics viewer
│   ├── likes/                # Optimistic likes store with Dexie sync
│   ├── playlists/            # Playlist store, smart playlist rules evaluator, DND reordering
│   ├── player/               # Fullscreen modal, Now Playing panel, keyboard shortcuts
│   └── queue/                # Playback queue, shuffle permutations, history tracking
├── recommendation/           # Deterministic recommendation math
│   ├── decay.ts              # Half-life exponential decay formulas (7-day and 30-day)
│   ├── similarity.ts         # Multi-factor track similarity (artist, genre, year, tempo)
│   ├── rank.ts               # Context-aware ranking with diversity MMR re-ranking
│   ├── dailyMix.ts           # Genre/era graph clustering for Daily Mixes 1–6
│   ├── personalization.ts    # Daypart time-of-day affinity vector calculations
│   └── seedDemo.ts           # 400-track synthetic library generator with 90-day history
├── lib/                      # Pure utilities
│   ├── backup.ts             # JSON export/import with fingerprint remapping
│   ├── orderKey.ts           # Fractional lexicographical string indexing for playlists
│   ├── parsers.ts            # M3U, M3U8, and PLS playlist parser
│   └── platform.ts           # Abstract PlatformAdapter (Web vs Electron)
└── styles/                   # Design system tokens and global resets
```

---

## Audio Engine & DSP Pipeline

Modern browsers throttle `timeupdate` events on HTML media elements to only 3–4 times per second, which creates jittery seek bars. Sonara bypasses this with a custom Web Audio architecture:

1. **Dual Deck System**:
   - Two persistent audio instances: `Deck A` and `Deck B`.
   - Primary track plays on Deck A. When within `crossfadeS` seconds of ending, Deck B begins pre-buffering the next track.
   - At the transition point, an exponential equal-power crossfade curve (`Math.cos` / `Math.sin`) interpolates gain between both decks.
   - In gapless mode (`crossfadeS === 0`), Deck B initiates playback precisely as Deck A finishes with zero audible silence.
2. **Web Audio Graph**:
   ```
   [ Deck A Audio Element ] ──> [ Deck A Gain ] ──┐
                                                  ├──> [ 10-Band Biquad Filters ] ──> [ AnalyserNode ] ──> [ Master Gain ] ──> [ AudioDestination ]
   [ Deck B Audio Element ] ──> [ Deck B Gain ] ──┘
   ```
3. **Decoupled Playback Clock**:
   - `PlaybackClock` maintains an internal monotonic anchor timestamp.
   - UI seek bars and lyric scrollers subscribe via `requestAnimationFrame` and request `clock.getCurrentTime()`.
   - Playhead scrubbers advance at a smooth 60 frames per second without triggering React re-renders.

---

## Database Schema & Data Flow

Sonara utilizes **Dexie.js** (IndexedDB wrapper) with in-memory indexes (`MiniSearch` and fast JS Maps) for sub-millisecond query performance across 50,000+ tracks.

### IndexedDB Tables
- **`sources`**: Configured root directories or files. Stores directory handles (in browser) or absolute directory paths (in Electron).
- **`tracks`**: Audio metadata (`id`, `fingerprint`, `title`, `artist`, `album`, `genres`, `year`, `duration`, `bitrate`, `sampleRate`, `codec`, `lossless`, `trackNo`, `discNo`, `missing`).
- **`artwork`**: Deduplicated binary image blobs (`id`, `mimeType`, `data`, `width`, `height`, `dominantColor`).
- **`playlists`**: User playlists and smart playlists (`id`, `name`, `kind`, `smartRules`, `coverArtworkId`, `sortMode`).
- **`playlistTracks`**: Junction table with fractional order keys (`id`, `playlistId`, `trackId`, `order`).
- **`likes`**: Fast lookup table for liked songs (`trackId`, `likedAt`).
- **`playEvents`**: Raw event telemetry (`id`, `trackId`, `timestamp`, `durationPlayedMs`, `completed`, `skipped`, `hourOfDay`, `dayOfWeek`).
- **`trackStats`**: Pre-aggregated metrics per track (`trackId`, `playCount`, `skipCount`, `completionCount`, `totalTimePlayedMs`, `lastPlayedAt`).
- **`contextStats`**: Aggregates by daypart (`morning`, `afternoon`, `evening`, `night`).
- **`lyrics`**: Synced LRC strings or unsynced text (`trackId`, `lrc`, `synced`, `source`).
- **`settings`**: User preferences, EQ curves, theme selection, and audio configs.

---

## Recommendation Engine & Formulas

Sonara provides an intelligent, Spotify-grade recommendation experience that runs 100% locally on your computer with deterministic mathematics.

### 1. Exponential Decay Affinity
Every playback event retains value that decays over time. Sonara calculates two distinct weights:
- **Short-term Affinity (7-day half-life)**: Captures recent obsessions.
  $$\lambda_{\text{short}} = \frac{\ln(2)}{7 \times 86400000} \approx 1.145 \times 10^{-9} \text{ ms}^{-1}$$
- **Long-term Affinity (30-day half-life)**: Captures enduring catalog favorites.
  $$\lambda_{\text{long}} = \frac{\ln(2)}{30 \times 86400000} \approx 2.673 \times 10^{-10} \text{ ms}^{-1}$$
- Track score contribution:
  $$\text{Score}(t) = \sum_{e \in \text{events}(t)} \left(0.6 \cdot e^{-\lambda_{\text{short}} \Delta t_e} + 0.4 \cdot e^{-\lambda_{\text{long}} \Delta t_e}\right) \cdot \text{completionFactor}(e)$$
  *(where $\text{completionFactor}$ is 1.0 if completed $>80\%$, 0.2 if skipped $<30s$)*.

### 2. Contextual Multipliers
- **Liked Track**: $\times 1.50$ multiplier.
- **In User Playlists**: $+0.15$ per unique playlist inclusion (capped at $+0.60$).
- **Excessive Skip Penalty**: If $\frac{\text{skips}}{\text{plays}} > 0.4$, score is multiplied by $(1.0 - \text{skipRatio} \times 0.5)$.

### 3. Time-of-Day Personalization
Sonara computes an hourly affinity vector for each track and artist:
- **Morning (05:00–11:59)**: Boosts acoustic, ambient, classical, and jazz genres.
- **Afternoon (12:00–16:59)**: Boosts pop, rock, electronic, and indie genres.
- **Evening (17:00–21:59)**: Boosts energetic, hip-hop, workout, and upbeat playlists.
- **Night (22:00–04:59)**: Boosts downtempo, lofi, ambient, and late-night favorites.

### 4. Maximal Marginal Relevance (MMR) Diversity
To avoid recommendation fatigue (e.g. recommending 20 songs from the same artist in a row), Sonara applies MMR re-ranking:
$$\text{MMR}(t) = \lambda \cdot \text{Relevance}(t) - (1 - \lambda) \cdot \max_{s \in \text{Selected}} \text{Similarity}(t, s)$$
*(with $\lambda = 0.70$ to balance high relevance with artist/genre variety)*.

### 5. Daily Mix Clustering (Mixes 1–6)
Daily Mixes are generated by building a graph of user listening history:
1. Clusters top artists by genre overlap, era proximity, and co-listening frequency into up to 6 distinct clusters.
2. Mixes are anchored by familiar favorites (70% top played in that cluster) and complemented by library discovery (30% less-frequently played or newly added tracks in the same genre).
3. Artwork generates a Spotify-style 2x2 quadrant collage using album art from the top 4 contributing artists.

---

## Getting Started & Development

### Prerequisites
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Installation & Run

```bash
# Clone the repository
cd Zachy

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` in any modern Chromium-based browser (Chrome, Edge, Brave) or Firefox.

### Project Verification Commands

```bash
# Type check all TypeScript files
npm run typecheck

# Lint codebase against ESLint rules
npm run lint

# Run all 60+ unit tests across 11 test suites
npm test

# Build production bundle
npm run build
```

---

## Keyboard Shortcuts Reference

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| **`Space`** | Play / Pause | Global |
| **`Ctrl + Right`** | Next Track | Global |
| **`Ctrl + Left`** | Previous Track (or restart if >3s) | Global |
| **`Shift + Right`** | Seek forward 5 seconds | Global |
| **`Shift + Left`** | Seek backward 5 seconds | Global |
| **`Ctrl + Up`** | Volume up 5% | Global |
| **`Ctrl + Down`** | Volume down 5% | Global |
| **`M`** | Toggle Mute | Global |
| **`S`** | Toggle Shuffle mode | Global |
| **`R`** | Cycle Repeat (Off -> All -> One) | Global |
| **`L`** | Like / Unlike currently playing track | Global |
| **`F`** | Toggle Fullscreen immersive mode | Global |
| **`E`** | Toggle 10-Band Graphic Equalizer modal | Global |
| **`Y`** | Toggle Lyrics panel in right sidebar | Global |
| **`Q`** | Toggle Queue panel in right sidebar | Global |
| **`N`** | Toggle Now Playing detail panel | Global |
| **`Ctrl + K`** | Open Global Command Palette | Global |
| **`/`** or **`Ctrl + L`** | Focus Search input | Global |
| **`Ctrl + ,`** | Open Settings | Global |
| **`Esc`** | Close active modal, drawer, or clear search | Global |

---

## Browser Limitations & Workarounds

When running Sonara inside a standard web browser (as opposed to packaged Electron), certain platform security policies apply:

1. **File System Handle Re-authorization**:
   - The W3C File System Access API requires user gesture re-authorization after a browser restart to read audio files from disk.
   - *Sonara Workaround*: When reopened, Sonara displays a clean, non-intrusive **Reconnect Banner** at the top of the interface. Clicking "Reconnect Folders" prompts one native confirmation to re-activate playback immediately.
2. **Audio Autoplay Policy**:
   - Web browsers prevent audio playback until the user has interacted with the document at least once.
   - *Sonara Workaround*: The audio engine unlocks the `AudioContext` on the first user click anywhere in the window.
3. **Storage Persistence**:
   - Browsers may evict IndexedDB data if storage space is critical.
   - *Sonara Workaround*: Navigate to **Settings -> Library** and click **Enable Persistent Storage** to request permanent storage quota that the browser will never clear. Use the **Data & Backup** tab to export portable JSON backups at any time.

---

## Desktop Packaging (Electron)

Sonara was architected from day one to wrap into an Electron desktop application without touching any renderer UI code.

See [`ELECTRON.md`](./ELECTRON.md) for the complete, step-by-step guide to compile Sonara into a native Windows `.exe` installer (NSIS) complete with `main.ts`, `preload.ts`, custom `local-media://` protocol handler with HTTP Range requests, and global media keys.
