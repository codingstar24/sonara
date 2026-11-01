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
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Set App User Model ID for Windows Taskbar
if (process.platform === 'win32') {
  app.setAppUserModelId('com.zohair.sonara');
}

// 1. Register privileged schemes before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
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
    title: 'Sonara',
    icon: path.join(__dirname, '../build/icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#121212',
      symbolColor: '#A7A7A7',
      height: 40,
    },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Strict Content Security Policy (100% offline, zero external leaks)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data: blob: local-media:; " +
            "script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob: local-media:; " +
            "media-src 'self' blob: local-media:; " +
            "connect-src 'self' data: blob: local-media:; " +
            "font-src 'self' data:;",
        ],
      },
    });
  });

  // Gracefully show window once renderer is prepared
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window-state-change', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-state-change', false));
}

// 3. Register Custom Protocols
function setupProtocols() {
  // Protocol: local-media:// (streams user audio files with HTTP Range 206 support)
  protocol.handle('local-media', (request) => {
    // 1. Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 2. Decode file path cleanly
    let raw = request.url.replace(/^local-media:\/\//i, '');
    raw = raw.split('?')[0]!.split('#')[0]!;
    let filePath = decodeURIComponent(raw);
    if (process.platform === 'win32') {
      // Remove any leading slashes before drive letter e.g. /d:/ -> d:/
      filePath = filePath.replace(/^\/+([a-zA-Z]:)/, '$1');
    }
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      console.warn('local-media: File not found:', resolvedPath, 'from request:', request.url);
      return new Response('File Not Found', { status: 404 });
    }

    const stat = fs.statSync(resolvedPath);
    const fileSize = stat.size;
    const rangeHeader = request.headers.get('range') || request.headers.get('Range');

    const ext = path.extname(resolvedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.opus': 'audio/opus',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.webm': 'audio/webm',
      '.wma': 'audio/x-ms-wma',
      '.aiff': 'audio/aiff',
      '.ape': 'audio/ape',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    };

    // 3. Handle HTTP Range header for instant seeking
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        return new Response(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
            ...corsHeaders,
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(resolvedPath, { start, end });

      return new Response(fileStream as any, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': contentType,
          ...corsHeaders,
        },
      });
    }

    // 4. Full file stream
    const fileStream = fs.createReadStream(resolvedPath);
    return new Response(fileStream as any, {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(fileSize),
        'Content-Type': contentType,
        ...corsHeaders,
      },
    });
  });
}

// 4. System Tray and Global Media Keys
function setupTray() {
  const iconPath = path.join(__dirname, '../build/icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

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

  // Recursive directory scanner for audio files
  ipcMain.handle('fs-scan-directory', async (_, rootPath: string) => {
    const results: Array<{
      name: string;
      relPath: string;
      fullPath: string;
      size: number;
      lastModified: number;
    }> = [];

    const audioExts = new Set([
      '.mp3', '.flac', '.wav', '.ogg', '.opus', '.m4a', '.aac', '.webm', '.wma', '.aiff', '.ape',
    ]);

    async function scanDir(currentDir: string, relPrefix = '') {
      try {
        const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const entryPath = path.join(currentDir, entry.name);
          const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await scanDir(entryPath, relPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (audioExts.has(ext)) {
              try {
                const stat = await fs.promises.stat(entryPath);
                results.push({
                  name: entry.name,
                  relPath: relPath.replace(/\\/g, '/'),
                  fullPath: entryPath.replace(/\\/g, '/'),
                  size: stat.size,
                  lastModified: stat.mtimeMs,
                });
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn('Failed to scan directory:', currentDir, err);
      }
    }

    await scanDir(path.resolve(rootPath));
    return results;
  });

  ipcMain.handle('fs-read-file', async (_, filePath: string) => {
    return fs.promises.readFile(path.resolve(filePath));
  });

  ipcMain.handle('fs-read-text', async (_, filePath: string) => {
    try {
      return await fs.promises.readFile(path.resolve(filePath), 'utf-8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('fs-show-in-folder', async (_, filePath: string) => {
    const { shell } = await import('electron');
    shell.showItemInFolder(path.resolve(filePath));
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
