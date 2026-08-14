# Neuraline Mobile — React Native Architecture

**Status:** Architecture proposal (pre-implementation)
**Date:** 2026-08-13
**Scope:** A new, standalone React Native project (`neuraline-mobile/`) that
delivers the Neuraline EMR as a true-native iPad and Android-tablet app,
running alongside the existing web app and sharing the same NestJS backend.

---

## 1. Where this project lives

```
NeuralineBase/                       ← existing monorepo root
├── backend/                         ← unchanged NestJS API (shared)
├── frontend/                        ← existing React + AntD web app (unchanged)
├── shared/                          ← NEW: shared TS types + API client
│   ├── types/                       ←  extracted from frontend/src/types
│   └── api-client/                  ←  extracted from frontend/src/services
└── neuraline-mobile/                ← NEW: this React Native project
    ├── src/
    │   ├── app/                     ← navigation, app root, providers
    │   ├── features/                ← feature modules (one per domain)
    │   ├── components/              ← shared native UI primitives
    │   ├── navigation/              ← navigator config + linking
    │   ├── services/                ← RN-specific service adapters
    │   ├── store/                   ← zustand stores (RN-flavored)
    │   ├── theme/                   ← native design tokens
    │   ├── hooks/                   ← shared hooks
    │   └── utils/                   ← crypto, storage, platform helpers
    ├── ios/                         ← Xcode project (iPad Universal)
    ├── android/                     ← Gradle project (tablet-optimized)
    ├── app.config.ts                ← Expo config (if Expo) / or bare RN
    ├── package.json
    └── tsconfig.json
```

**Key principle:** the RN app is a **separate project**, not a branch of
`frontend/`. The web app keeps using Ant Design; the RN app uses native
components. They share **only** the backend and (optionally) the
`shared/` package of types + pure-API-client code.

---

## 2. Technology Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **React Native 0.75+** (bare workflow, not Expo managed) | Bare gives full control over native modules (WebRTC, biometrics, screen capture) which Expo managed restricts. Expo SDK can still be used for tooling via `expo-modules` if desired. |
| Language | **TypeScript** (strict) | Match the web app |
| Navigation | **`@react-navigation/native` v7** + `@react-navigation/native-stack` + `@react-navigation/drawer` | Industry standard; supports iPad split/master-detail via `SplitNavigator` |
| State (client) | **`zustand`** (same as web) | Portable unchanged; no persist middleware (HIPAA) |
| State (server) | **`@tanstack/react-query` v5** (same as web) | Portable unchanged |
| HTTP | **`axios`** (same as web) + `axios-retry` | Reuse the interceptor pattern from `services/api.ts` |
| Realtime | **`socket.io-client`** v4 (same as web) | Portable unchanged |
| WebRTC | **`react-native-webrtc`** | Replaces `simple-peer`. Native WebRTC stack, supports `getDisplayMedia` on Android and `ReplayKit`-backed screen share on iOS |
| UI library | **`react-native-paper`** v5 (Material 3) | Closest spiritual analog to Ant Design; mature, themable, accessible. Alternative: `tamagui` if you want a design-system compiler. |
| Icons | **`@expo/vector-icons`** (MaterialCommunityIcons) | Replaces `@ant-design/icons` |
| Charts | **`victory-native`** v37 (Skia-backed) | Replaces `recharts` / `@ant-design/charts`. Skia renderer = 60fps on tablets. |
| Forms | **`react-hook-form`** + `@hookform/resolvers` + `zod` | AntD `Form` has no RN equivalent; RHF is the standard |
| Secure storage | **`react-native-keychain`** (iOS Keychain / Android Keystore) | Replaces `sessionStorage`. Tokens never touch plaintext storage. |
| Biometric | **`react-native-biometrics`** | Face ID / Touch ID / fingerprint unlock |
| Crypto (RSA-OAEP login) | **`react-native-quick-crypto`** | Replaces `window.crypto.subtle`. Node-style `crypto` backed by JSI (fast, native). |
| Payments | **`@stripe/stripe-react-native`** (PaymentSheet + SetupIntent) | Replaces `@stripe/react-stripe-js` (Stripe Elements iframe, web-only) |
| Push notifications | **`@react-native-firebase/messaging`** (FCM, Android + iOS) + **`@notifee/react-native`** (local + rich notifications) | FCM is the standard bridge to APNs on iOS. Notifee for foreground/local notifications. |
| Camera / files | **`react-native-image-picker`** + `react-native-document-picker` + `expo-file-system` | For patient photo upload, clinical document upload, telemedicine file share |
| Error tracking | **`@sentry/react-native`** | Replicate the web `beforeSend` PHI scrubbing |
| Networking extras | **`react-native-pinch`** (optional TLS pinning) | Pin API cert to prevent MITM on hospital Wi-Fi |
| Build / CI | **Fastlane** (iOS) + **Gradle Play publisher** (Android) + EAS Build (optional) | Automated store submissions |
| Testing | **Jest** + **React Native Testing Library** + **Detox** (E2E) | Match web stack |

