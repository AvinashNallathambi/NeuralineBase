# Neuraline EMR — Native iOS / Android (iPad & Tablet) Conversion Report

**Prepared:** 2026-08-13
**Scope:** Convert the existing Neuraline EMR web application into native
installable iOS and Android apps optimized for iPads and Android tablets.

---

## 1. Current Architecture Snapshot

### 1.1 Frontend (`frontend/`)
| Layer | Technology | Native Compatibility |
|---|---|---|
| UI framework | React 18.3 | Works in Capacitor WebView; reusable in React Native via rewrite |
| Build tool | Vite 5 | Web-only (Capacitor wraps the Vite build output) |
| Component lib | **Ant Design 6** (`antd`) | **Web-only** — no RN port. Largest blocker for RN path |
| Charts | `@ant-design/charts`, `recharts` (SVG/Canvas) | Web-only — need `victory-native` / `react-native-gifted-charts` |
| Routing | `react-router-dom` 7 (`createBrowserRouter`) | Browser history API — needs adapter for native |
| State | `zustand` 5 (in-memory, **no persist** — HIPAA) | Portable to RN unchanged |
| Server state | `@tanstack/react-query` 5 | Portable to RN unchanged |
| HTTP | `axios` (centralized interceptor in `services/api.ts`) | Portable; token storage layer needs swap |
| Realtime | `socket.io-client` 4 | Portable to RN unchanged |
| WebRTC | **`simple-peer`** + `navigator.mediaDevices.getUserMedia` / `getDisplayMedia` | **Browser-only** — uses Node streams + browser WebRTC. Must be replaced with `react-native-webrtc` |
| Payments | `@stripe/react-stripe-js` (Stripe Elements iframe) | **Web-only** — must be replaced with `@stripe/stripe-react-native` |
| Auth crypto | **Web Crypto API** (`window.crypto.subtle`, RSA-OAEP) for login password encryption | Works inside Capacitor WebView; needs `react-native-quick-crypto` in RN |
| Error tracking | `@sentry/react` | Has RN equivalent (`@sentry/react-native`) |
| Token storage | `sessionStorage` (`neuraline_token`, `neuraline_patient_token`) | **Not available in RN** — needs Keychain (iOS) / Keystore (Android) |
| Polyfills | `polyfills.ts` shims `Buffer` / `global` / `process` onto `window` | Needed for some libs in both paths |

### 1.2 Backend (`backend/`)
The NestJS backend is **API-only** and requires **no rewrite** for native. Key facts:

- REST API under `/api/v1/*`, served by NestJS on port 4000 (4001 in Docker).
- **Swagger** docs at `/api/docs` (non-production) — useful for generating typed clients.
- **Auth**: JWT (`@nestjs/jwt`), bcrypt password hashing, RSA-OAEP encrypted
  passwords from the login form (decrypted server-side). Two strategies:
  `jwt` (staff) and `patient-jwt` (patients). Account lockout after 5 failed
  attempts. Token blacklist for logout.
- **WebRTC signaling**: Socket.IO gateway at `/socket.io` (namespace
  `telemedicine`), backed by a `coturn` TURN server (ports 3478/5349 + UDP
  relay range 49152-49172) configured in `docker-compose.yml`.
- **File uploads**: `@nestjs/platform-express` `FileInterceptor` / `multer` in
  `clinical/documentation`, `telemedicine`, `patients`, `billing` controllers.
- **Notifications**: email-only (`Resend` + `Mock` providers). **No push
  notification provider** (no FCM/APNS) — this is a gap for native.
- **Security middleware**: `helmet`, CORS (configurable via `CORS_ORIGINS`),
  `compression`, raw-body webhook parser for Stripe signature verification.
- **AI services**: Ollama (port 11434) + Whisper (port 8001) — backend-side,
  transparent to native clients.

### 1.3 Responsive / Mobile Readiness Today
- `MainLayout.tsx` has a `MOBILE_BREAKPOINT = 768` with a collapsible sidebar
  and overlay drawer — **the only responsive accommodation**.
- `global.css` has a single `@media print` block; no tablet/phone media queries.
- A handful of pages use Ant Design's `Grid.useBreakpoint()` (prescriptions,
  settings, provider schedule, AI encounter).
- **No PWA manifest, no service worker, no offline support, no Capacitor/Expo
  config exists.** The app is a pure desktop-first SPA.

