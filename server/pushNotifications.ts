import webPush from 'web-push';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@sessionmaps.com';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export async function sendPushNotification(
  subscriptionToken: string,
  payload: { title: string; body: string; data?: any }
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) return false;

  try {
    // The token stored in device_tokens for 'web' platform is a JSON-stringified
    // PushSubscription object containing endpoint, keys.p256dh, keys.auth
    const subscription = JSON.parse(subscriptionToken);
    await webPush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (error: any) {
    // If subscription is expired/invalid, return false so caller can clean up
    if (error.statusCode === 410 || error.statusCode === 404) {
      return false;
    }
    console.error('Push notification error:', error);
    return false;
  }
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey || null;
}
