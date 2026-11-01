import { contextBridge, ipcRenderer } from 'electron';

export interface ScannedFileItem {
  name: string;
  relPath: string;
  fullPath: string;
  size: number;
  lastModified: number;
}

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
  fs: {
    scanDirectory: (dirPath: string) => Promise<ScannedFileItem[]>;
    dirExists: (dirPath: string) => Promise<boolean>;
    readFile: (filePath: string) => Promise<Uint8Array>;
    readText: (filePath: string) => Promise<string | null>;
    showInFolder: (filePath: string) => Promise<void>;
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
  fs: {
    scanDirectory: (dirPath: string) => ipcRenderer.invoke('fs-scan-directory', dirPath),
    dirExists: (dirPath: string) => ipcRenderer.invoke('fs-dir-exists', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs-read-file', filePath),
    readText: (filePath: string) => ipcRenderer.invoke('fs-read-text', filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke('fs-show-in-folder', filePath),
  },
  media: {
    onCommand: (callback) => {
      const listener = (_: unknown, cmd: 'toggle-play' | 'next' | 'previous') => callback(cmd);
      ipcRenderer.on('media-command', listener);
      return () => ipcRenderer.removeListener('media-command', listener);
    },
    toMediaUrl: (absolutePath: string) => {
      let normalized = absolutePath.replace(/\\/g, '/');
      let drivePrefix = '';
      if (/^[a-zA-Z]:/.test(normalized)) {
        drivePrefix = normalized.substring(0, 2);
        normalized = normalized.substring(2);
      }
      const parts = normalized.split('/').map((seg) => encodeURIComponent(seg));
      const encoded = parts.join('/');
      const full = drivePrefix ? `${drivePrefix}${encoded}` : encoded;
      return `local-media://${full.startsWith('/') ? full : `/${full}`}`;
    },
  },
};

// Expose under both names for complete compatibility
contextBridge.exposeInMainWorld('sonara', bridge);
contextBridge.exposeInMainWorld('electronAPI', bridge);
