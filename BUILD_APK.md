# How to Build SmartClinic APK

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | https://nodejs.org |
| pnpm | 10+ | `npm install -g pnpm` |
| Java JDK | 17 | https://adoptium.net |
| Android Studio | Latest | https://developer.android.com/studio |
| Android SDK | API 34 | Install via Android Studio SDK Manager |

> **Windows users:** Make sure `JAVA_HOME` and `ANDROID_HOME` environment variables are set after installing JDK and Android Studio.

---

## Environment Variables

Set these before building:

```env
# Required for APK to reach your backend
VITE_API_URL=https://your-production-api-url.com

# Optional (filled automatically from .env.mobile)
VITE_BUILD_TARGET=mobile
VITE_APP_NAME=SmartClinic
```

For local testing on the same WiFi network, use your machine's LAN IP:
```env
VITE_API_URL=http://192.168.1.10:8080
```
Find your LAN IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux).

---

## Build Steps

### Step 1 — Install dependencies
```bash
pnpm install
```

### Step 2 — Build the mobile web bundle
```bash
pnpm run build:mobile
```
This builds the React app with `VITE_BUILD_TARGET=mobile` (admin portal hidden).

### Step 3 — Sync to Android
```bash
npx cap sync android
```
This copies `dist/spa` into the Android project and updates native plugins.

### Step 4 — Open in Android Studio
```bash
npx cap open android
```

### Step 5 — Build APK in Android Studio
1. Wait for **Gradle sync** to complete (progress bar at the bottom)
2. Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Wait for build to complete (~1–3 minutes)
4. Click **"locate"** in the success notification balloon
5. APK path: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 6 — Install on your Android phone

**Option A: USB cable**
```bash
# Enable USB Debugging on your phone: Settings → Developer Options → USB Debugging
npx cap run android
```

**Option B: Send file to phone**
- WhatsApp: send APK to yourself → tap to install
- Google Drive: upload → download on phone → tap to install
- USB cable → copy APK to phone storage → open with file manager

**Option C: ADB install**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

> **Enable Unknown Sources** on your phone before installing:
> Settings → Security → Install Unknown Apps → (your file manager) → Allow

---

## Production Signed APK (for official distribution)

1. Android Studio → **Build → Generate Signed Bundle/APK**
2. Choose **APK** → Next
3. Click **Create new...** to create a keystore file
   - ⚠️ **Keep the keystore file safe** — you need it for ALL future updates
   - Store the keystore password somewhere secure
4. Fill in key details → Next
5. Choose **release** build variant → Finish
6. APK at: `android/app/build/outputs/apk/release/app-release.apk`

---

## Quick Test WITHOUT Building APK (same WiFi)

The fastest way to test on your phone:

```bash
# 1. Start the dev server exposed on LAN
pnpm run dev:network

# 2. The terminal will show:
#    Local:   http://localhost:8080
#    Network: http://192.168.x.x:8080  ← open THIS on your phone

# 3. On your phone (same WiFi network), open the Network URL in Chrome
```

This works instantly — no APK needed. Great for UI testing.

---

## One-Command Build Script

```bash
# Build APK from scratch (run in project root):
pnpm run android:build
# Then open Android Studio:
pnpm run android:open
# Build → Build APK(s) in Android Studio
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `JAVA_HOME not set` | Install JDK 17, set `JAVA_HOME` env var |
| `SDK location not found` | Open Android Studio → SDK Manager → note SDK path → set `ANDROID_HOME` |
| Gradle sync fails | File → Invalidate Caches → Restart |
| App can't reach backend | Make sure `VITE_API_URL` points to reachable server from phone |
| White screen in APK | Run `pnpm run build:mobile` and `npx cap sync` before opening Android Studio |
| CORS error | Add your phone's IP or `*` to `CORS_ORIGINS` in `.env` |

---

## App Structure

```
Mobile build shows:          Web build shows:
─────────────────────        ─────────────────────────
✅ Doctor portal             ✅ Doctor portal
✅ Receptionist portal       ✅ Receptionist portal
❌ Admin portal (hidden)     ✅ Clinic admin portal
                             ✅ Super admin portal
```
