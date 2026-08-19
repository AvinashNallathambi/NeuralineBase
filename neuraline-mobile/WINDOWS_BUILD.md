# Building neuraline-mobile on Windows (fast path)

## Why builds were taking 30+ minutes

Nothing in the JS code is slow. The time goes into the **native (C++/CMake) compile of
`react-native-reanimated`** — a few thousand translation units — and it kept starting
over from scratch:

1. **Long checkout path.** CMake encodes the full source path into every object file
   name and the NDK caps that at `CMAKE_OBJECT_PATH_MAX=250`. From
   `C:\Users\<you>\project\NeuralineBase\neuraline-mobile` the encoded paths exceed the
   cap, so reanimated's build fails part-way. Enabling Windows long paths does not
   help — the limit is CMake's, not the filesystem's.
2. **Cache-invalidating config flips.** `hermesEnabled`, `reactNativeArchitectures`
   and `buildStagingDirectory` are all inputs to the native build. Changing any of them
   throws away the CMake/Gradle output cache, so every attempt paid the full cost
   instead of an incremental one.
3. **Building unused ABIs.** Each ABI in `reactNativeArchitectures` is a separate full
   native compile. A physical phone only needs `arm64-v8a`.
4. **Rebuilding for JS changes.** With `debuggableVariants = []` the JS bundle is baked
   into the debug APK, so every JS edit required a Gradle build + reinstall.

The committed config now handles 2–4: `arm64-v8a` only, `hermesEnabled=true`,
`debuggableVariants = ["debug"]`, plus parallel builds and the Gradle build cache.

## One-time setup for #1 (long path)

Pick **one** of these. Option A is the simplest and the most reliable.

### Option A — move the checkout to a short path (recommended)

```powershell
git -C C:\Users\DELL\project\NeuralineBase status   # make sure nothing is uncommitted
Move-Item C:\Users\DELL\project\NeuralineBase C:\nb
cd C:\nb\neuraline-mobile
npm install                                          # restores any hand-edited node_modules
```

### Option B — keep the checkout, redirect CMake output

Uncomment `cxxStagingRoot` in `android/gradle.properties`:

```properties
cxxStagingRoot=C:\\cxx-rn
```

Then create the directory once with write access for your user:

```powershell
mkdir C:\cxx-rn
icacls C:\cxx-rn /grant "$env:USERNAME:(OI)(CI)F"
```

This applies to every module from `android/build.gradle`, so **do not edit
`node_modules/react-native-*/android/build.gradle`** — `npm install` wipes those edits
and the changed path invalidates the native cache again.

## Build and run

```powershell
cd C:\nb\neuraline-mobile
npx react-native start                 # leave Metro running in its own terminal
# in a second terminal:
adb devices                            # confirm the S25 Ultra is listed
npx react-native run-android           # first run: 20-40 min, later runs: 1-3 min
```

`adb reverse tcp:8081 tcp:8081` is run automatically by `run-android`; re-run it by
hand after unplugging the phone.

## Day-to-day

- **JS/TS change:** save the file — Fast Refresh handles it. No Gradle, no reinstall.
- **Native dependency added/removed:** `npx react-native run-android` again.
- **Do not** flip `hermesEnabled`, `reactNativeArchitectures`, `newArchEnabled` or
  `cxxStagingRoot` unless you mean to; each flip costs another full native rebuild.
- Exclude the checkout and `C:\cxx-rn` from Windows Defender real-time scanning — it
  meaningfully slows the tens of thousands of small file writes a native build makes.
- Never run `./gradlew clean` to "fix" things; it deletes exactly the native output you
  waited for.

## Emulator instead of a phone

Set `reactNativeArchitectures=x86_64` (or `arm64-v8a,x86_64` if you use both, at the
cost of a second native compile).
