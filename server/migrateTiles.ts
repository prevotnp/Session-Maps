import fs from 'fs';
import { generateTilesFromImage, type ImageBounds } from './tileGenerator';
import { storage as dbStorage } from './storage';

async function migrateDroneImagesToTiles() {
  console.log('Starting drone imagery tile migration...');
  
  const allImages = await dbStorage.getPublicDroneImages();
  
  for (const image of allImages) {
    if (image.hasTiles) {
      console.log(`Image ${image.id} (${image.name}) already has tiles, skipping`);
      continue;
    }

    if (!fs.existsSync(image.filePath)) {
      console.log(`Image ${image.id} (${image.name}) file not found: ${image.filePath}, skipping`);
      continue;
    }

    console.log(`\nProcessing image ${image.id}: ${image.name}`);
    console.log(`  File: ${image.filePath}`);
    
    const bounds: ImageBounds = {
      north: parseFloat(image.northEastLat),
      south: parseFloat(image.southWestLat),
      east: parseFloat(image.northEastLng),
      west: parseFloat(image.southWestLng)
    };

    try {
      await dbStorage.updateDroneImage(image.id, { processingStatus: 'generating_tiles' });
      
      const tileResult = await generateTilesFromImage(
        image.filePath,
        bounds,
        image.id,
        (percent, message) => console.log(`  [${image.id}] ${percent}% - ${message}`)
      );

      await dbStorage.updateDroneImage(image.id, {
        hasTiles: true,
        tileMinZoom: tileResult.minZoom,
        tileMaxZoom: tileResult.maxZoom,
        tileStoragePath: tileResult.storagePath,
        processingStatus: 'complete'
      });

      console.log(`  Complete: ${tileResult.totalTiles} tiles (zoom ${tileResult.minZoom}-${tileResult.maxZoom})`);
    } catch (err) {
      console.error(`  Failed for image ${image.id}:`, err);
      await dbStorage.updateDroneImage(image.id, { processingStatus: 'failed' });
    }
  }

  console.log('\nMigration complete!');
}

migrateDroneImagesToTiles().catch(console.error);
