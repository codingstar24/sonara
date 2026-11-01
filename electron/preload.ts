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
      const normalized = absolutePath.replace(/\\/g, '/');
      return `local-media://${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
    },
  },
};

contextBridge.exposeInMainWorld('sonara', bridge);
