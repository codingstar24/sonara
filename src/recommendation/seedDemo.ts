import { purgeAllDemoData } from './purgeDemo';

export { purgeAllDemoData };

/**
 * seedDemoData has been deprecated and disabled.
 * Sonara now operates exclusively with real user audio files and directories.
 */
export async function seedDemoData(): Promise<void> {
  console.info('seedDemoData: Demo and mock data generation has been removed.');
  await purgeAllDemoData();
}
