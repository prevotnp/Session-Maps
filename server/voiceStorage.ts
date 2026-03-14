import { objectStorageClient } from './replit_integrations/object_storage';

function getBucketId(): string {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error('DEFAULT_OBJECT_STORAGE_BUCKET_ID not configured');
  return bucketId;
}

export async function storeVoiceMessage(
  sessionId: number,
  messageId: number,
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const bucketId = getBucketId();
  const bucket = objectStorageClient.bucket(bucketId);
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const storagePath = `voice-messages/${sessionId}/${messageId}.${ext}`;

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const file = bucket.file(storagePath);
  await file.save(audioBuffer, { contentType: mimeType });

  return storagePath;
}

export async function getVoiceMessageAudio(storagePath: string): Promise<Buffer | null> {
  try {
    const bucketId = getBucketId();
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(storagePath);
    const [data] = await file.download();
    return data;
  } catch {
    return null;
  }
}

export async function deleteVoiceMessageAudio(storagePath: string): Promise<void> {
  try {
    const bucketId = getBucketId();
    const bucket = objectStorageClient.bucket(bucketId);
    await bucket.file(storagePath).delete();
  } catch {
    // Ignore deletion errors (file may already be gone)
  }
}
