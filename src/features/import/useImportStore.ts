import { create } from 'zustand';

export interface ImportProgress {
  active: boolean;
  currentFilename: string;
  processedCount: number;
  totalEstimated: number;
  cancelRequested: boolean;
}

interface ImportStoreState extends ImportProgress {
  startImport: () => void;
  updateProgress: (filename: string, processed: number, total: number) => void;
  finishImport: () => void;
  requestCancel: () => void;
}

export const useImportStore = create<ImportStoreState>((set) => ({
  active: false,
  currentFilename: '',
  processedCount: 0,
  totalEstimated: 0,
  cancelRequested: false,

  startImport: () =>
    set({
      active: true,
      currentFilename: 'Starting scan...',
      processedCount: 0,
      totalEstimated: 0,
      cancelRequested: false,
    }),

  updateProgress: (filename, processed, total) =>
    set({
      currentFilename: filename,
      processedCount: processed,
      totalEstimated: total,
    }),

  finishImport: () =>
    set({
      active: false,
      currentFilename: '',
      processedCount: 0,
      totalEstimated: 0,
      cancelRequested: false,
    }),

  requestCancel: () => set({ cancelRequested: true }),
}));
