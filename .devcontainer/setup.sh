#!/usr/bin/env bash
set -euo pipefail

echo "=== Neuraline Mobile — Codespaces Setup ==="

# Accept Android SDK licenses
echo ">>> Accepting Android SDK licenses..."
yes | "${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null 2>&1 || true

# Resolve the workspace root (Codespaces mounts the repo at /workspaces/<repo-name>)
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo ">>> Workspace root: ${WORKSPACE_ROOT}"

# Install shared package (the mobile app depends on @neuraline/shared via file:../shared)
echo ">>> Installing shared package..."
cd "${WORKSPACE_ROOT}/shared"
npm install --legacy-peer-deps 2>/dev/null || true
npm run build 2>/dev/null || true

# Install mobile app dependencies
echo ">>> Installing mobile app dependencies..."
cd "${WORKSPACE_ROOT}/neuraline-mobile"
npm install --legacy-peer-deps

# Create .env for cloud build (API URL will be overridden at runtime)
echo ">>> Creating .env..."
cat > .env << 'ENVEOF'
# Cloud build env — API_URL is set at runtime via Metro or replaced in APK
API_URL=http://10.0.2.2:4000/api/v1
APP_VERSION=1.0.0
SENTRY_DSN=
TURN_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"stun:stun1.l.google.com:19302"}]
STRIPE_PUBLISHABLE_KEY=
ENVEOF

# Pre-download Gradle wrapper (saves time on first build)
echo ">>> Pre-downloading Gradle distribution..."
cd "${WORKSPACE_ROOT}/neuraline-mobile/android"
chmod +x gradlew
./gradlew --version > /dev/null 2>&1 || true

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To build the APK:"
echo "  cd ${WORKSPACE_ROOT}/neuraline-mobile"
echo "  npm run build:apk"
echo ""
echo "The APK will be at:"
echo "  ${WORKSPACE_ROOT}/neuraline-mobile/android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "Download it via the Codespaces file explorer or run:"
echo "  codespaces:download android/app/build/outputs/apk/debug/app-debug.apk"
