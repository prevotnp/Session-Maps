# Raven Maps - Offline iOS Implementation Guide

## Overview

This document outlines the complete architecture for adding offline map support and iOS App Store distribution to Raven Maps.

## Architecture Decision Summary

### Chosen Approach
- **Web App**: Continue using Mapbox GL JS (React) with PWA enhancements
- **iOS App**: Capacitor wrapper bundling the web build
- **Offline Basemap**: MBTiles format served via local HTTP server
- **Offline GeoTIFF**: Convert to MBTiles raster tiles, serve locally
- **Push Notifications**: FCM → APNs with backend token registry

---

## Part 1: PWA Support (Web App)

### Files to Create/Modify

#### 1. `client/public/manifest.json`
```json
{
  "name": "Raven Maps",
  "short_name": "Raven",
  "description": "High-resolution drone imagery mapping with GPS tracking",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#6366f1",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

#### 2. `client/public/sw.js` (Service Worker)
```javascript
const CACHE_NAME = 'raven-maps-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  // Cache-first for static assets, network-first for API
  if (event.request.url.includes('/api/')) {
    event.respondWith(networkFirst(event.request));
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    return caches.match(request);
  }
}
```

#### 3. iOS Safe Area CSS (`client/src/index.css`)
```css
:root {
  --sat: env(safe-area-inset-top);
  --sar: env(safe-area-inset-right);
  --sab: env(safe-area-inset-bottom);
  --sal: env(safe-area-inset-left);
}

body {
  padding-top: var(--sat);
  padding-bottom: var(--sab);
  padding-left: var(--sal);
  padding-right: var(--sar);
}
```

---

## Part 2: Mobile-First Responsive UI

### Layout Strategy
- **Phone (< 768px)**: Bottom tab bar with icons (Map / Layers / Search / Saved)
- **Tablet/Desktop (≥ 768px)**: Sidebar layout with full labels

### Component Structure
```
MobileTabBar.tsx     - Bottom navigation for phones
DesktopSidebar.tsx   - Side navigation for desktop
ResponsiveLayout.tsx - Wrapper that switches based on screen size
```

---

## Part 3: Capacitor iOS Setup

### Initialize Capacitor
```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Raven Maps" com.ravenmaps.app
npx cap add ios
```

### `capacitor.config.ts`
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ravenmaps.app',
  appName: 'Raven Maps',
  webDir: 'dist',
  server: {
    // Bundle web assets (recommended for App Store)
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'automatic'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
```

### iOS Permissions (`ios/App/App/Info.plist`)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Raven Maps needs your location to show your position on the map and record GPS activities.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Raven Maps can track your location in the background for GPS activity recording.</string>
```

---

## Part 4: Offline Basemap System

### Database Schema Addition
```typescript
// shared/schema.ts
export const offlineMapPacks = pgTable('offline_map_packs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  bounds: json('bounds').notNull(), // { north, south, east, west }
  minZoom: integer('min_zoom').notNull(),
  maxZoom: integer('max_zoom').notNull(),
  tileCount: integer('tile_count'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  status: text('status').default('pending'), // pending, downloading, complete, error
  progress: real('progress').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

### Backend Endpoints
```
POST   /api/offline/basemap/estimate   - Estimate download size for region
POST   /api/offline/basemap/download   - Start download job
GET    /api/offline/basemap/progress/:id - Get download progress
GET    /api/offline/basemap/packs      - List user's offline packs
DELETE /api/offline/basemap/packs/:id  - Delete an offline pack
```

### MBTiles Generation (Server-Side)
Use `tippecanoe` or custom tile fetcher to create MBTiles:
```bash
# For raster tiles (satellite imagery)
# Fetch tiles from Mapbox and package into MBTiles
```

---

## Part 5: Offline GeoTIFF Overlays

### Conversion Pipeline
1. User uploads GeoTIFF (already implemented)
2. Backend converts to PNG tiles using `gdal2tiles` or `sharp`
3. Package tiles into MBTiles format
4. Store metadata (bounds, min/max zoom, attribution)

### Database Schema
```typescript
export const offlineOverlays = pgTable('offline_overlays', {
  id: serial('id').primaryKey(),
  droneImageId: integer('drone_image_id').references(() => droneImages.id),
  userId: integer('user_id').references(() => users.id),
  mbtilesPath: text('mbtiles_path'),
  bounds: json('bounds'),
  minZoom: integer('min_zoom'),
  maxZoom: integer('max_zoom'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow()
});
```

### Local Tile Server (iOS)
```typescript
// Capacitor plugin or embedded HTTP server
// Serves tiles at: http://127.0.0.1:8765/tiles/{overlay_id}/{z}/{x}/{y}.png
```

---

## Part 6: Push Notifications

### Backend Schema
```typescript
export const deviceTokens = pgTable('device_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  token: text('token').notNull(),
  platform: text('platform').notNull(), // 'ios', 'android', 'web'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

### Backend Endpoints
```
POST /api/push/register    - Register device token
POST /api/push/send        - Send notification (admin only)
DELETE /api/push/unregister - Remove device token
```

### Firebase Admin SDK Integration
```typescript
import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey)
});

async function sendPushNotification(token: string, title: string, body: string, data?: object) {
  await admin.messaging().send({
    token,
    notification: { title, body },
    data: data as Record<string, string>,
    apns: {
      payload: { aps: { sound: 'default' } }
    }
  });
}
```

---

## Part 7: Xcode Build & App Store Checklist

### Prerequisites
- Mac with Xcode 15+
- Apple Developer Account ($99/year)
- App Store Connect access

### Build Steps
```bash
# 1. Build web app
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open in Xcode
npx cap open ios
```

### Xcode Configuration
1. Select your Team in Signing & Capabilities
2. Add capabilities:
   - Push Notifications
   - Background Modes (Location updates, Background fetch)
3. Configure App Icons (1024x1024 required)
4. Set deployment target (iOS 14.0+)

### TestFlight Upload
1. Archive: Product → Archive
2. Distribute: Window → Organizer → Distribute App
3. Select "App Store Connect" → Upload

### App Store Review Checklist
- [ ] Privacy Policy URL
- [ ] App Store screenshots (6.7" and 5.5" sizes)
- [ ] App description and keywords
- [ ] Location usage justification
- [ ] Push notification usage justification
- [ ] Export compliance (encryption)

---

## Implementation Order

1. **Phase 1**: PWA support + iOS safe-area CSS
2. **Phase 2**: Mobile-responsive UI (bottom tabs)
3. **Phase 3**: Capacitor iOS project setup
4. **Phase 4**: Offline database schema + basic management UI
5. **Phase 5**: GeoTIFF → MBTiles conversion pipeline
6. **Phase 6**: Local tile server for iOS
7. **Phase 7**: Push notification backend + iOS integration
8. **Phase 8**: Xcode build + TestFlight

---

## Notes

### Mapbox Licensing
- Offline tile caching may require Mapbox Enterprise depending on scale
- Check your Mapbox plan: https://www.mapbox.com/pricing
- Alternative: Use OpenMapTiles for self-hosted basemaps

### Development Requirements
- Building iOS app requires Mac with Xcode
- The Replit environment can prepare all code, but final iOS build must be done locally
