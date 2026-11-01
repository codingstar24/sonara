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
  app.setAppUserModelId('com.sonara.player');
}

// 1. Register privileged schemes before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: false,
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
    const url = new URL(request.url);
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

    // Handle HTTP Range header for instant seeking
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
        cancel() {
          fileStream.destroy();
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
      cancel() {
        fileStream.destroy();
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
