export { type PlatformAdapter, type PermissionState } from './adapter';
export { BrowserAdapter } from './browserAdapter';
export { ElectronAdapter } from './electronAdapter';
export { isElectron } from './detect';

import type { PlatformAdapter } from './adapter';
import { BrowserAdapter } from './browserAdapter';
import { ElectronAdapter } from './electronAdapter';
import { isElectron } from './detect';

let _adapter: PlatformAdapter | null = null;

/** Get the singleton PlatformAdapter instance */
export function getPlatform(): PlatformAdapter {
  if (!_adapter) {
    _adapter = isElectron() ? new ElectronAdapter() : new BrowserAdapter();
  }
  return _adapter;
}
