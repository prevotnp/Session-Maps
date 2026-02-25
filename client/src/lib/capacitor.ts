import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNative = Capacitor.isNativePlatform();
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';

export async function initializeCapacitor() {
  if (!isNative) return;
  
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (isIOS) {
      await StatusBar.setBackgroundColor({ color: '#0a0a0f' });
    }
  } catch (e) {
    // StatusBar not available on this platform
  }
  
  App.addListener('appUrlOpen', (data) => {
    handleDeepLink(data.url);
  });
  
  App.addListener('backButton', () => {
    if (window.history.length > 1) {
      window.history.back();
    }
  });
}

function handleDeepLink(url: string) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    if (path.startsWith('/live-map/')) {
      window.location.href = path;
    } else if (path.startsWith('/route/')) {
      window.location.href = path;
    }
  } catch (e) {
    console.error('Failed to handle deep link:', e);
  }
}

export async function requestPushPermission(): Promise<string | null> {
  if (!isNative) {
    return null;
  }
  
  try {
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    
    if (permStatus.receive !== 'granted') {
      return null;
    }
    
    await PushNotifications.register();
    
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value);
      });
      
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
        resolve(null);
      });
    });
  } catch (e) {
    console.error('Failed to request push permission:', e);
    return null;
  }
}

export function setupPushListeners(onNotification: (data: any) => void) {
  if (!isNative) return;
  
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    onNotification({
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });
  });
  
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data;
    if (data?.url) {
      window.location.href = data.url;
    }
  });
}

export async function getCurrentPosition() {
  try {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      heading: position.coords.heading,
      speed: position.coords.speed,
    };
  } catch (e) {
    console.error('Failed to get current position:', e);
    throw e;
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const status = await Geolocation.requestPermissions();
    return status.location === 'granted' || status.coarseLocation === 'granted';
  } catch (e) {
    console.error('Failed to request location permission:', e);
    return false;
  }
}
