import { syncTilesetToObjectStorage } from '../server/cesiumStorageSync';

const tilesetId = parseInt(process.argv[2] || '0');
const localDir = process.argv[3] || '';

if (!tilesetId || !localDir) {
  console.error('Usage: tsx scripts/sync-tileset-to-storage.ts <tilesetId> <localDir>');
  process.exit(1);
}

console.log(`Starting sync for tileset ${tilesetId} from ${localDir}`);
syncTilesetToObjectStorage(tilesetId, localDir)
  .then(() => {
    console.log('Sync complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
