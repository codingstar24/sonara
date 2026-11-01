/** Detect whether we're running inside Electron */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && 'electronAPI' in window;
}
