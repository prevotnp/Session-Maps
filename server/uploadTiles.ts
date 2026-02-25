import fs from 'fs';
import path from 'path';
import { objectStorageClient } from './replit_integrations/object_storage';
import { storage as dbStorage } from './storage';

const imageId = parseInt(process.argv[2] || '11');
const sourceDir = process.argv[3] || `/tmp/drone-tiles-${imageId}`;

async function uploadTiles() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    console.error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
    process.exit(1);
  }

  const bucket = objectStorageClient.bucket(bucketId);
  const basePath = `public/drone-tiles/${imageId}`;

  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  const pngFiles: string[] = [];
  function findPngs(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findPngs(fullPath);
      } else if (entry.name.endsWith('.png')) {
        pngFiles.push(fullPath);
      }
    }
  }
  findPngs(sourceDir);

  console.log(`Found ${pngFiles.length} PNG tiles to upload for image ${imageId}`);

  let uploaded = 0;
  let minZoom = 99;
  let maxZoom = 0;

  const batchSize = 10;
  for (let i = 0; i < pngFiles.length; i += batchSize) {
    const batch = pngFiles.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (filePath) => {
      const relativePath = path.relative(sourceDir, filePath);
      const parts = relativePath.split(path.sep);
      if (parts.length !== 3) return;
      
      const z = parseInt(parts[0]);
      const x = parseInt(parts[1]);
      const y = parseInt(parts[2].replace('.png', ''));
      
      if (isNaN(z) || isNaN(x) || isNaN(y)) return;
      
      minZoom = Math.min(minZoom, z);
      maxZoom = Math.max(maxZoom, z);

      const tileBuffer = fs.readFileSync(filePath);
      const storagePath = `${basePath}/${z}/${x}/${y}.png`;
      const file = bucket.file(storagePath);
      
      await file.save(tileBuffer, {
        contentType: 'image/png',
        metadata: { cacheControl: 'public, max-age=31536000' }
      });
      
      uploaded++;
    }));

    if (uploaded % 50 === 0 || i + batchSize >= pngFiles.length) {
      console.log(`  Uploaded ${uploaded}/${pngFiles.length} tiles`);
    }
  }

  const image = await dbStorage.getDroneImage(imageId);
  if (!image) {
    console.error('Image not found in database');
    process.exit(1);
  }

  const bounds = {
    north: parseFloat(image.northEastLat),
    south: parseFloat(image.southWestLat),
    east: parseFloat(image.northEastLng),
    west: parseFloat(image.southWestLng)
  };

  const metaFile = bucket.file(`${basePath}/metadata.json`);
  await metaFile.save(JSON.stringify({
    imageId,
    bounds,
    minZoom,
    maxZoom,
    tileSize: 512,
    totalTiles: uploaded,
    generatedAt: new Date().toISOString()
  }), { contentType: 'application/json' });

  await dbStorage.updateDroneImage(imageId, {
    hasTiles: true,
    tileMinZoom: minZoom,
    tileMaxZoom: maxZoom,
    tileStoragePath: basePath,
    processingStatus: 'complete'
  });

  console.log(`Upload complete: ${uploaded} tiles, zoom ${minZoom}-${maxZoom}`);
  process.exit(0);
}

uploadTiles().catch(err => {
  console.error('Upload failed:', err);
  process.exit(1);
});