### 1.4 HIPAA Constraints That Affect Native
- `dataStore.ts` deliberately **removed `zustand/persist`** so PHI is never
  written to `localStorage`/IndexedDB. Any native solution must preserve this:
  no on-device SQLite caching of clinical data without encryption-at-rest and
  BAA-covered storage.
- Sentry `beforeSend` strips PHI from breadcrumbs/request bodies — must be
  replicated in the native Sentry config.
- Session timeout (`SessionTimeoutProvider`) and token blacklist must continue
  to be enforced.

---

## 2. Conversion Approaches Evaluated

| Approach | Effort | UX fidelity | HIPAA risk | Verdict |
|---|---|---|---|---|
| **A. Capacitor (WebView wrapper)** | Low–Medium | High (same UI) | Low (no new code surface) | **Recommended for v1** |
| **B. React Native (full rewrite)** | High | Highest (true native UI) | Medium (new storage/crypto code) | Recommended for v2 |
| **C. Fully native (Swift + Kotlin)** | Very High | Highest | Medium | Not recommended (two codebases) |
| **D. PWA (installable web)** | Lowest | Medium | Low | Good interim, but no App Store/Play presence, limited background push on iOS |

### 2.1 Recommended Strategy: **Hybrid Phased**

> **Phase 1 — Capacitor** to ship iPad/Android-tablet apps to the App Store and
> Play Store fast, reusing 100% of the existing React + Ant Design UI.
> **Phase 2 — React Native** for a true-native experience (native navigation,
> biometric auth, native charts, better offline) once product-market fit on
> tablets is validated.

---

## 3. Phase 1 — Capacitor Wrapper (Recommended v1)

Capacitor wraps the existing Vite build in a native iOS (Swift) and Android
(Kotlin) shell. The web bundle runs in a WKWebView / Android WebView, with
native bridges for camera, push, files, biometrics, and secure storage.

### 3.1 What Works As-Is
- React + Ant Design + react-router + zustand + react-query + axios +
  socket.io-client + Sentry all run unchanged inside the WebView.
- Web Crypto API (`window.crypto.subtle`) for RSA-OAEP login encryption works
  in WKWebView and Android WebView.
- Stripe Elements iframe renders inside the WebView (Stripe officially
  supports Capacitor for Stripe Elements).
- WebRTC `getUserMedia` works in WKWebView on iOS 14.3+ and Android WebView
  with `simple-peer` — though see §3.3 for caveats.

### 3.2 Required Changes

