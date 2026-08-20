#!/usr/bin/env bash
set -euo pipefail

echo "=== Neuraline Mobile — Codespaces Setup ==="

# Resolve the workspace root (Codespaces mounts the repo at /workspaces/<repo-name>)
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo ">>> Workspace root: ${WORKSPACE_ROOT}"

# --- JDK 17 (Temurin) — installed manually because the devcontainers java
#     feature relies on SDKMAN, which intermittently fails to resolve "17" ---
JDK_HOME="/usr/lib/jvm/temurin-17-jdk"
echo ">>> Installing Temurin JDK 17 to ${JDK_HOME}..."

if [ ! -x "${JDK_HOME}/bin/java" ]; then
  mkdir -p /usr/lib/jvm
  # Adoptium Temurin 17 (x64 Linux). Update URL if a newer patch is needed.
  JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz"
  curl -fsSL -o /tmp/jdk17.tar.gz "${JDK_URL}"
  tar -xzf /tmp/jdk17.tar.gz -C /usr/lib/jvm
  # The extracted folder is named like jdk-17.0.13+11 — normalize it.
  mv /usr/lib/jvm/jdk-17.* "${JDK_HOME}"
  rm -f /tmp/jdk17.tar.gz
fi

export JAVA_HOME="${JDK_HOME}"
export PATH="${JDK_HOME}/bin:${PATH}"

# Verify Java installed
java -version

# --- Android SDK (installed manually; the devcontainers-contrib/android-sdk
#     feature registry was deprecated and no longer pullable from Codespaces) ---
ANDROID_HOME="${ANDROID_HOME:-/usr/lib/android-sdk}"
echo ">>> Installing Android cmdline-tools + SDK to ${ANDROID_HOME}..."

CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
CMDLINE_TOOLS_ZIP="/tmp/cmdline-tools.zip"

if [ ! -x "${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager" ]; then
  mkdir -p "${ANDROID_HOME}/cmdline-tools"
  curl -fsSL -o "${CMDLINE_TOOLS_ZIP}" "${CMDLINE_TOOLS_URL}"
  unzip -q "${CMDLINE_TOOLS_ZIP}" -d /tmp/cmdline-tools-extract
  # sdkmanager expects the layout: $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager
  mv /tmp/cmdline-tools-extract/cmdline-tools "${ANDROID_HOME}/cmdline-tools/latest"
  rm -rf /tmp/cmdline-tools-extract "${CMDLINE_TOOLS_ZIP}"
fi

export ANDROID_HOME
export ANDROID_SDK_ROOT="${ANDROID_HOME}"
export PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

# Accept Android SDK licenses
echo ">>> Accepting Android SDK licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true

# Install required SDK packages
echo ">>> Installing SDK platforms, build-tools, NDK, cmake..."
sdkmanager --install \
  "platform-tools" \
  "platforms;android-35" \
  "build-tools;35.0.0" \
  "ndk;26.1.10909125" \
  "cmake;3.22.1" > /dev/null 2>&1 || true

# Set NDK env vars (used by React Native gradle build)
export ANDROID_NDK_HOME="${ANDROID_HOME}/ndk/26.1.10909125"
export ANDROID_NDK_ROOT="${ANDROID_NDK_HOME}"

# Persist Android + Java env for interactive shells (profile.d is sourced by login shells)
echo ">>> Writing Android + Java env profile for interactive shells..."
cat > /etc/profile.d/android-sdk.sh << 'PROFILEEOF'
export JAVA_HOME="/usr/lib/jvm/temurin-17-jdk"
export ANDROID_HOME="/usr/lib/android-sdk"
export ANDROID_SDK_ROOT="/usr/lib/android-sdk"
export ANDROID_NDK_HOME="/usr/lib/android-sdk/ndk/26.1.10909125"
export ANDROID_NDK_ROOT="/usr/lib/android-sdk/ndk/26.1.10909125"
export PATH="${JAVA_HOME}/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"
PROFILEEOF

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
