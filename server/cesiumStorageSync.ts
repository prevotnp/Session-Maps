import fs from 'fs';
import path from 'path';

const CONCURRENCY = 20;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const activeSyncs = new Set<number>();

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch (err: any) {
    console.error(`[CesiumSync] Error reading directory ${dir}: ${err?.message}`);
  }
  return results;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function syncTilesetToObjectStorage(
  tilesetId: number,
  localDir: string
): Promise<void> {
  if (activeSyncs.has(tilesetId)) {
    console.log(`[CesiumSync] Sync already running for tileset ${tilesetId}, skipping`);
    return;
  }
  activeSyncs.add(tilesetId);

  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      console.error(`[CesiumSync] No bucket ID configured, skipping sync for tileset ${tilesetId}`);
      return;
    }

    const { objectStorageClient } = await import('./replit_integrations/object_storage');
    const bucket = objectStorageClient.bucket(bucketId);
    const storagePath = `public/cesium-tilesets/${tilesetId}`;

    const allFiles = getAllFiles(localDir);
    if (allFiles.length === 0) {
      console.error(`[CesiumSync] No files found in ${localDir} for tileset ${tilesetId}`);
      return;
    }
    console.log(`[CesiumSync] Starting upload of ${allFiles.length} files for tileset ${tilesetId}`);

    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
      const batch = allFiles.slice(i, i + CONCURRENCY);
      const promises = batch.map(async (filePath) => {
        const relativePath = path.relative(localDir, filePath);
        const objectPath = `${storagePath}/${relativePath}`;

        try {
          const [exists] = await bucket.file(objectPath).exists();
          if (exists) {
            skipped++;
            return;
          }
        } catch {}

        let fileBuffer: Buffer;
        try {
          fileBuffer = fs.readFileSync(filePath);
        } catch (err: any) {
          failed++;
          if (failed <= 5) {
            console.error(`[CesiumSync] Failed to read ${relativePath}: ${err?.message}`);
          }
          return;
        }

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            await bucket.file(objectPath).save(fileBuffer);
            uploaded++;
            return;
          } catch (err: any) {
            if (attempt < MAX_RETRIES) {
              await delay(RETRY_DELAY_MS * attempt);
            } else {
              failed++;
              if (failed <= 5) {
                console.error(`[CesiumSync] Failed: ${relativePath} - ${err?.message || err}`);
              }
            }
          }
        }
      });
      await Promise.all(promises);
      const total = uploaded + skipped + failed;
      if (total % 100 < CONCURRENCY || total >= allFiles.length) {
        console.log(`[CesiumSync] Tileset ${tilesetId}: ${uploaded} new, ${skipped} existing, ${failed} failed, ${allFiles.length - total} remaining`);
      }
    }

    console.log(`[CesiumSync] Tileset ${tilesetId} done: ${uploaded} new, ${skipped} existing, ${failed} failed`);

    if (failed === 0) {
      const { db } = await import('./db');
      const { cesium3dTilesets } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      await db.update(cesium3dTilesets)
        .set({ storagePath })
        .where(eq(cesium3dTilesets.id, tilesetId));
      console.log(`[CesiumSync] Tileset ${tilesetId} DB updated: storagePath=${storagePath}`);
    } else {
      console.error(`[CesiumSync] Tileset ${tilesetId}: ${failed} files failed. Keeping local: path.`);
    }
  } finally {
    activeSyncs.delete(tilesetId);
  }
}