| Area | Change |
|---|---|
| **Routing** | Switch `createBrowserRouter` to `createHashRouter` (or use Capacitor's deep-link plugin) — file:// origin has no history API |
| **API base URL** | `VITE_API_URL` must be an absolute URL (`https://api.neuraline.health/api/v1`), not the dev proxy `/api/v1` |
| **Token storage** | Replace `sessionStorage.getItem/setItem` with `@capacitor-community/secure-storage` (Keychain/Keystore). Update `services/api.ts` interceptors + `ProtectedRoute`/`PatientRoute`/`SessionTimeoutProvider` |
| **window.location redirects** | Replace `window.location.href = '/login'` in `api.ts` 401 handler with `navigate()` from a navigation ref (Capacitor can't navigate the OS) |
| **Push notifications** | Add `@capacitor/push-notifications` + backend FCM (Android) / APNs (iOS) provider in `notifications` module (currently email-only) |
| **Biometric login** | Add `@capacitor-community/biometric-auth` for Face ID / Touch ID / fingerprint unlock of the secure-storage token |
| **Camera/file uploads** | `FileInterceptor` endpoints already accept multipart; add `@capacitor/camera` + `@capacitor/filesystem` for native pickers feeding `<input type=file>` |
| **App icons / splash** | Add `@capacitor/assets` to generate from `public/logo.png` |
| **CORS** | Add the app's `capacitor://` (iOS) / `https://localhost` (Android) origins to `CORS_ORIGINS` |
| **CSP** | Update `helmet` content-security-policy to allow `capacitor://*` and `https://localhost` |
| **Status bar / safe areas** | `@capacitor/status-bar` + `@capacitor/keyboard` + `safe-area-inset-*` CSS for notch/home-indicator on tablets |

### 3.3 WebRTC / Telemedicine Caveats (Capacitor)
- `simple-peer` works in the WebView, but **`getDisplayMedia` (screen share)
  is not supported in iOS WKWebView**. Screen share from an iPad will require
  the native `ReplayKit` integration via a Capacitor plugin (custom or
  `@capacitor-community/screen-broadcast`).
- Android WebView supports `getDisplayMedia` from Android 10+.
- The existing `coturn` TURN server and `VITE_TURN_SERVERS` env config carry
  over unchanged.
- **Alternative**: replace `simple-peer` with `react-native-webrtc` even inside
  Capacitor via a local plugin if WebView WebRTC proves unreliable on target
  devices.

### 3.4 Tablet-Specific UI Work
- Add tablet media queries / `useBreakpoint()` to the densest pages
  (Dashboard, Patient Detail, Encounter, Billing, Superbill, Settings) so they
  use the full iPad/Android-tablet canvas instead of the desktop layout
  squeezed into a 1024px viewport.
- Add a "split view" (master-detail) for Patient list → Patient detail on
  tablets, mirroring iPad Mail/Settings patterns.
- Add `viewport-fit=cover` to `index.html` and respect safe areas.

### 3.5 App Store / Play Store Considerations
- **Health apps**: Apple requires the `healthkit` entitlement only if you read
  HealthKit data — Neuraline does not, so no special health-app review.
- **Mental/Behavioral health content**: Apple may request content moderation
  documentation for the Behavioral Health templates and AI symptom checker.
- **Encryption export compliance** (ITSAppUsesNonExemptEncryption): RSA-OAEP
  + TLS qualify for the exemption — answer "yes, exempt."
- **HIPAA**: Apple/Google do not require a BAA from you, but you must have
  BAAs with Sentry, Stripe, Resend, and your hosting provider before listing.
- **Android**: target the latest Play requirements (targetSdk 34+, 16KB page
  size for native libs, declared permissions for camera/microphone/notifications).

### 3.6 Phase 1 Effort Estimate (relative)
| Workstream | Size |
|---|---|
| Capacitor init + iOS/Android projects + assets | S |
| Hash router + absolute API URL + CORS/CSP | S |
| Secure-storage swap + auth redirect refactor | M |
| Push notifications (FCM/APNs backend + plugin) | M |
| Biometric unlock | S |
| Camera/file picker integration | S |
| Tablet responsive pass (top 8 pages) | M–L |
| Screen-share on iOS (ReplayKit plugin) | M |
| Store listings + signing + TestFlight / internal track | M |

---

## 4. Phase 2 — React Native (True Native)

If/when you want a genuine native UI (native navigation transitions, native
lists, native charts, better offline, smaller bundle, no WebView quirks),
rewrite the frontend in React Native (Expo or bare RN).

### 4.1 What Can Be Reused
- **Business logic / services layer**: `services/*.ts` (axios calls), `store/`
  (zustand), types — all portable with minor storage swaps.
- **API contract**: unchanged; backend stays NestJS.
- **State patterns**: zustand stores + react-query caches port directly.

### 4.2 What Must Be Replaced
| Web lib | React Native replacement |
|---|---|
| `antd` | `react-native-paper` (Material) or `tamagui` / `gluestack-ui` |
| `@ant-design/icons` | `@expo/vector-icons` / `lucide-react-native` |
| `recharts` / `@ant-design/charts` | `victory-native` or `react-native-gifted-charts` |
| `react-router-dom` | `@react-navigation/native` (v7) |
| `simple-peer` | `react-native-webrtc` + `socket.io-client` |
| `@stripe/react-stripe-js` | `@stripe/stripe-react-native` (native PaymentSheet) |
| `window.crypto.subtle` | `react-native-quick-crypto` |
| `sessionStorage` | `expo-secure-store` / `react-native-keychain` |
| `window.location` redirects | `navigationRef.navigate(...)` |
| `FileInterceptor` uploads | `expo-document-picker` + `FormData` |
| `@sentry/react` | `@sentry/react-native` |
| `bcryptjs` / `jsonwebtoken` in frontend | Remove (already server-side; if used client-side, use `react-native-quick-bcrypt`) |

### 4.3 Tablet Layout with RN
- Use `react-navigation`'s `SplitNavigator` / `NativeStack` with a master-detail
  pattern for iPad and Android tablets (detect via `react-native-device-info`
  `isTablet()`).
- iPad: support multitasking (Slide Over / Split View) — declare
  `UIRequiresFullScreen = false` and handle size-class changes.
- Android tablets: large/xxlarge resource qualifiers + NavigationRail.

### 4.4 Phase 2 Effort
This is effectively a **frontend rewrite** (~30+ pages, 30+ services, custom
components). Plan for a dedicated mobile team and a parallel track alongside
the web app, sharing only the backend and the types/services layer.

---

## 5. Backend Changes Required (Both Phases)

| Change | Why |
|---|---|
| **Push notification provider** | Add FCM (Android) + APNs (iOS) to `notifications/providers/`. Currently only `ResendEmailProvider` + `MockEmailProvider` exist. Add a `PushProvider` interface + `FcmPushProvider` / `ApnsPushProvider` (or use `firebase-admin` for FCM and `apns2`/`@parse/node-apn` for APNs). Persist device tokens in a new `notification_device_token` entity (patientId/userId, platform, token). |
| **Device token registration endpoints** | `POST /api/v1/notifications/devices` (register), `DELETE /api/v1/notifications/devices/:token` (unregister). Wire into the existing `SubscriptionNotificationService` cron so trial/dunning/expiry alerts also push. |
| **CORS allow-list** | Add `capacitor://localhost`, `ionic://localhost`, `http://localhost` (Android), and your custom scheme to `CORS_ORIGINS`. |
| **CSP** | Update `helmet` `contentSecurityPolicy` to permit the native WebView origins for `connect-src`, `img-src`, `frame-src` (Stripe). |
| **Refresh-token rotation (recommended)** | Native apps are long-lived; consider refresh-token rotation so a stolen access token (15min) can't be replayed. Currently the app uses `sessionStorage` access tokens only. |
| **App-version header** | Add an `X-App-Version` header to the axios interceptor and a backend guard to force-update old native builds (helpful once you ship to stores). |
| **WebRTC TURN** | Already present (`coturn` in `docker-compose.yml`). No change, but document `VITE_TURN_SERVERS` for the native build config. |

---

## 6. HIPAA & Security Checklist for Native

- [ ] **No PHI at rest on device.** Keep the zustand "no-persist" rule. If
      offline support is added later, encrypt any cache with
      `expo-secure-store` / SQLCipher and document it in your risk analysis.
- [ ] **Secure token storage**: Keychain (iOS) / Keystore (Android) — never
      `AsyncStorage` (plain text) or `localStorage`.
- [ ] **Biometric gate**: require Face ID / fingerprint to unlock the app
      after backgrounding; re-prompt on session timeout.
- [ ] **Screenshot prevention** (optional, high-sensitivity screens): iOS
      `UITextField.isSecureTextEntry` trick or `windowProtected` flag; Android
      `FLAG_SECURE` on PHI screens.
- [ ] **Sentry scrubbing**: replicate the `beforeSend` PHI strip in
      `@sentry/react-native` config.
- [ ] **TLS pinning** (optional, recommended): pin the API cert in the native
      HTTP client to prevent MITM on hospital Wi-Fi.
- [ ] **BAA coverage**: confirm BAAs with Sentry, Stripe, Resend, FCM
      (Google), APNs (Apple), and your hosting provider before listing.
- [ ] **Auto-logout / session timeout**: port `SessionTimeoutProvider` to a
      native app-state listener (background → logout timer).
- [ ] **Jailbreak/root detection** (optional): `@capacitor-community/root-detection`
      or RN equivalent to warn/refuse on compromised devices.

---

## 7. Recommended Roadmap

### Step 0 — Interim: PWA (1–2 weeks)
- Add `vite-plugin-pwa`, a web manifest, and an offline shell for the
  marketing + login pages only (no PHI cached).
- Lets iPads "Add to Home Screen" today while native work proceeds.

### Step 1 — Capacitor v1 (4–8 weeks)
1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init Neuraline health.neuraline.app`
3. Switch to `createHashRouter`; set `VITE_API_URL` to absolute prod URL.
4. Swap `sessionStorage` → `@capacitor-community/secure-storage` in
   `services/api.ts`, `ProtectedRoute`, `PatientRoute`,
   `SessionTimeoutProvider`, `patientAuthService.ts`.
5. Add `@capacitor/push-notifications` + backend FCM/APNs provider.
6. Add `@capacitor-community/biometric-auth` for unlock.
7. Add `@capacitor/camera` + `@capacitor/filesystem` for uploads.
8. Tablet responsive pass on top 8 pages.
9. iOS ReplayKit plugin for screen share (or disable screen-share on iPad v1).
10. App Store / Play Store submission with TestFlight + internal testing track.

### Step 2 — React Native v2 (later, parallel track)
- Extract `services/` + `types/` + `store/` into a shared package.
- Build RN app with `@react-navigation/native`, `react-native-paper`,
  `react-native-webrtc`, `@stripe/stripe-react-native`, `expo-secure-store`.
- Ship as a separate app store listing or replace the Capacitor build.

---

## 8. Key Files to Modify First (Capacitor path)

| File | Change |
|---|---|
| `frontend/src/routes/index.tsx` | `createBrowserRouter` → `createHashRouter` |
| `frontend/src/services/api.ts` | Secure-storage token read; absolute `baseURL`; replace `window.location.href` redirects with a navigation ref |
| `frontend/src/components/security/ProtectedRoute.tsx` | Read token from secure storage |
| `frontend/src/components/security/PatientRoute.tsx` | Read patient token from secure storage |
| `frontend/src/components/security/SessionTimeoutProvider.tsx` | App-state-aware timeout + secure-storage clear |
| `frontend/src/services/patientAuthService.ts` | Secure-storage instead of `sessionStorage` |
| `frontend/src/main.tsx` | Initialize Capacitor plugins; native Sentry init |
| `frontend/index.html` | `viewport-fit=cover`, native meta tags |
| `frontend/vite.config.ts` | `base: './'` for relative asset paths inside the WebView |
| `backend/src/main.ts` | CORS + CSP allow native origins |
| `backend/src/modules/notifications/` | New `PushProvider` + device-token entity + registration endpoints |

---

## 9. Risks & Open Questions

1. **iOS WebRTC screen share** — WKWebView does not support `getDisplayMedia`.
   Decide: ship v1 without iPad screen share, or build a ReplayKit Capacitor
   plugin.
2. **Ant Design on tablets** — AntD is desktop-first; even inside Capacitor the
   dense tables (Billing, Remittance, Superbill) will need horizontal scroll or
   a card-based tablet redesign.
3. **Stripe Elements in WebView** — works, but Apple's guidelines prefer native
   PaymentSheet for digital goods. Since Neuraline bills **services (not
   digital goods)**, Stripe Elements in WebView is compliant, but
   `@stripe/stripe-react-native` PaymentSheet is a cleaner long-term UX.
4. **Offline** — currently none. Native users (clinicians on hospital Wi-Fi /
   rural tablets) will expect some offline capability. Recommend deferring to
   Phase 2 with an encrypted SQLCipher cache for read-only reference data
   (patient list, schedules) — never free-text PHI.
5. **App Store review for AI symptom checker** — Apple may classify the
   `assess-symptoms` patient-portal AI as "medical advice." Be prepared to
   frame it as decision-support / educational, not diagnostic, and add
   disclaimers.
6. **Push notification BAA** — Firebase Cloud Messaging is operated by Google;
   confirm your BAA covers it, or use APNs directly for iOS and a HIPAA-eligible
   push provider for Android.

---

## 10. TL;DR

- **Backend needs no rewrite.** Add a push-notification provider (FCM/APNs),
  device-token endpoints, and update CORS/CSP for native WebView origins.
- **Fastest path to iPad/Android tablets: wrap the existing React app in
  Capacitor.** Reuse 100% of the Ant Design UI; swap token storage to
  Keychain/Keystore, switch to hash routing, add biometric + push + camera
  plugins, and do a tablet-responsive pass on the top pages.
- **For a true native experience later: rewrite the frontend in React Native**,
  reusing the services/store/types layer and replacing `antd`, `simple-peer`,
  Stripe Elements, Web Crypto, and `react-router` with native equivalents.
- **HIPAA non-negotiables**: no PHI persisted on device, secure token storage,
  biometric gate, Sentry PHI scrubbing, session timeout on app background,
  BAAs with all third parties.
- **Biggest single technical risk**: iOS WebRTC screen share inside a WebView
  (needs a ReplayKit plugin or Phase 2 `react-native-webrtc`).
