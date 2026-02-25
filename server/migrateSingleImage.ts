import fs from 'fs';
import { generateTilesFromImage, type ImageBounds } from './tileGenerator';
import { storage as dbStorage } from './storage';

const imageId = parseInt(process.argv[2] || '11');

async function migrateImage() {
  console.log(`Processing image ${imageId}...`);
  
  const image = await dbStorage.getDroneImage(imageId);
  if (!image) {
    console.log('Image not found');
    process.exit(1);
  }

  if (!fs.existsSync(image.filePath)) {
    console.log(`File not found: ${image.filePath}`);
    process.exit(1);
  }

  console.log(`  Name: ${image.name}`);
  console.log(`  File: ${image.filePath}`);
  
  const bounds: ImageBounds = {
    north: parseFloat(image.northEastLat),
    south: parseFloat(image.southWestLat),
    east: parseFloat(image.northEastLng),
    west: parseFloat(image.southWestLng)
  };

  await dbStorage.updateDroneImage(image.id, { processingStatus: 'generating_tiles' });
  
  const startTime = Date.now();
  const tileResult = await generateTilesFromImage(
    image.filePath,
    bounds,
    image.id,
    (percent, message) => console.log(`  ${percent}% - ${message}`)
  );

  await dbStorage.updateDroneImage(image.id, {
    hasTiles: true,
    tileMinZoom: tileResult.minZoom,
    tileMaxZoom: tileResult.maxZoom,
    tileStoragePath: tileResult.storagePath,
    processingStatus: 'complete'
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`  Complete: ${tileResult.totalTiles} tiles in ${elapsed}s`);
  process.exit(0);
}

migrateImage().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
