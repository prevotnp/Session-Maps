import fs from 'fs';
import path from 'path';
import { objectStorageClient } from './replit_integrations/object_storage';
import { db } from './db';
import { droneImages } from '@shared/schema';

async function migrateOriginals() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    console.error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not set');
    process.exit(1);
  }

  const bucket = objectStorageClient.bucket(bucketId);
  const images = await db.select().from(droneImages);
  
  for (const image of images) {
    const filePath = image.filePath;
    if (!fs.existsSync(filePath)) {
      console.log(`Image ${image.id} (${image.name}): file not found at ${filePath}, skipping`);
      continue;
    }

    const filename = path.basename(filePath);
    const storagePath = `.private/drone-originals/${image.id}/${filename}`;
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();
    if (exists) {
      console.log(`Image ${image.id} (${image.name}): already in Object Storage, skipping upload`);
      continue;
    }

    const stat = fs.statSync(filePath);
    console.log(`Image ${image.id} (${image.name}): uploading ${(stat.size / 1024 / 1024).toFixed(0)}MB...`);

    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(filePath);
      const writeStream = file.createWriteStream({
        contentType: 'image/tiff',
        metadata: { cacheControl: 'private' }
      });
      
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => resolve());
      readStream.pipe(writeStream);
    });

    console.log(`  Uploaded to ${storagePath}`);
  }

  console.log('All originals migrated to Object Storage');
  process.exit(0);
}

migrateOriginals().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
