#!/usr/bin/env node
/**
 * Generate native ios/ and android/ projects for neuraline-mobile.
 *
 * React Native CLI's `init` command creates a full project; we only need
 * the native folders. This script runs `init` in a temp directory, then
 * copies the ios/ and android/ folders into the current project.
 *
 * Usage:
 *   node scripts/generate-native-projects.js
 *
 * Requirements:
 *   - @react-native-community/cli installed globally or via npx
 *   - For ios/: macOS with Xcode + CocoaPods
 *   - For android/: Android SDK (ANDROID_HOME set)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '..', '.temp-init');
const PROJECT_DIR = path.join(__dirname, '..');
const RN_VERSION = '0.76.9';

console.log('=== Neuraline Mobile — Native Project Generator ===\n');

// Step 1: Clean up any previous temp dir
if (fs.existsSync(TEMP_DIR)) {
  console.log('1. Cleaning up previous temp directory...');
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

// Step 2: Generate a fresh RN project in temp dir
console.log(`2. Generating React Native ${RN_VERSION} project in temp dir...`);
try {
  execSync(
    `npx @react-native-community/cli@latest init NeuralineMobile --version ${RN_VERSION} --directory "${TEMP_DIR}" --skip-install --skip-git-init`,
    { stdio: 'inherit', cwd: PROJECT_DIR },
  );
} catch (err) {
  console.error('\nFailed to generate temp project. Error:', err.message);
  process.exit(1);
}

// Step 3: Copy native folders
const platforms = [
  { name: 'android', label: 'Android' },
  { name: 'ios', label: 'iOS' },
];

for (const { name, label } of platforms) {
  const src = path.join(TEMP_DIR, name);
  const dest = path.join(PROJECT_DIR, name);

  if (!fs.existsSync(src)) {
    console.log(`3. ${label}: source folder not found (skipping — expected if not on macOS for iOS)`);
    continue;
  }

  // Remove existing folder if present
  if (fs.existsSync(dest)) {
    console.log(`3. ${label}: removing existing ${name}/ folder...`);
    fs.rmSync(dest, { recursive: true, force: true });
  }

  console.log(`3. ${label}: copying ${name}/ folder...`);
  copyDirSync(src, dest);

  // Rename the app package from NeuralineMobile to match our app.json
  if (name === 'android') {
    updateAndroidPackageName(dest);
  }
}

// Step 4: Clean up temp dir
console.log('4. Cleaning up temp directory...');
fs.rmSync(TEMP_DIR, { recursive: true, force: true });

console.log('\n=== Done! ===');
console.log('\nNext steps:');
console.log('  Android: npx react-native run-android');
console.log('  iOS:     cd ios && pod install && cd .. && npx react-native run-ios');
console.log('\nMake sure ANDROID_HOME is set for Android, and you are on macOS for iOS.');

// ── Helpers ──────────────────────────────────────────────────────────────────

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function updateAndroidPackageName(androidDir) {
  // The generated project uses "com.neuralinemobile" — keep it as-is.
  // If you want a different package name, update it here.
  console.log('   (Android package name: com.neuralinemobile)');
}
