import { isNative } from '@/lib/capacitor';

let isTracking = false;

interface BackgroundLocationConfig {
  sessionId: number;
  serverUrl: string;
  authToken: string;
}

async function loadPlugin() {
  const pkg = '@transistorsoft/capacitor-background-geolocation';
  const mod = await import(/* @vite-ignore */ pkg);
  return mod.default;
}

export async function startBackgroundTracking(config: BackgroundLocationConfig): Promise<void> {
  if (!isNative || isTracking) return;
  try {
    const BackgroundGeolocation = await loadPlugin();
    await BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 5,
      stopOnTerminate: false,
      startOnBoot: false,
      locationUpdateInterval: 5000,
      fastestLocationUpdateInterval: 3000,
      url: `${config.serverUrl}/api/live-maps/${config.sessionId}/background-location`,
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
      },
      autoSync: true,
      batchSync: false,
      locationTemplate: '{"latitude":<%= latitude %>,"longitude":<%= longitude %>,"accuracy":<%= accuracy %>,"heading":<%= heading %>,"speed":<%= speed %>}',
      notification: {
        title: 'Session Maps',
        text: 'Sharing location with your team',
        priority: BackgroundGeolocation.NOTIFICATION_PRIORITY_MIN,
        sticky: false,
      },
      activityType: BackgroundGeolocation.ACTIVITY_TYPE_OTHER,
      pausesLocationUpdatesAutomatically: false,
    });
    await BackgroundGeolocation.start();
    isTracking = true;
    console.log('[BackgroundLocation] Started background tracking');
  } catch (error) {
    console.error('[BackgroundLocation] Failed to start:', error);
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (!isNative || !isTracking) return;
  try {
    const BackgroundGeolocation = await loadPlugin();
    await BackgroundGeolocation.stop();
    await BackgroundGeolocation.removeListeners();
    isTracking = false;
    console.log('[BackgroundLocation] Stopped background tracking');
  } catch (error) {
    console.error('[BackgroundLocation] Failed to stop:', error);
  }
}

export function isBackgroundTrackingActive(): boolean {
  return isTracking;
}
