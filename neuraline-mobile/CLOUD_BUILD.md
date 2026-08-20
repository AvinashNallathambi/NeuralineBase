# Cloud Build Guide — Neuraline Mobile

## Overview

Build Android APKs in the cloud (GitHub Codespaces or GitHub Actions) instead of on your laptop.
Your laptop (2 cores, 8 GB RAM) is too slow for local native builds. Cloud builds use 4-16 cores
and 16-32 GB RAM, cutting build times from 15+ minutes to 2-5 minutes.

## Option 1: GitHub Codespaces (Interactive)

Best for: Active development — edit code, build, and iterate in the cloud.

### Setup (one-time)

1. Go to https://github.com/codespaces
2. Click "New codespace"
3. Select the `NeuralineBase` repository
4. Branch: `main`
5. The `.devcontainer/devcontainer.json` will auto-configure:
   - Node 18, Java 17, Android SDK 35, NDK 26.1, CMake 3.22.1
   - 4 cores, 16 GB RAM, 64 GB storage
6. Wait for setup to complete (~5 min first time, ~1 min after)

### Build the APK

```bash
cd /workspace/neuraline-mobile
npm run build:apk
```

Build time: **2-5 minutes** (vs 15+ min on your laptop)

### Get the APK onto your phone

1. In the Codespaces file explorer, navigate to:
   ```
   neuraline-mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```
2. Right-click → "Download"
3. Save to your laptop

4. On your laptop, install it on the S25 Ultra:
   ```powershell
   $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $adb install -r app-debug.apk
   ```

### Edit code in the cloud

- Use VS Code in the browser, or connect locally with:
  ```powershell
  gh codespace code
  ```
- All edits sync to the cloud Codespace
- Push changes to save to git

### Free tier limits

- **60 hours/month free** (Pro account: 120 hours)
- A 4-core machine uses 4 core-hours per hour of use
- So 60 hours = ~15 full build sessions per month
- After that: $0.18/hour (4-core)

---

## Option 2: GitHub Actions (Automated)

Best for: Build APK on every push, no interactive editing needed.

### How it works

1. Push code to `main` (or trigger manually)
2. GitHub Actions builds the APK on a 2-core cloud runner
3. APK is uploaded as a downloadable artifact
4. You download it from the Actions tab

### Trigger a build

**Automatic**: Push to `main` with changes in `neuraline-mobile/` or `shared/`

**Manual**:
1. Go to https://github.com/AvinashNallathambi/NeuralineBase/actions
2. Select "Build Android APK" workflow
3. Click "Run workflow"

### Download the APK

1. Go to https://github.com/AvinashNallathambi/NeuralineBase/actions
2. Click the latest "Build Android APK" run
3. Scroll down to "Artifacts"
4. Download `neuraline-debug-apk`
5. Unzip it
6. Install on your phone:
   ```powershell
   $adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
   & $adb install -r app-debug.apk
   ```

### Free tier limits

- **2,000 minutes/month free** for public repos
- **3,000 minutes/month free** for private repos (Pro account)
- Each build uses ~5-10 minutes
- So ~200-400 builds per month (plenty)

---

## Daily Workflow (Recommended)

### For JS/TS code changes (fast, do locally)

You don't need the cloud for JS-only changes. Metro hot-reload is already fast:

1. Keep Metro running locally:
   ```powershell
   cd neuraline-mobile
   npm start
   ```
2. Edit files in your local editor
3. Metro hot-reloads to the phone in **2-5 seconds**
4. No build needed — just save the file

### For native code changes (slow, use cloud)

When you change anything in `android/`, add/remove native dependencies, or change
`gradle.properties` / `build.gradle`:

1. Push to `main`:
   ```powershell
   git add -A
   git commit -m "change: updated native deps"
   git push
   ```
2. GitHub Actions auto-builds the APK (or trigger manually)
3. Download the APK from Actions artifacts
4. Install on your phone:
   ```powershell
   & $adb install -r app-debug.apk
   ```
5. Continue with local Metro for JS changes

### For interactive cloud development (Codespaces)

When you want a full cloud dev environment:

1. Create a Codespace from the repo
2. Edit code in the browser or via `gh codespace code`
3. Build with `npm run build:apk`
4. Download APK and install on phone

---

## API URL Configuration

The cloud-built APK uses `http://localhost:4000/api/v1` as the default API URL.
After installing on your phone, override it:

**Method 1 — adb reverse (USB/Wi-Fi ADB):**
```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb reverse tcp:4000 tcp:4000
```
This makes the phone's `localhost:4000` forward to your laptop's `localhost:4000`.

**Method 2 — Edit .env before building:**
In the Codespace, edit `neuraline-mobile/.env`:
```
API_URL=http://192.168.29.59:4000/api/v1
```
Then build. The APK will hardcode your LAN IP.

---

## Cost Comparison

| Approach | Build time | Cost/month | Setup |
|---|---|---|---|
| Local (current) | 15+ min | $0 | Done |
| GitHub Actions | 5-10 min | $0 (free tier) | Done |
| GitHub Codespaces | 2-5 min | $0 (60 hrs free) | Done |
| Upgrade RAM to 16 GB | 5-8 min | $35 one-time | Buy + install |
