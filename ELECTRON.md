# Sonara — Electron Desktop Packaging Guide

This guide details how to package **Sonara** into a standalone, production-ready Windows desktop application (`Sonara-Setup.exe`) using **Electron** and **electron-builder**.

---

## 1. Architectural Philosophy

Sonara was designed with clean decoupling between the renderer UI and the host environment:
1. **Zero Node Imports in Renderer**: The UI contains no `require('fs')`, `require('path')`, or Node.js native dependencies.
2. **PlatformAdapter Interface**: All system-level capabilities (file system access, native dialogs, window controls) are mediated by `src/lib/platform.ts`. In the browser, it uses the W3C File System Access API; in Electron, it utilizes `window.sonara` exposed via a secure `contextBridge` preload script.
3. **High-Performance Audio Streaming**: To avoid reading 50MB FLAC files into memory or dealing with blob URLs, Electron registers a custom protocol scheme `local-media://` that streams audio files directly from disk with full HTTP Range request support (`206 Partial Content`). This allows instant, jitter-free seeking across files of any size.

---

## 2. File Structure for Electron

Add the following directory layout at the root of the project:

```
Zachy/
├── electron/
│   ├── main.ts             # Electron main process (window, tray, protocols, CSP)
│   ├── preload.ts          # Secure contextBridge exposing PlatformAdapter
│   └── tsconfig.json       # TypeScript config for Electron main & preload
├── electron-builder.json5  # Packaging configuration (NSIS, file associations)
```

---

## 3. Main Process (`electron/main.ts`)

Create `electron/main.ts` with the following complete code:

```typescript
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  net,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// 1. Register privileged schemes before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: 'local-media',
    privileges: {
      standard: false,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// 2. Enforce Single-Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    frame: false, // Spotify-style frameless custom window controls
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Strict Content Security Policy (100% offline, zero external leaks)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' app:; " +
            "script-src 'self' 'unsafe-inline' app:; " +
            "style-src 'self' 'unsafe-inline' app:; " +
            "img-src 'self' data: blob: app: local-media:; " +
            "media-src 'self' blob: app: local-media:; " +
            "connect-src 'self' app: local-media:; " +
            "font-src 'self' data: app:;",
        ],
      },
    });
  });

  // Graceful show on ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('app://./index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Window state IPC handlers
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window-state-change', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-state-change', false));
}

// 3. Register Custom Protocols
function setupProtocols() {
  // Protocol: app:// (serves built static files in production)
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let filePath = path.join(__dirname, '../dist', decodeURIComponent(url.pathname));
    if (filePath.endsWith(path.sep) || !path.extname(filePath)) {
      filePath = path.join(__dirname, '../dist', 'index.html');
    }
    return net.fetch(`file://${filePath}`);
  });

  // Protocol: local-media:// (streams user audio files with HTTP Range 206 support)
  protocol.handle('local-media', (request) => {
    const url = new URL(request.url);
    // Strip leading slash on Windows drive paths (e.g., /C:/Music -> C:/Music)
    let filePath = decodeURIComponent(url.pathname);
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }

    if (!fs.existsSync(filePath)) {
      return new Response('File Not Found', { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHeader = request.headers.get('range');

    // MIME type lookup
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.opus': 'audio/opus',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Handle HTTP Range header for seeking
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new Response(stream, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Full file stream
    const fileStream = fs.createReadStream(filePath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(fileSize),
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  });
}

// 4. System Tray and Global Media Keys
function setupTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../public/icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Sonara Local Player',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Play / Pause',
      click: () => mainWindow?.webContents.send('media-command', 'toggle-play'),
    },
    {
      label: 'Next Track',
      click: () => mainWindow?.webContents.send('media-command', 'next'),
    },
    {
      label: 'Previous Track',
      click: () => mainWindow?.webContents.send('media-command', 'previous'),
    },
    { type: 'separator' },
    {
      label: 'Open Sonara',
      click: () => mainWindow?.show(),
    },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('Sonara Music Player');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

function registerMediaKeys() {
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow?.webContents.send('media-command', 'toggle-play');
  });
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow?.webContents.send('media-command', 'next');
  });
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow?.webContents.send('media-command', 'previous');
  });
}

// 5. IPC Handlers
function setupIpc() {
  ipcMain.handle('window-minimize', () => mainWindow?.minimize());
  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window-close', () => mainWindow?.close());
  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle('dialog-open-directories', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'multiSelections'],
    });
    return res.canceled ? null : res.filePaths;
  });

  ipcMain.handle('dialog-open-files', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'aac'] },
        { name: 'Playlists', extensions: ['m3u', 'm3u8', 'pls'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return res.canceled ? null : res.filePaths;
  });
}

