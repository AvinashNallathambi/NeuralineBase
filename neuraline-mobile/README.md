# Neuraline Mobile — React Native App

Native iOS and Android app for Neuraline EMR, optimized for iPads and Android tablets.

## Architecture

See `../REACT_NATIVE_ARCHITECTURE.md` for the full architecture document.

### Stack
- **React Native 0.76** (bare workflow)
- **TypeScript** (strict)
- **@react-navigation/native** v7 (drawer + native stack)
- **react-native-paper** v5 (Material 3 UI)
- **zustand** v5 (in-memory state, no persist — HIPAA)
- **@tanstack/react-query** v5 (server cache)
- **react-native-keychain** (Keychain/Keystore token storage)
- **react-native-quick-crypto** (RSA-OAEP login encryption)
- **react-native-biometrics** (Face ID / Touch ID / fingerprint)
- **react-native-webrtc** (telemedicine video calls)
- **@stripe/stripe-react-native** (PaymentSheet)
- **socket.io-client** (telemedicine signaling + messaging)

### Project Structure
```
neuraline-mobile/
├── src/
│   ├── app/               # App-level providers (future)
│   ├── features/          # Feature modules (auth, dashboard, patients, ...)
│   ├── components/        # Shared UI components
│   ├── navigation/        # Navigator config
│   ├── services/          # RN-specific service adapters
│   ├── store/             # zustand stores (in-memory only)
│   ├── theme/             # Design tokens + Paper theme
│   ├── hooks/             # Shared hooks
│   └── utils/             # Platform helpers
├── App.tsx                # Root component (providers)
├── index.js               # Entry point
└── package.json
```

### Shared Package
The `../shared/` package contains platform-agnostic types and API clients
extracted from the web app. Both the web app and this RN app import from it.

## Prerequisites

- **Node.js** 18+
- **For iOS**: macOS + Xcode 15+ + CocoaPods
- **For Android**: Android Studio + Android SDK (API 34+) + JDK 17

## Getting Started

### Install dependencies
```bash
cd neuraline-mobile
npm install
```

### iOS (requires macOS)
```bash
cd ios && pod install && cd ..
npx react-native run-ios --simulator "iPad Pro 13-inch (M4)"
```

### Android
```bash
# Set ANDROID_HOME to your SDK path
export ANDROID_HOME=$HOME/Library/Android/sdk
npx react-native run-android
```

### Metro bundler
```bash
npm start
```

### TypeScript check
```bash
npm run typecheck
```

## Environment

Copy `.env.example` to `.env` and set:
- `API_URL` — absolute backend URL (e.g. `https://api.neuraline.health/api/v1`)
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key for PaymentSheet
- `SENTRY_DSN` — Sentry DSN (optional)

## HIPAA Compliance

- **No PHI at rest**: zustand stores are in-memory only (no persist)
- **Token storage**: iOS Keychain / Android Keystore via `react-native-keychain`
- **Biometric gate**: Face ID / Touch ID required after backgrounding
- **Session timeout**: 15-min inactivity timeout on app background
- **Login encryption**: RSA-OAEP password encryption via `react-native-quick-crypto`
- **Sentry PHI scrub**: `beforeSend` strips request bodies and breadcrumbs

## Generating Native Projects

The `ios/` and `android/` folders are not included in this scaffold. Generate
them with:

```bash
# Option 1: Use React Native CLI to generate native projects
npx react-native init NeuralineMobile --directory ./temp-init
# Then copy the ios/ and android/ folders from temp-init/ to here

# Option 2: If you have an existing RN project, copy the native folders
```

## Status

This is a scaffold with:
- [x] Project structure + config
- [x] Shared types + API client package
- [x] Theme (Neuraline brand colors)
- [x] Auth store + patient auth store + app store (zustand)
- [x] Secure token storage (Keychain/Keystore)
- [x] RSA-OAEP login encryption
- [x] API client with interceptors
- [x] Biometric service
- [x] Session timeout (AppState-aware)
- [x] Navigation (Auth + Staff + tablet-aware drawer)
- [x] Login screen
- [x] Biometric unlock screen
- [x] Forgot password screen
- [x] Dashboard screen
- [x] Patient list screen

TODO:
- [ ] Generate native ios/ and android/ folders
- [ ] Remaining feature screens (appointments, clinical, Rx, labs, billing, telemedicine, etc.)
- [ ] Patient portal screens
- [ ] WebRTC telemedicine engine
- [ ] Stripe PaymentSheet integration
- [ ] Push notifications (FCM/APNs)
- [ ] Tablet split-view master-detail
- [ ] Sentry integration with PHI scrubbing
- [ ] E2E tests (Detox)
