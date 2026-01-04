# Effortless CRM - Mobile App (iOS & Android)

Voice-powered CRM companion app for managing deals on the go.

## Features

### 🔐 **Google OAuth Sign-In**
- Domain-based authentication
- Secure Firebase integration
- Automatic session management

### 📊 **Visual Pipelines**
- Kanban board view
- Drag-and-drop deals (coming soon)
- Real-time sync with web extension
- Multiple pipeline support

### 💼 **Deal Management**
- View all deals
- Deal detail screen with:
  - Contact information
  - Deal value and champion
  - Linked emails (see all emails from Gmail)
  - Notes and tasks
  - Photo attachments

### 🎤 **Voice Commands**
Hands-free CRM management with natural language:
- "Show all deals"
- "Open [deal name] deal"
- "Create new deal for [company]"
- "Set value to $50,000"
- "Move to proposal stage"
- "Add note [your note]"
- "Make [person] the champion"

Voice commands match the Chrome extension's capabilities.

### 📸 **Photo Attachments**
- Take photos of important deal details
- Attach screenshots to deals
- View attachments in grid layout
- Syncs across all devices via Firebase

### 👥 **Multi-User Collaboration**
- Real-time sync via Firebase
- See emails linked by team members
- View who created/modified deals
- Shared attachments and notes

## Tech Stack

- **React Native 0.73** - Cross-platform framework
- **TypeScript** - Type safety
- **React Navigation** - Navigation
- **Firebase Auth** - Authentication
- **Firebase Firestore** - Database
- **Google Sign-In** - OAuth
- **React Native Voice** - Voice recognition
- **React Native Image Picker** - Camera/gallery
- **React Native Vector Icons** - Icons

## Installation

### Prerequisites

- Node.js 18+
- React Native CLI
- Xcode (for iOS)
- Android Studio (for Android)
- Google Cloud Project with OAuth configured
- Firebase project

### Setup

1. **Install dependencies:**
   ```bash
   cd mobile-app
   npm install
   ```

2. **Configure Google Sign-In:**

   Edit `src/services/AuthService.ts`:
   ```typescript
   webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
   ```

3. **Configure Firebase:**

   - Download `google-services.json` (Android) and place in `android/app/`
   - Download `GoogleService-Info.plist` (iOS) and place in `ios/`

4. **Install iOS dependencies:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

5. **Run the app:**

   **iOS:**
   ```bash
   npm run ios
   ```

   **Android:**
   ```bash
   npm run android
   ```

## Project Structure

```
mobile-app/
├── src/
│   ├── screens/          # App screens
│   │   ├── SignInScreen.tsx
│   │   ├── PipelinesScreen.tsx
│   │   ├── DealsScreen.tsx
│   │   ├── DealDetailScreen.tsx
│   │   ├── VoiceCommandScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── navigation/       # Navigation setup
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── services/         # Business logic
│   │   ├── AuthService.ts        # Google OAuth
│   │   ├── FirebaseService.ts    # Database operations
│   │   ├── VoiceService.ts       # Voice recognition
│   │   └── CameraService.ts      # Photo capture
│   ├── components/       # Reusable components
│   ├── utils/           # Helper functions
│   └── assets/          # Images, fonts
├── android/             # Android native code
├── ios/                 # iOS native code
├── App.tsx             # Root component
├── index.js            # Entry point
└── package.json        # Dependencies
```

## Configuration

### Android Setup

1. **Enable Google Sign-In:**

   Edit `android/app/build.gradle`:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

2. **Add permissions in `AndroidManifest.xml`:**
   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   ```

### iOS Setup

1. **Add to `Info.plist`:**
   ```xml
   <key>NSCameraUsageDescription</key>
   <string>Effortless needs camera access to take photos of deal details</string>
   <key>NSMicrophoneUsageDescription</key>
   <string>Effortless needs microphone access for voice commands</string>
   <key>NSPhotoLibraryUsageDescription</key>
   <string>Effortless needs photo library access to attach images</string>
   ```

2. **Configure Google Sign-In:**
   ```xml
   <key>GIDClientID</key>
   <string>YOUR_IOS_CLIENT_ID</string>
   ```

## Voice Commands Reference

### Deal Management
- `"Show all deals"`
- `"Open [deal name] deal"`
- `"Create new deal for [company]"`

### Deal Updates
- `"Set value to $[amount]"`
- `"Make [person] the champion"`
- `"Move to [stage name]"`

### Notes & Tasks
- `"Add note [your note]"`
- `"Add task [task description]"`

### Navigation
- `"Show [pipeline name] pipeline"`
- `"Search for [query]"`

## Building for Production

### Android

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### iOS

```bash
cd ios
xcodebuild -workspace EffortlessCRM.xcworkspace \
  -scheme EffortlessCRM \
  -configuration Release
```

Or build in Xcode: **Product → Archive**

## Publishing

### Google Play Store

1. Create app listing
2. Upload APK or AAB
3. Fill out store details
4. Submit for review

### Apple App Store

1. Create app in App Store Connect
2. Archive in Xcode
3. Upload via Xcode Organizer
4. Submit for review

## Permissions

The app requests:

- **Camera** - Take photos of deal details
- **Photo Library** - Attach existing images
- **Microphone** - Voice commands
- **Internet** - Sync with Firebase

## Troubleshooting

### Voice recognition not working

**Android:**
- Ensure Google app is installed and up-to-date
- Check microphone permission granted

**iOS:**
- Check microphone permission in Settings
- Speech recognition requires internet connection

### Sign-in failing

- Verify `webClientId` matches Firebase Console
- Check OAuth consent screen configured
- Ensure SHA-1 fingerprint added (Android)

### Firebase sync issues

- Verify Firestore rules allow authenticated users
- Check internet connection
- Verify Firebase config files in place

## Development

### Debug Mode

```bash
# Enable Chrome DevTools
npm start

# In Chrome, navigate to:
chrome://inspect
```

### Hot Reload

- **iOS**: Cmd + R
- **Android**: Ctrl + M → Reload / R + R

## Contributing

This mobile app syncs with the Chrome extension backend. Data structure must remain compatible.

## License

© 2026 Effortless CRM. All rights reserved.

## Support

- Documentation: See main repository README
- Issues: Report in main repository
- Contact: support@effortlesscrm.com
