# Beatstar-Zero-Server

> **In-Process Standalone Offline Game Preservation for Beatstar (Android / ARM64)**

**Beatstar-Zero-Server** is an open-source, embedded runtime that enables Beatstar to run completely offline without external servers, PC hosting, or internet connectivity. 

The entire backend (Sharpla TCP protocol emulator, CMS, asset routing, event calendar, and player profiles) runs **inside the Android app process** via QuickJS and Frida dynamic instrumentation.

---

## Key Architecture Features

- **Zero-Server Architecture**: No Node.js server to run on PC, no local Wi-Fi proxies, and no DNS redirects. The server is embedded inside the mobile client itself.
- **In-Process Sharpla TCP Server**: Full emulation of the SpaceApe Sharpla Protobuf RPC protocol directly inside the game's memory space.
- **Anti-Softlock IL2CPP Hardening**: Custom patches for Unity `InteractionLocker`, coroutine locks, and bundle validation that prevent UI hangs and reward crashes.
- **Dynamic Perpetual Calendar**: Safe modular arithmetic cycling through seasons, Daily Shuffles, and live events indefinitely without clock-dependent freezes.
- **Zero Copyrighted Assets**: Strictly source code, hooks, and build pipeline tools. End users supply their own legally obtained base APK and cached music files.

---

## Prerequisites

1. **Operating System**: Windows 10/11 or Linux
2. **Python 3.9+** with `lief`:
   ```bash
   pip install lief
   ```
3. **Node.js 18+** (for compiling TypeScript hooks and server)
4. **Android SDK Build-Tools** (`zipalign` and `apksigner` available on PATH or in Android SDK)
5. **Base Game APK**: A clean, untouched ARM64 `Beatstar.apk` (e.g. version 32.x.x)
6. **Cached Song Assets**: Your own `UnityCache` directory extracted from your device (`/storage/emulated/0/Android/data/com.spaceapegames.beatstar/files/UnityCache`)

---

## Build Pipeline

### Step 1: Install Dependencies
```bash
cd tools/Beatstar-Script-Android
npm install
cd ../..
```

### Step 2: Provide Base APK & Assets
- Place your base APK into `input/Beatstar.apk`.
- Place your `UnityCache` and CMS assets into `assets_cache/`.

### Step 3: Run the All-in-One Builder
```bash
python build_offline.py
```
The script will:
1. Compile the TypeScript server into `file.js`.
2. Extract the open-source Frida gadget (`frida-gadget.so.xz`) and embed the bootstrap logic.
3. Patch the game's `libmain.so` ELF binary with `DT_NEEDED -> libfrida-gadget.so`.
4. Package the assets, zipalign, and sign with a debug key.
5. Output the ready-to-play APK in `dist/Beatstar-Offline-arm64.apk`.

### Step 4: Install to Device
```bash
adb install dist/Beatstar-Offline-arm64.apk
```

---

## Disclaimer & Legal

This repository contains **NO copyrighted game assets, audio tracks, or proprietary game binaries**. 
It is intended strictly for educational purposes, software interoperability analysis, and game preservation.
All original game assets, art, audio, and trademarks belong to Space Ape Games and their respective licensors.

See [CREDITS.md](CREDITS.md) for full community and tool attributions.
See [LICENSE](LICENSE) for terms of use (MIT).
