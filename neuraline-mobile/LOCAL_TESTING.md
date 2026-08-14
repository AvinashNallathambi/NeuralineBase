# Local Testing Guide — Neuraline Mobile

## Prerequisites Checklist

| Requirement | Status on your machine | How to install |
|---|---|---|
| Node.js 18+ | Installed (v24.14.0) | — |
| npm | Installed (11.9.0) | — |
| Java 17+ | Installed (v19) | — |
| Android Studio + SDK | **Not installed** | https://developer.android.com/studio |
| ANDROID_HOME env var | **Not set** | See Step 2 below |
| Android tablet emulator | **Not created** | See Step 3 below |
| Physical Android device | Optional | See Option 2 below |
| macOS + Xcode (for iOS) | **Not available** | iOS testing requires a Mac |

---

## Step 1 — Install Android Studio

1. Download from https://developer.android.com/studio
2. Run the installer (default options are fine)
3. On first launch, Android Studio will download:
   - Android SDK Platform (API 34 / Android 14)
   - Android SDK Build-Tools 34.x
   - Android SDK Platform-Tools (includes `adb`)
   - Android Emulator

This installs to: `C:\Users\DELL\AppData\Local\Android\Sdk`

## Step 2 — Set environment variables

Open **PowerShell as Administrator** and run:

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\DELL\AppData\Local\Android\Sdk", "User")
[System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "C:\Users\DELL\AppData\Local\Android\Sdk", "User")

# Add platform-tools to PATH (for adb)
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
[System.Environment]::SetEnvironmentVariable("Path", "$currentPath;C:\Users\DELL\AppData\Local\Android\Sdk\platform-tools", "User")
```

**Close and reopen your terminal** after setting these.

Verify:
```powershell
adb version          # should print "Android Debug Bridge version ..."
echo $env:ANDROID_HOME   # should print the SDK path
```

## Step 3 — Create a tablet emulator

1. Open **Android Studio**
2. Click **Device Manager** (phone icon on the right sidebar)
3. Click **Create Device** (+ button)
4. Select **Tablet** category → pick a tablet (e.g. "Pixel Tablet" or 10.1" WSVGA)
5. Click **Next** → download **API 34** (Android 14) if not already downloaded
6. Click **Next** → name it "NeuralineTablet" → **Finish**

## Step 4 — Generate the native Android project

The `android/` folder doesn't exist yet. Generate it:

```powershell
cd C:\Users\DELL\project\NeuralineBase\neuraline-mobile
npm run generate:native
```

This runs `npx @react-native-community/cli init` in a temp directory and copies
the `android/` (and `ios/` if on macOS) folder into your project.

## Step 5 — Start the Metro bundler

```powershell
cd C:\Users\DELL\project\NeuralineBase\neuraline-mobile
npm start
```

Keep this terminal open. Metro bundles your JS/TS code and serves it to the
emulator/device. It hot-reloads on file changes.

## Step 6 — Launch the app on the Android tablet emulator

Open a **second terminal**:

```powershell
cd C:\Users\DELL\project\NeuralineBase\neuraline-mobile

# Start the emulator first (from Android Studio Device Manager, or):
# (Find your emulator name)
emulator -list-avds

# Start the emulator
emulator -avd NeuralineTablet

# Once the emulator is booted, build and install the app:
npx react-native run-android
```

The first build takes 5–10 minutes (Gradle downloads dependencies).
Subsequent builds are much faster (~30 seconds).

## Step 7 — Configure the API URL

The app needs to connect to your NestJS backend. By default it tries
`http://localhost:4000/api/v1`. The Android emulator's `localhost` is the
emulator itself, not your host machine. Use the special alias:

**Option A — Quick fix (edit the source):**

Edit `neuraline-mobile/src/services/api.ts`:
```typescript
// Change this line:
const API_BASE_URL = (process.env as any).API_URL || 'http://localhost:4000/api/v1';
// To:
const API_BASE_URL = (process.env as any).API_URL || 'http://10.0.2.2:4000/api/v1';
```

`10.0.2.2` is the Android emulator's alias for your host machine's `localhost`.

**Option B — Use react-native-config (proper way):**

```powershell
cd neuraline-mobile
npm install react-native-config
```

Then create `.env`:
```
API_URL=http://10.0.2.2:4000/api/v1
```

## Step 8 — Start your NestJS backend

The mobile app needs the backend running:

```powershell
cd C:\Users\DELL\project\NeuralineBase\backend
# Make sure .env is configured with DB credentials
npx nest start
```

The backend should be running on `http://localhost:4000` (which the emulator
reaches via `http://10.0.2.2:4000`).

---

## Option 2 — Test on a physical Android device

If you have an Android tablet or phone:

1. **Enable Developer Options**: Settings → About → tap "Build Number" 7 times
2. **Enable USB Debugging**: Settings → Developer Options → USB Debugging = ON
3. **Connect via USB** to your computer
4. **Verify connection**:
   ```powershell
   adb devices
   # Should show your device (not "unauthorized")
   ```
5. **Run the app**:
   ```powershell
   cd neuraline-mobile
   npx react-native run-android
   ```
6. **API URL**: use your computer's LAN IP instead of `10.0.2.2`:
   ```
   API_URL=http://192.168.1.100:4000/api/v1
   ```
   (Find your IP with `ipconfig` in PowerShell — look for "IPv4 Address")

---

## Option 3 — Test on a physical iOS device (requires a Mac)

You cannot build iOS apps on Windows. Options:

1. **Borrow/rent a Mac** — install Xcode, run `npx react-native run-ios`
2. **Use a cloud Mac** — services like MacStadium, MacinCloud, or AWS EC2 Mac
   instances let you rent a Mac by the hour
3. **Use EAS Build** (Expo's cloud build service) — if you migrate to Expo,
   EAS can build the iOS app in the cloud without a Mac

---

## Common Issues

### "adb: command not found"
→ ANDROID_HOME not set or terminal not restarted. See Step 2.

### "Failed to install the app. Please accept the licenses"
→ Run:
```powershell
cd $env:ANDROID_HOME\tools\bin
.\sdkmanager --licenses
```
Accept all licenses.

### "Unable to load script. Make sure you're running Metro"
→ Metro is not running. Open a separate terminal and run `npm start` first.

### "Network request failed" / API calls error
→ The emulator can't reach the backend. Make sure:
  - Backend is running on your machine (`npx nest start`)
  - API URL uses `10.0.2.2:4000` (emulator) or your LAN IP (physical device)
  - Backend CORS allows the request (check `CORS_ORIGINS` in backend `.env`)

### Gradle build is very slow (first time)
→ Normal. Gradle downloads ~500MB of dependencies on first build.
Subsequent builds use the cache and are much faster.

### "No connected devices found"
→ Start the emulator from Android Studio Device Manager first, or connect
a physical device with USB debugging enabled.

---

## Quick Reference — Daily Workflow

Once everything is set up, your daily workflow is:

```powershell
# Terminal 1 — Backend
cd backend
npx nest start

# Terminal 2 — Metro bundler
cd neuraline-mobile
npm start

# Terminal 3 — Build & launch (only needed once, or after native changes)
cd neuraline-mobile
npx react-native run-android

# Make code changes → Metro hot-reloads automatically
# Type check:
npm run typecheck
```
