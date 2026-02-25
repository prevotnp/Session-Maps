# Raven Maps - iOS App Build Guide

This guide explains how to build and submit the Raven Maps iOS app to the App Store.

## Prerequisites

1. **Mac computer** with macOS 13 (Ventura) or later
2. **Xcode 15+** installed from the App Store
3. **Apple Developer Account** ($99/year) - [developer.apple.com](https://developer.apple.com)
4. **Node.js 18+** installed

## Step 1: Clone and Build the Web App

```bash
# Clone the repository (or download from Replit)
git clone <your-repo-url>
cd raven-maps

# Install dependencies
npm install

# Build the web app for production
npm run build
```

## Step 2: Initialize Capacitor iOS

```bash
# Initialize iOS platform (if not already done)
npx cap add ios

# Sync web build with iOS
npx cap sync ios
```

## Step 3: Open in Xcode

```bash
npx cap open ios
```

This opens the iOS project in Xcode.

## Step 4: Configure Signing & Capabilities

1. Select the **App** target in the project navigator
2. Go to **Signing & Capabilities** tab
3. Select your **Team** (Apple Developer account)
4. Xcode will create a provisioning profile automatically

### Add Required Capabilities:

Click **+ Capability** and add:
- **Push Notifications** - For sending notifications
- **Background Modes** - Check "Location updates" for GPS tracking

## Step 5: Configure Info.plist

The following keys are already configured, but verify they exist:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Raven Maps needs your location to show your position on the map and record GPS activities.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Raven Maps can track your location in the background for GPS activity recording.</string>
```

## Step 6: Configure App Icons

1. Navigate to **Assets.xcassets** > **AppIcon**
2. Add icons for all required sizes:
   - 20pt, 29pt, 40pt, 60pt, 76pt, 83.5pt (at 1x, 2x, 3x scales)
   - 1024pt for App Store

You can use the SVG at `client/public/icons/icon.svg` as a source.

## Step 7: Configure Launch Screen

1. Open **LaunchScreen.storyboard**
2. Set background color to match app (dark theme: #0a0a0f)
3. Add your app logo if desired

## Step 8: Build and Test

1. Select a simulator or connected device
2. Press **Cmd+R** to build and run
3. Test all features:
   - Map loading
   - GPS location
   - User login
   - Route creation
   - Push notifications (requires physical device)

## Step 9: Archive for Distribution

1. Select **Product** > **Archive**
2. Wait for the archive to complete
3. Xcode Organizer will open automatically

## Step 10: Upload to App Store Connect

1. In Organizer, select your archive
2. Click **Distribute App**
3. Select **App Store Connect**
4. Follow the prompts to upload

## Step 11: App Store Connect Configuration

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Create a new app or select existing
3. Fill in required information:
   - App name: Raven Maps
   - Bundle ID: com.ravenmaps.app
   - Primary language: English
   - Category: Navigation

### Required Assets:
- **Screenshots**: 6.7" and 5.5" iPhone sizes (at minimum)
- **App Icon**: 1024x1024 PNG
- **Description**: App description for the store listing
- **Keywords**: drone, maps, GPS, navigation, hiking, etc.
- **Privacy Policy URL**: Required for apps with location/data collection
- **Support URL**: Your support website

## Step 12: Submit for Review

1. Select your build in App Store Connect
2. Answer export compliance questions
3. Submit for review

Review typically takes 24-48 hours.

---

## Push Notifications Setup (Optional)

To enable push notifications:

### 1. Create APNs Key

1. Go to [developer.apple.com/account/resources/authkeys](https://developer.apple.com/account/resources/authkeys)
2. Click **+** to create a new key
3. Enable **Apple Push Notifications service (APNs)**
4. Download the .p8 file and note the Key ID

### 2. Configure Firebase (Recommended)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add an iOS app with your bundle ID
3. Go to Project Settings > Cloud Messaging
4. Upload your APNs key (.p8 file)
5. Download `GoogleService-Info.plist` and add to iOS project

### 3. Add Firebase SDK (in Xcode)

Add via Swift Package Manager:
- `https://github.com/firebase/firebase-ios-sdk`
- Select `FirebaseMessaging`

---

## Troubleshooting

### Build Errors

**"No signing certificate"**
- Ensure you're signed into Xcode with your Apple ID
- Check your Apple Developer membership is active

**"Code signing required"**
- Select your team in Signing & Capabilities
- Let Xcode manage signing automatically

### Runtime Issues

**Map not loading**
- Verify VITE_MAPBOX_ACCESS_TOKEN is set
- Check Mapbox token has correct permissions

**GPS not working**
- Ensure location permissions are granted
- Test on physical device (simulator GPS is limited)

---

## App Store Review Checklist

Before submitting:

- [ ] App works without crashing
- [ ] All features function as described
- [ ] Privacy Policy URL is valid and accessible
- [ ] Location permission strings are descriptive
- [ ] Push notification permission is requested appropriately
- [ ] App icon is correct at all sizes
- [ ] Screenshots accurately represent the app
- [ ] App description is accurate and complete
- [ ] Export compliance questions answered correctly

---

## Version Updates

To release updates:

1. Update version in Xcode (e.g., 1.0.1)
2. Rebuild web app: `npm run build`
3. Sync: `npx cap sync ios`
4. Archive and upload new build
5. Submit for review in App Store Connect