// 6. Application Lifecycle
app.whenReady().then(() => {
  setupProtocols();
  setupIpc();
  createWindow();
  setupTray();
  registerMediaKeys();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

---

## 4. Preload Script (`electron/preload.ts`)

Create `electron/preload.ts` to bridge Electron APIs safely to `window.sonara`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronSonaraBridge {
  isElectron: boolean;
  platform: string;
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onStateChange: (callback: (isMaximized: boolean) => void) => () => void;
  };
  dialog: {
    selectFolders: () => Promise<string[] | null>;
    selectFiles: () => Promise<string[] | null>;
  };
  media: {
    onCommand: (callback: (command: 'toggle-play' | 'next' | 'previous') => void) => () => void;
    toMediaUrl: (absolutePath: string) => string;
  };
}

const bridge: ElectronSonaraBridge = {
  isElectron: true,
  platform: process.platform,
  window: {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    onStateChange: (callback) => {
      const listener = (_: unknown, isMax: boolean) => callback(isMax);
      ipcRenderer.on('window-state-change', listener);
      return () => ipcRenderer.removeListener('window-state-change', listener);
    },
  },
  dialog: {
    selectFolders: () => ipcRenderer.invoke('dialog-open-directories'),
    selectFiles: () => ipcRenderer.invoke('dialog-open-files'),
  },
  media: {
    onCommand: (callback) => {
      const listener = (_: unknown, cmd: 'toggle-play' | 'next' | 'previous') => callback(cmd);
      ipcRenderer.on('media-command', listener);
      return () => ipcRenderer.removeListener('media-command', listener);
    },
    toMediaUrl: (absolutePath: string) => {
      // Normalize slashes for Windows
      const normalized = absolutePath.replace(/\\/g, '/');
      return `local-media://${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
    },
  },
};

contextBridge.exposeInMainWorld('sonara', bridge);
```

---

## 5. TypeScript Config for Electron (`electron/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ESNext", "DOM"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "../dist-electron"
  },
  "include": ["./**/*"]
}
```

---

## 6. Packaging Configuration (`electron-builder.json5`)

Create `electron-builder.json5` at the project root:

```json5
{
  "$schema": "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json",
  "appId": "com.sonara.player",
  "productName": "Sonara",
  "copyright": "Copyright © 2026 Sonara Contributors",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "dist-electron/**/*"
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      }
    ],
    "icon": "public/icon.png",
    "fileAssociations": [
      {
        "ext": "mp3",
        "name": "MP3 Audio File",
        "role": "Viewer"
      },
      {
        "ext": "flac",
        "name": "FLAC Free Lossless Audio",
        "role": "Viewer"
      },
      {
        "ext": "wav",
        "name": "Waveform Audio File",
        "role": "Viewer"
      },
      {
        "ext": "m4a",
        "name": "MPEG-4 Audio",
        "role": "Viewer"
      },
      {
        "ext": "ogg",
        "name": "Ogg Vorbis Audio",
        "role": "Viewer"
      },
      {
        "ext": "m3u",
        "name": "M3U Playlist File",
        "role": "Viewer"
      },
      {
        "ext": "m3u8",
        "name": "M3U8 Playlist File",
        "role": "Viewer"
      }
    ]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Sonara",
    "uninstallDisplayName": "Sonara Local Music Player"
  }
}
```

---

## 7. Build Scripts (`package.json`)

Add the following scripts to your `package.json`:

```json
"scripts": {
  "build": "vite build",
  "build:electron": "tsc -p electron/tsconfig.json",
  "pack": "npm run build && npm run build:electron && electron-builder --dir",
  "dist": "npm run build && npm run build:electron && electron-builder --win nsis"
}
```

Install Electron development dependencies:
```bash
npm install -D electron electron-builder
```

To produce the final Windows installer:
```bash
npm run dist
```
The resulting installer will be located at `release/Sonara-Setup-0.0.0.exe`.

---

## 8. Origin-Scoped IndexedDB Migration Guide

### The Partitioning Challenge
Web browsers partition IndexedDB storage strictly by origin:
- Web Development: `http://localhost:5173`
- Web Production: `https://your-domain.com`
- Packaged Electron: `app://.`

Because IndexedDB is sandboxed by origin, when a user switches from running Sonara in their web browser to the native Electron executable, the Electron window will start with a fresh IndexedDB database.

### Seamless Migration with Sonara's Backup Engine
Sonara includes a built-in cryptographic backup and fingerprint restoration engine (`src/lib/backup.ts`) specifically engineered to solve this:

1. **In the Web Browser**:
   - Open Sonara in Chrome or Edge (`http://localhost:5173`).
   - Navigate to **Settings** (`Ctrl+,`) -> **Data & Backup**.
   - Click **Export JSON Backup**.
   - A portable snapshot (`sonara-backup-YYYY-MM-DD.json`) is downloaded containing all playlists, likes, play history, track stats, custom lyrics, and cryptographic fingerprints for every song.
2. **In the Packaged Electron App**:
   - Launch the newly installed `Sonara.exe`.
   - Add your music directory in the sidebar. Sonara scans and indexes your files.
   - Navigate to **Settings** -> **Data & Backup**.
   - Click **Import JSON Backup** and select your exported `.json` file.
3. **Automatic Fingerprint Remapping**:
   - Sonara matches each track by its file fingerprint (`size:duration:title:artist`) rather than brittle local IDs.
   - All likes, play counts, skips, completion stats, smart rules, and playlist track orders are automatically remapped to the new local database instances.
   - Zero data loss, zero manual playlist recreation.