---

## 3. Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native UI Layer                     │
│  features/* (screens)  ←  components/* (primitives)          │
│  react-native-paper  ·  victory-native  ·  react-hook-form   │
├─────────────────────────────────────────────────────────────┤
│                    Navigation Layer                          │
│  @react-navigation  ·  SplitNavigator (tablet)  ·  Linking   │
├─────────────────────────────────────────────────────────────┤
│                    State Layer                               │
│  zustand (auth, app)  ·  react-query (server cache)          │
│  NO persist — in-memory only (HIPAA)                         │
├─────────────────────────────────────────────────────────────┤
│                    Service Adapter Layer                     │
│  services/*  ←  shared/api-client  ←  axios + interceptors   │
│  socket.io-client  ·  react-native-webrtc  ·  stripe-rn      │
│  react-native-keychain  ·  react-native-biometrics           │
├─────────────────────────────────────────────────────────────┤
│                    Platform Bridge Layer                     │
│  Keychain · Keystore · Face ID · FCM/APNs · Camera · ReplayKit│
├─────────────────────────────────────────────────────────────┤
│                    Network (HTTPS + WSS)                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   NestJS Backend      │  ← unchanged
              │   /api/v1/*  +  /socket.io  │
              │   Postgres · Redis · Ollama · Whisper · coturn  │
              └───────────────────────┘
```

### 3.1 UI Layer (`features/`)
One folder per business domain, mirroring the web app's `pages/` structure:

```
src/features/
├── auth/                  ← Login, ForgotPassword, BiometricUnlock
├── dashboard/             ← Dashboard (provider + admin variants)
├── patients/              ← PatientList, PatientDetail (master-detail)
├── appointments/          ← Schedule, AppointmentDetail, slot picker
├── clinical/              ← EncounterList, NewEncounter, EncounterDetail,
│                             DocumentationSession, AI Scribe
├── prescriptions/         ← RxList, NewRx, EditRx, RxDetail
├── epcs/                  ← EPCS (DEA controlled-substance e-prescribing)
├── laboratory/            ← LabOrders, LabOrderDetail, patient labs
├── billing/               ← Claims, Invoices, ClaimDetail
├── remittance/            ← EOBs, posting
├── denials/               ← Denial management
├── appeals/               ← Appeal workflows
├── underpayments/         ← Underpayment tracking
├── eligibility/           ← Eligibility verification + COB
├── superbills/            ← Superbill list, new, detail, edit
├── provider-availability/ ← Provider schedule, availability blocks
├── telemedicine/          ← VideoRoom, TelemedicineCall, chat, screen share
├── messaging/             ← Secure messaging threads
├── notifications/         ← In-app notification center
├── automation/            ← Workflow templates + instances
├── reports/               ← Analytics (victory-native charts)
├── settings/              ← Settings, integrations, billing/subscription
├── subscriptions/         ← Plan management, payment methods, invoices
├── ai-encounter/          ← AI-assisted encounter documentation
├── portal/                ← Patient portal (separate auth scope)
│   ├── auth/              ← Patient login, setup-account
│   ├── dashboard/
│   ├── appointments/      ← Self-scheduling
│   ├── prescriptions/     ← Refill requests
│   ├── lab-results/       ← AI lab explainer
│   ├── billing/           ← Pay invoice (Stripe PaymentSheet)
│   ├── eobs/
│   ├── insurance/
│   ├── messages/          ← Patient ↔ provider secure messaging
│   ├── ai-assistant/      ← 5 AI tabs (lab, symptoms, interactions, education, visit prep)
│   └── profile/
└── landing/               ← Marketing/pricing (if needed in-app; usually web-only)
```

Each feature folder is self-contained:

```
features/patients/
├── PatientListScreen.tsx
├── PatientDetailScreen.tsx
├── PatientFormSheet.tsx
├── components/
│   ├── PatientCard.tsx
│   ├── AllergyChip.tsx
│   └── InsuranceCard.tsx
├── hooks/
│   └── usePatients.ts          ← react-query wrapper
├── navigation.ts               ← screen registration for this feature
└── types.ts                    ← feature-local types (re-exports from shared/)
```

### 3.2 Navigation Layer (`navigation/`)

**Two navigators, one codebase:**

```
src/navigation/
├── RootNavigator.tsx       ← decides Staff vs Patient vs Auth
├── StaffNavigator.tsx      ← drawer + stack for clinicians
├── PatientNavigator.tsx    ← stack for patient portal
├── AuthNavigator.tsx       ← login / forgot-password / biometric unlock
├── tablet/
│   ├── SplitNavigator.tsx  ← iPad/Android-tablet master-detail
│   └── NavigationRail.tsx  ← Android tablet rail (Material 3)
└── linking.ts              ← deep-link config (neuraline://patient/123)
```

**Tablet pattern (iPad + Android tablet):**

```tsx
// tablet/SplitNavigator.tsx — conceptual
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useIsTablet } from '../hooks/useIsTablet';

// On tablets: a persistent master list on the left, detail on the right.
// On phones: a normal stack (push/pop).
// react-navigation v7 supports this via SplitNavigator.
```

- **iPad**: `UIRequiresFullScreen = false` so the app supports Slide Over and
  Split View. `useIsTablet()` uses `react-native-device-info` `isTablet()` +
  size-class listener to reflow between split and stack.
- **Android tablet**: large/xxlarge resource qualifiers; a Material 3
  `NavigationRail` (left icon rail) replaces the drawer on wide screens.

### 3.3 State Layer (`store/`)

Two stores, **both in-memory only** (no `zustand/persist` — HIPAA rule carried
over from the web app):

```ts
// store/authStore.ts — staff auth
interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;        // hydrated from Keychain on app open
  isAuthenticated: boolean;
  login: (user, token, tenant) => Promise<void>;  // also writes Keychain
  logout: () => Promise<void>;                     // also clears Keychain
}

// store/appStore.ts — UI state (sidebar, notifications, unread count)
interface AppState {
  unreadCount: number;
  notifications: Notification[];
  // ... same shape as web, minus the sidebarCollapsed (tablet uses rail)
}
```

**Token lifecycle on native:**

```
App cold start
  → read token from Keychain (biometric-gated if enabled)
  → hydrate authStore
  → if valid: StaffNavigator
  → if expired/missing: AuthNavigator (Login / BiometricUnlock)

Login screen
  → RSA-OAEP encrypt password (react-native-quick-crypto)
  → POST /api/v1/auth/login
  → on success: write token to Keychain, hydrate authStore

App backgrounded
  → SessionTimeoutProvider starts timer
  → on timeout: clear in-memory store (Keychain entry stays, but
    biometric re-prompt required to re-hydrate)

Logout
  → POST /api/v1/auth/logout (blacklist token)
  → clear Keychain entry
  → reset in-memory store
  → navigate to AuthNavigator
```

### 3.4 Service Adapter Layer (`services/`)

This is the bridge between the **shared API client** and **native platform
APIs**. The shared package (`shared/api-client/`) contains pure axios calls
with no DOM dependencies. The RN `services/` layer wraps them with native
concerns:

```
src/services/
├── api.ts                  ← axios instance + interceptors (RN-flavored)
├── secureTokenStorage.ts   ← Keychain read/write (replaces sessionStorage)
├── authCrypto.ts           ← RSA-OAEP via react-native-quick-crypto
│                             (replaces window.crypto.subtle)
├── navigationRef.ts        ← imperative nav ref (replaces window.location.href)
├── telemedicine/
│   ├── WebRTCEngine.ts     ← react-native-webrtc peer wrapper
│   ├── ScreenShare.ts      ← ReplayKit (iOS) / MediaProjection (Android)
│   └── signaling.ts        ← socket.io-client (shared with web)
├── payments/
│   └── stripeNative.ts     ← @stripe/stripe-react-native PaymentSheet
├── push/
│   └── pushService.ts      ← FCM registration + APNs token relay
├── biometric/
│   └── biometricService.ts ← Face ID / Touch ID / fingerprint
├── files/
│   └── uploadService.ts    ← image-picker + document-picker → multipart
└── ... (one per web service, thin wrappers around shared/api-client)
```

**`services/api.ts` — the key difference from web:**

```ts
// Web version reads sessionStorage; native reads Keychain.
import axios from 'axios';
import { getSecureToken, clearSecureToken } from './secureTokenStorage';
import { navigationRef } from './navigationRef';

export const api = axios.create({
  baseURL: API_BASE_URL,           // absolute: https://api.neuraline.health/api/v1
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const isPatientEndpoint = /* same logic as web */;
  const token = await getSecureToken(isPatientEndpoint ? 'patient' : 'staff');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401) {
      await clearSecureToken(/* scope */);
      // Imperative reset instead of window.location.href
      navigationRef.reset({ routes: [{ name: 'Login' }] });
    }
    return Promise.reject(error);
  },
);
```

### 3.5 Platform Bridge Layer

Native modules the RN app links against:

| Capability | iOS | Android |
|---|---|---|
| Secure token storage | Keychain (`react-native-keychain`) | Keystore (`react-native-keychain`) |
| Biometric unlock | LocalAuthentication (Face ID / Touch ID) | BiometricPrompt |
| Push | APNs via FCM (`@react-native-firebase/messaging`) | FCM |
| WebRTC | `react-native-webrtc` (native WebRTC stack) | `react-native-webrtc` |
| Screen share | ReplayKit (`RCTScreenCapture`) | MediaProjection |
| Camera | AVFoundation (via `react-native-image-picker`) | CameraX |
| Document picker | UIDocumentPicker (`react-native-document-picker`) | SAF / `ACTION_OPEN_DOCUMENT` |
| Crypto | OpenSSL via JSI (`react-native-quick-crypto`) | BoringSSL via JSI |
| Stripe | `@stripe/stripe-react-native` (PaymentSheet) | `@stripe/stripe-react-native` |
| Screenshot block | `windowProtected` / `isSecureTextEntry` trick | `FLAG_SECURE` on PHI screens |

---

## 4. The `shared/` Package — What Actually Reuses from Web

This is the **only code shared** between `frontend/` (web) and
`neuraline-mobile/` (RN). It must have **zero DOM dependencies**.

```
shared/
├── types/
│   ├── index.ts            ← extracted from frontend/src/types/index.ts
│   ├── patient.ts
│   ├── encounter.ts
│   ├── prescription.ts
│   ├── billing.ts
│   ├── telemedicine.ts     ← extracted from telemedicineService.ts interfaces
│   ├── subscription.ts
│   └── ...
├── api-client/
│   ├── http.ts             ← axios factory (no interceptors — those are app-specific)
│   ├── patients.ts         ← pure functions: getPatient(id), listPatients(query)
│   ├── appointments.ts
│   ├── clinical.ts
│   ├── billing.ts
│   ├── telemedicine.ts     ← REST calls only (no socket.io — that's app-side)
│   ├── subscriptions.ts
│   └── ...
└── constants/
    ├── specialties.ts      ← mirrors backend/src/modules/clinical/specialties.ts
    └── enums.ts
```

**What does NOT go in `shared/`:**
- `sessionStorage` / `localStorage` access (web-only)
- `window.crypto.subtle` (web-only — RN uses `react-native-quick-crypto`)
- `simple-peer` (web-only — RN uses `react-native-webrtc`)
- `@stripe/react-stripe-js` (web-only — RN uses `@stripe/stripe-react-native`)
- `react-router-dom` (web-only — RN uses `@react-navigation`)
- `antd` components (web-only — RN uses `react-native-paper`)
- `window.location` redirects (web-only — RN uses `navigationRef`)

The web `frontend/` keeps its own thin `services/api.ts` that adds
`sessionStorage` interceptors on top of `shared/api-client/http.ts`. The RN
app adds Keychain interceptors. **Same business logic, different platform
bindings.**

---

## 5. Backend Changes Required

The NestJS backend needs **additive changes only** — no rewrite:

### 5.1 Push Notifications (new)
```
backend/src/modules/notifications/
├── providers/
│   ├── email-provider.interface.ts       ← existing
│   ├── resend-email.provider.ts          ← existing
│   ├── mock-email.provider.ts            ← existing
│   ├── push-provider.interface.ts        ← NEW
│   ├── fcm-push.provider.ts              ← NEW (Android + iOS via FCM)
│   └── apns-push.provider.ts             ← NEW (optional, direct APNs)
├── entities/
│   ├── notification.entity.ts            ← existing
│   └── notification-device-token.entity.ts  ← NEW
└── notifications.controller.ts           ← add device register/unregister endpoints
```

New endpoints:
- `POST /api/v1/notifications/devices` — register FCM/APNs token
- `DELETE /api/v1/notifications/devices/:token` — unregister on logout
- Wire `SubscriptionNotificationService` cron to also push (trial/dunning/expiry/card-expiry alerts)

### 5.2 CORS / CSP
- Add `neuraline://` (custom scheme), `https://` (if using deep links) to `CORS_ORIGINS`.
- Update `helmet` CSP `connect-src` to allow the mobile app origin.

### 5.3 Refresh Token Rotation (recommended)
Native apps are long-lived. Add refresh-token rotation so a stolen 15-min
access token can't be replayed:
- `POST /api/v1/auth/refresh` — exchange refresh token for new access token
- `POST /api/v1/patients/auth/refresh` — already exists per AGENTS.md
- Rotate refresh token on each use; invalidate on reuse (reuse detection)

### 5.4 App-Version Header (recommended)
- Mobile client sends `X-App-Version: 1.2.3` + `X-App-Platform: ios|android`
- Backend can return `426 Upgrade Required` if version is below minimum
- Lets you force-update old store builds

### 5.5 Everything Else — Unchanged
- Auth (JWT, RSA-OAEP login, bcrypt, lockout, blacklist) — works as-is
- WebRTC signaling (Socket.IO gateway + coturn TURN) — works as-is
- File uploads (`FileInterceptor` / multer) — works as-is (RN sends multipart)
- Stripe webhooks — works as-is (mobile uses PaymentSheet, server-side unchanged)
- AI services (Ollama, Whisper) — works as-is
- All clinical/billing/eligibility/Rx modules — works as-is

---

## 6. Tablet / iPad-Specific Architecture

### 6.1 Adaptive Layout
```ts
// hooks/useIsTablet.ts
import DeviceInfo from 'react-native-device-info';
import { useWindowDimensions } from 'react-native';

export function useIsTablet() {
  const { width, height } = useWindowDimensions();
  const minDim = Math.min(width, height);
  return DeviceInfo.isTablet() || minDim >= 768;
}
```

### 6.2 Navigation Patterns per Form Factor

| Screen | Phone | Tablet (iPad / Android) |
|---|---|---|
| Patient list → detail | Stack push | Split view: list left, detail right |
| Schedule | Single column | Week grid + side panel for selected appt |
| Encounter editor | Stacked sections | 2-column: SOAP left, vitals/orders right |
| Billing claims | Stack | Table + detail pane |
| Telemedicine call | Full screen | PiP-capable + chat sidebar |
| Settings | Stack | Master-detail with sections |

### 6.3 iPad Multitasking
- `Info.plist`: `UIRequiresFullScreen = false`, `UISupportedInterfaceOrientations` = all four
- Listen for size-class changes; reflow split → stack when width < 768 (Slide Over)
- `react-navigation` `SplitNavigator` handles this automatically when configured

### 6.4 Android Tablet
- `res/layout-large/`, `res/layout-xlarge/` qualifiers for native screens
- Material 3 `NavigationRail` on wide screens (left icon rail, no hamburger drawer)
- `res/values-w820dp/dimens.xml` for tablet spacing

---

## 7. Security & HIPAA Architecture

| Concern | Implementation |
|---|---|
| **No PHI at rest** | zustand stores are in-memory only (no persist). react-query cache is in-memory. No SQLite/AsyncStorage caching of clinical data. |
| **Token storage** | `react-native-keychain` → iOS Keychain (kSecAttrAccessibleWhenUnlockedThisDeviceOnly) / Android Keystore. Never `AsyncStorage`. |
| **Biometric gate** | On app foreground (after backgrounding), require Face ID / Touch ID / fingerprint to re-hydrate the token from Keychain. Configurable per tenant. |
| **Session timeout** | `SessionTimeoutProvider` uses `AppState` listener — on `background`, start timer; on `active`, if expired, force re-auth. Same 15-min default as web. |
| **Login encryption** | `react-native-quick-crypto` performs RSA-OAEP password encryption (same scheme as web's `window.crypto.subtle`). Backend decrypts unchanged. |
| **TLS** | All API + Socket.IO + WebRTC over TLS. Optional cert pinning via `react-native-pinch` for hospital Wi-Fi MITM protection. |
| **Screenshot block** | `FLAG_SECURE` (Android) / `windowProtected` (iOS) on PHI screens (Patient Detail, Encounter, Rx, telemedicine). |
| **Sentry PHI scrub** | `@sentry/react-native` `beforeEvent` strips request bodies + breadcrumbs (same logic as web `main.tsx`). |
| **Jailbreak / root** | `react-native-jailbreak-root-detection` — warn or refuse on compromised devices (configurable). |
| **BAA coverage** | Required with: Sentry, Stripe, Firebase (FCM), Resend, hosting provider. Apple/Google do not sign BAAs but process only token IDs (not PHI) for push. |

---

## 8. Telemedicine Architecture (Native WebRTC)

This is the most platform-specific part. The web app uses `simple-peer`
(browser WebRTC). The RN app uses `react-native-webrtc` directly.

```
src/features/telemedicine/
├── TelemedicineCallScreen.tsx     ← UI (video tiles, controls, chat)
├── VideoTile.tsx                  ← RTCView wrapper for remote/local video
├── components/
│   ├── CallControls.tsx           ← mute, camera, screen share, end call
│   ├── ChatPanel.tsx              ← in-call messaging
│   └── ParticipantGrid.tsx        ← adaptive grid (1:1, 3x3 for group)
└── engine/
    ├── WebRTCEngine.ts            ← manages RTCPeerConnection, ICE, tracks
    ├── SignalingChannel.ts        ← socket.io-client (shared with web)
    ├── ScreenShare.ios.ts         ← ReplayKit integration
    ├── ScreenShare.android.ts     ← MediaProjection integration
    └── MediaDevices.ts            ← camera/mic enumeration + permissions
```

**Flow:**
1. `SignalingChannel` connects to `/socket.io` (namespace `telemedicine`) — same as web
2. `WebRTCEngine` creates `RTCPeerConnection` with ICE servers from `VITE_TURN_SERVERS` (coturn)
3. `MediaDevices.getUserMedia()` → local video/audio tracks
4. Signaling exchange (offer/answer/candidates) via Socket.IO — same protocol as web gateway
5. `RTCView` renders remote streams
6. Screen share: iOS uses ReplayKit (`RPSystemBroadcastActivityView`), Android uses `MediaProjection` API

**Backend unchanged**: the `TelemedicineGateway` (Socket.IO) and `coturn` TURN
server work identically for native clients.

---

## 9. Stripe Payments Architecture (Native)

Web uses Stripe Elements (iframe). RN uses `@stripe/stripe-react-native`:

```
src/features/subscriptions/
├── PaymentMethodsScreen.tsx       ← list saved cards/ACH
├── AddPaymentMethodSheet.tsx      ← PaymentSheet (card + ACH)
├── ChangePlanModal.tsx            ← plan switcher
├── InvoicesScreen.tsx             ← invoice history
└── services/stripeNative.ts       ← wraps @stripe/stripe-react-native
```

**Flow (SetupIntent — adding a card):**
1. `POST /api/v1/subscriptions/setup-intent` → backend creates SetupIntent, returns `clientSecret`
2. RN calls `initPaymentSheet({ setupIntentClientSecret })` → `presentPaymentSheet()`
3. Stripe native SDK handles card entry + 3DS + India e-mandate (same RBI logic as web)
4. On success, `POST /api/v1/subscriptions/payment-methods/attach` with the PM ID
5. Backend attaches to customer + sets default — unchanged from web

**Patient portal invoice payment:**
1. `POST /api/v1/patients/portal/invoices/:id/pay` → backend creates PaymentIntent, returns `clientSecret`
2. RN `initPaymentSheet({ paymentIntentClientSecret })` → `presentPaymentSheet()`
3. 3DS handled natively (no iframe redirect)

**Backend unchanged**: all Stripe webhooks, dunning, invoice sync, and
e-mandate logic stay the same.

---

## 10. Build, CI/CD, and Release

### 10.1 Local Development
```bash
cd neuraline-mobile
yarn install
npx react-native start              # Metro bundler
npx react-native run-ios            # iPad Simulator (Universal)
npx react-native run-android        # Android tablet emulator
```

### 10.2 CI/CD Pipeline
```
GitHub Actions:
  ├── typecheck (tsc --noEmit)
  ├── lint (eslint)
  ├── unit tests (jest + RNTL)
  ├── e2e tests (Detox on simulator)
  ├── iOS build (Fastlane gym → .ipa)
  └── Android build (Gradle bundleRelease → .aab)
```

### 10.3 Release
- **iOS**: Fastlane `match` (certs) + `gym` (build) + `pilot` (TestFlight) → App Store Connect
- **Android**: Gradle `bundleRelease` → Play Console internal track → production
- **Version sync**: `X-App-Version` header lets backend force-update old builds

### 10.4 Signing & Provisioning
- iOS: Apple Developer account + App ID + provisioning profiles (Fastlane `match` stores certs in encrypted git)
- Android: Upload keystore (stored in CI secrets) + Play App Signing

---

## 11. Effort & Team

This is a **full frontend rewrite** of a 30+ page application. Realistic scope:

| Workstream | Relative Size |
|---|---|
| Project scaffold + navigation + theme + shared package extraction | M |
| Auth (login, biometric, secure storage, RSA-OAEP, session timeout) | M |
| Dashboard + Patients (master-detail) | M |
| Clinical (encounters, AI scribe, documentation sessions) | L |
| Prescriptions + EPCS | M |
| Laboratory | S |
| Billing + Claims + Remittance + Denials + Appeals + Underpayments | L |
| Eligibility + Superbills | M |
| Provider Availability + Appointments | M |
| Telemedicine (WebRTC engine, screen share, chat) | L |
| Messaging | S |
| Subscriptions + Stripe native (PaymentSheet) | M |
| Patient portal (auth + 10 screens + 5 AI tabs) | L |
| Settings + Integrations + Reports | M |
| Push notifications (FCM/APNs + backend) | M |
| Tablet responsive (split navigators, iPad multitasking) | M |
| Sentry, error boundaries, PHI scrubbing | S |
| CI/CD + Fastlane + store submission | M |
| Testing (unit + Detox E2E) | L |

**Team recommendation:** 2–3 RN engineers + 1 backend engineer (for push +
device-token endpoints) for ~3–6 months to reach feature parity with the web
app. The patient portal can be a later sub-phase.

---

## 12. Decision Matrix — Confirming RN Over Capacitor

| Factor | Capacitor | React Native (this plan) |
|---|---|---|
| Time to first store build | 4–8 weeks | 3–6 months |
| UI fidelity to web | 100% (same AntD) | 0% (full native redesign) |
| Native UX quality | Medium (WebView) | High (true native) |
| WebRTC screen share on iPad | Blocked (no getDisplayMedia) | Supported (ReplayKit) |
| Offline capability | Hard (WebView cache) | Native (SQLCipher if needed) |
| iPad multitasking (Split View) | Poor | Excellent |
| Code reuse from web | ~95% | ~20% (types + API client only) |
| Maintenance burden | 1 codebase (web = mobile) | 2 codebases (web + RN) |
| Long-term cost | Low | High (two UIs to maintain) |

**You've chosen RN because native UX is non-negotiable.** The tradeoff is a
second codebase that must track every backend API change the web app tracks.
The `shared/` package mitigates this for types and API calls, but every UI
screen is built and maintained twice.

---

## 13. Next Steps (if you approve this architecture)

1. **Create `shared/` package** — extract `frontend/src/types/` and the pure
   axios calls from `frontend/src/services/` into a platform-agnostic package.
2. **Scaffold `neuraline-mobile/`** — bare RN project, TypeScript strict,
   `react-native-paper` theme matching Neuraline's brand colors (`#0D7C8A`).
3. **Auth foundation** — Keychain token storage, RSA-OAEP login via
   `react-native-quick-crypto`, biometric unlock, session timeout.
4. **Navigation shell** — `RootNavigator` + `StaffNavigator` + tablet
   `SplitNavigator`.
5. **First feature: Dashboard + Patients** — prove the master-detail tablet
   pattern end-to-end.
6. **Telemedicine** — `react-native-webrtc` engine + Socket.IO signaling
   (highest-risk component, validate early).
7. **Backend push provider** — FCM + device-token endpoints.
8. **Remaining features** in priority order.

---

## TL;DR

- **New standalone project** (`neuraline-mobile/`) running alongside the web
  app, sharing only the NestJS backend and a `shared/` types/API-client package.
- **Stack:** React Native (bare) + `@react-navigation` + `react-native-paper`
  + `zustand` + `react-query` + `react-native-webrtc` + `@stripe/stripe-react-native`
  + `react-native-keychain` + `react-native-biometrics` + `react-native-quick-crypto`
  + `@react-native-firebase/messaging`.
- **Backend: additive only** — add FCM/APNs push provider + device-token
  endpoints + CORS/CSP updates + optional refresh-token rotation. No rewrite.
- **Tablet-first:** iPad split-view master-detail + Android NavigationRail,
  adaptive layouts via `useIsTablet()`.
- **HIPAA:** no PHI at rest, Keychain/Keystore tokens, biometric gate, session
  timeout on background, Sentry PHI scrub, optional TLS pinning + screenshot block.
- **Biggest components:** telemedicine (native WebRTC + ReplayKit/MediaProjection)
  and the patient portal (separate auth scope + 5 AI tabs).
- **Cost:** a second codebase to maintain, but a true native iPad/tablet UX
  that a WebView wrapper cannot deliver.
