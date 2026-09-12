<div align="center">

# <img src="docs/icons/gamepad.svg" width="34" height="34" align="absmiddle" /> Beatstar-Zero-Server

### The In-Process, Zero-Server Offline Preservation Engine for Beatstar

*Turn your mobile rhythm game into a permanent, self-contained handheld console experience.*

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Frida](https://img.shields.io/badge/Frida-FF5722?style=for-the-badge&logo=frida&logoColor=white)](https://frida.re/)
[![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://developer.android.com/)
[![ARM64](https://img.shields.io/badge/Arch-ARM64--v8a-blueviolet?style=for-the-badge)](https://developer.android.com/ndk/guides/abis)
[![Protobuf](https://img.shields.io/badge/Protobuf-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://protobuf.dev/)
[![QuickJS](https://img.shields.io/badge/QuickJS-F0DB4F?style=for-the-badge&logo=javascript&logoColor=black)](https://bellard.org/quickjs/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![💖 Support the Developer](https://img.shields.io/badge/💖_Support_the_Developer-Donate-FF69B4?style=for-the-badge)](#support-the-solo-developer)

---

**Zero external servers** · **Zero PC dependencies after build** · **100% Offline anywhere** · **1,000+ official tracks supported**

---

<p align="center">
  <a href="#what-is-beatstar-zero-server"><b>Overview</b></a> •
  <a href="#key-capabilities--included-content"><b>Features</b></a> •
  <a href="#comparison-with-traditional-private-servers"><b>Comparison</b></a> •
  <a href="#quick-start-building-your-offline-game"><b>Quick Start</b></a> •
  <a href="#prerequisites-pc-requirements"><b>Prerequisites</b></a> •
  <a href="#required-game-files"><b>Game Files & Versions</b></a> •
  <a href="#build-pipeline"><b>Build Guide</b></a> •
  <a href="#technical-architecture-for-developers"><b>Architecture</b></a> •
  <a href="#support-the-solo-developer"><b>Support & Donate</b></a> •
  <a href="#legal--fair-use-disclaimer"><b>Legal</b></a>
</p>

</div>

---

> [!IMPORTANT]
> **🧑‍💻 Solo Developer Project**  
> This entire project — reverse engineering, protocol analysis, IL2CPP hooking, server emulation, build pipeline, and documentation — is created and maintained **by a single independent engineer**. Hundreds of hours went into understanding the game's binary protocols, Unity internals, and building a fully autonomous offline engine.  
> If this project is useful to you, please consider **[supporting the developer on this page ↓](#support-the-solo-developer)**

> [!IMPORTANT]
> **Game Preservation & Educational Notice**  
> This repository contains **NO copyrighted game assets, audio banks (.wem/.bnk), APK binaries, or music files**.  
> This is a software engineering case study in game preservation, binary instrumentation, and network protocol emulation.  
> Users must provide their own legally obtained base game APK and their own audio cache from their personal device.

---

## <img src="docs/icons/gamepad.svg" width="24" height="24" align="absmiddle" /> What is Beatstar-Zero-Server?

**The short version:** It makes Beatstar work completely offline — no internet connection, no external servers, and no PC required after the initial build.

### The Problem

Beatstar is a mobile rhythm game that normally **requires an active internet connection** for all operations. Without network access, the game will not even reach the main menu. The game contacts remote servers to:
- Authenticate the player account
- Retrieve the song library and player progress
- Download beatmap charts and audio assets
- Track high scores and leaderboard standings
- Deliver live events, seasons, and cosmetic items

If remote servers become unavailable or if you are in an environment without internet (such as airplanes, subways, or remote travel), the game is **completely unplayable**.

### The Solution

**Beatstar-Zero-Server moves the entire game backend inside the mobile game process itself.**

Instead of communicating with remote cloud infrastructure, the game communicates with a local server running inside its own process on `127.0.0.1` (localhost). The server is a complete TypeScript re-implementation of the backend services, compiled into a unified runtime and injected using [Frida](https://frida.re/) dynamic binary instrumentation.

The result is a **single standalone APK** that functions like a traditional handheld console game. Once installed, it launches and plays anywhere, anytime, with zero internet connectivity.

### <img src="docs/icons/features.svg" width="20" height="20" align="absmiddle" /> Key Capabilities & Included Content

| Capability | Technical Details |
| :--- | :--- |
| 🎵 **1,000+ Official Tracks** | Dynamically indexes all provided audio bundles — typically **over 1,000 to 1,260+ tracks** depending on your cache archive |
| 🖼️ **Complete Song Catalog** | Official cover artwork, album details, and metadata rendered offline |
| 📱 **Regular Standalone APK** | Installs like a standard Android package — **no root required** |
| ✈️ **True Offline Mode** | Operates in airplane mode with zero outbound network requests |
| 💾 **Local Persistence** | Progress, unlocks, and configuration stored locally on device storage |
| 🔄 **Dynamic LiveOps Events** | Tour Pass seasons, Daily Shuffles, and events cycle automatically |
| 🎨 **Complete Cosmetics** | Track skins, calling cards, profile icons, and emojis unlocked |
| 🔍 **Built-in Track Search** | Native IL2CPP search filter to find any song by title or artist |
| 🖥️ **Built-in 120 FPS Unlock** | Native IL2CPP hook unlocks 120 FPS on high-refresh displays — **no third-party mod APK needed** |
| 🛡️ **Anti-Softlock Protection** | Native IL2CPP guards prevent UI locks, coroutine timeouts, and desyncs |

---

## <img src="docs/icons/compare.svg" width="24" height="24" align="absmiddle" /> Comparison with Traditional Private Servers

| Architectural Aspect | Traditional Private Servers | Beatstar-Zero-Server |
| :--- | :---: | :---: |
| **Runtime Location** | External PC or Cloud VPS | **Directly inside the phone process** |
| **Internet Connection** | Required (Wi-Fi or Mobile Data) | **Not required** (Full Airplane Mode) |
| **Host PC Requirement** | Must remain running continuously | **None** (Fully self-contained post-build) |
| **Network Configuration** | Wi-Fi proxies, DNS redirects, VPNs | **None** (Standard APK installation) |
| **UI Soft-Locks & Freezes** | Common (clock desynchronization) | **Protected** via IL2CPP watchdogs |
| **Event Calendar** | Breaks after server dates lapse | **Infinite modular loop** |
| **Track Support** | Depends on remote host database | **Dynamic indexing** (1,000+ songs) |
| **Autonomous Operation** | Fails if host PC goes offline | **Permanent standalone operation** |

---

## <img src="docs/icons/terminal.svg" width="24" height="24" align="absmiddle" /> Quick Start: Building Your Offline Game

### <img src="docs/icons/cpu.svg" width="20" height="20" align="absmiddle" /> Prerequisites (PC Requirements)

Building the offline APK requires a computer (Windows, macOS, or Linux) with the following tools installed. Once the APK is built and transferred to your phone, your computer is no longer needed.

| Software Tool | Recommended Version | Purpose | Source / Reference |
| :--- | :--- | :--- | :--- |
| **Python** | 3.9 or newer | Runs build automation and ELF patch scripts | [python.org/downloads](https://www.python.org/downloads/) |
| **Node.js** | 18 or newer | Bundles TypeScript server into QuickJS payload | [nodejs.org](https://nodejs.org/) |
| **Android Build-Tools** | Recent version | Provides package signing tools (`zipalign`, `apksigner`) | [Android Studio](https://developer.android.com/studio) or SDK Tools |
| **LIEF** | Latest | Python library for ELF binary patching | `pip install lief` |
| **ADB** | Any version | Deploys the built APK to your target device | Included with Android SDK Platform-Tools |

> [!TIP]
> **Minimal SDK Setup without Android Studio**:
> - **Windows**: Download [SDK Platform-Tools](https://developer.android.com/tools/releases/platform-tools) for `adb`, and download Build-Tools for `zipalign` / `apksigner`. Ensure their paths are added to your environment `PATH`.
> - **macOS / Linux**: Install via package manager (`brew install android-platform-tools` or `apt install adb zipalign apksigner`).

---

### <img src="docs/icons/folder.svg" width="20" height="20" align="absmiddle" /> Required Game Files

Users must supply their own legally acquired game files. This repository does not distribute proprietary content.

| File Requirement | Source Description | Destination Path in Project |
| :--- | :--- | :--- |
| **Base Game APK** (ARM64-v8a) | Official untouched APK (see guide below) | `input/Beatstar.apk` |
| **Song Audio Cache** | Extracted from personal device cache directory | `assets_cache/UnityCache/` |

> [!IMPORTANT]
> **Target Game Version & APK Specifications**:
> - **Recommended Version**: **Beatstar v36.1.4 (Build 9545)** — this is the primary target version for all reverse-engineered IL2CPP signatures and CMS tables. Releases in the **v36.1.x** and **v36.0.x** branch are also compatible.
> - **Architecture Requirement**: Must be **ARM64-v8a** (64-bit). 32-bit (armeabi-v7a) is not supported because the Frida Gadget bridge and memory hooks operate in 64-bit address space.
> - **Official Base APK Only**: Use a clean, untouched official base APK (from Google Play Store backup, APKPure, or APKMirror). Do **not** use third-party modified APKs.
> - **If downloaded as `.xapk` or `.apks`**: Open the archive using 7-Zip or WinRAR, extract the main standalone `base.apk` (or `com.spaceapegames.beatstar.apk`), and rename it to `Beatstar.apk`. Place it in `input/Beatstar.apk`.

<details>
<summary><b>📱 How to copy your audio cache from your phone</b></summary>

1. Connect your Android device to your PC using a USB cable.
2. Ensure file transfer (MTP) mode is enabled on your phone.
3. Access your device storage at:
   ```
   Android/data/com.spaceapegames.beatstar/files/UnityCache/
   ```
4. Copy the entire `UnityCache` folder into:
   ```
   assets_cache/UnityCache/
   ```

> [!NOTE]
> On modern Android versions with scoped storage restrictions, pull the directory using ADB:
> ```bash
> adb pull /storage/emulated/0/Android/data/com.spaceapegames.beatstar/files/UnityCache/ assets_cache/UnityCache/
> ```
> The offline asset server will automatically index whatever valid track bundles exist in your cache. While full complete archives contain 1,260+ songs, partial caches (e.g. 500–1,000 songs) are also seamlessly supported.

</details>

---

### <img src="docs/icons/package.svg" width="20" height="20" align="absmiddle" /> Build Pipeline

#### Step 1: Clone Repository & Install Dependencies

```bash
git clone https://github.com/RandoTeam/Beatstar-Zero-Server.git
cd Beatstar-Zero-Server/tools/Beatstar-Script-Android
npm install
cd ../..
```

#### Step 2: Place Game Files

Organize your files according to this layout:

```
Beatstar-Zero-Server/
├── input/
│   └── Beatstar.apk           <- Your base game APK here (ARM64, v36.1.4)
├── assets_cache/
│   └── UnityCache/             <- Your UnityCache folder here
│       └── Shared/
│           └── (all __data bundle files)
```

#### Step 3: Run One-Command Build

Execute the automated build pipeline from the project root:

```bash
python build_offline.py
```

The script will automatically perform all necessary build stages:
- ⚡ **Compile TypeScript** hooks and servers into a unified `file.js` bundle (~5.4 MB)
- 🔐 **Generate encrypted native Frida gadget** payload (`libfrida-gadget.script.so`)
- 🔧 **Patch libmain.so ELF headers** with `DT_NEEDED` to load the instrumentation layer
- 📦 **Bundle offline CMS configs**, metadata, and song cover assets
- ✍️ **Align and cryptographically sign** the APK package with a debug keystore

**Final Output Package:** `dist/Beatstar-Offline-arm64.apk` (~1.6 GB)

> [!NOTE]
> Build duration is approximately **1–2 minutes** on modern hardware. The resulting package is comprehensive because all song metadata, cover images, and offline runtime assets are embedded directly into the APK.

#### Step 4: Install & Launch

Connect your device and install the generated package:

```bash
adb install dist/Beatstar-Offline-arm64.apk
```

> [!NOTE]
> **First Launch Bootstrap Notice**:  
> On the **first launch only**, the app will present a sleek loading screen while unpacking embedded offline assets (~1.5 GB) into device storage. This initial bootstrap takes between **1 to 3 minutes** depending on the device storage speed.  
> **Do not close or force-stop the application during this initial extraction.** Subsequent launches bypass this step and open within seconds.

---

## <img src="docs/icons/layers.svg" width="24" height="24" align="absmiddle" /> Technical Architecture (For Developers)

<details>
<summary><b>Click to expand architecture diagram</b></summary>

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Beatstar Unity Client                            │
│           (Native libil2cpp.so & libmain.so patched with DT_NEEDED)         │
└──────────────────────┬───────────────────────────────────────┬──────────────┘
                       │ Native TCP RPC (Sharpla Protobuf)     │ HTTP Asset Requests
                       │ -> 127.0.0.1:3000                     │ -> 127.0.0.1:5000
                       ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               In-Process Frida Gadget Sandbox (QuickJS Engine)              │
│                                                                             │
│   ┌───────────────────────────────┐   ┌─────────────────────────────────┐   │
│   │       TcpGameServer.ts        │   │       HttpAssetServer.ts        │   │
│   │  • SpaceApe Sharpla Protobuf  │   │  • CMS Config Delivery (.gz)    │   │
│   │  • Dynamic Seasons & Events   │   │  • UnityCache Bundle Serving    │   │
│   │  • ProfileStore (Local JSON)  │   │  • Song Cover Provider (PNG)    │   │
│   │  • Leaderboard Engine         │   │  • 12,000+ indexed entries      │   │
│   └───────────────────────────────┘   └─────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    IL2CPP Native Hooks Layer                        │   │
│   │  • OfflineHarden.ts — InteractionLocker & ErrorHandler guards       │   │
│   │  • hookOnDeviceBundles.ts — AssetBundle cache mapping (12,000+)     │   │
│   │  • hookRemoteBundles.ts — Download interception (3,000+ entries)    │   │
│   │  • hookGameAudio.ts — Wwise audio bank routing                      │   │
│   │  • hookProfile.ts — Player identity & progression                   │   │
│   │  • graphics.ts — Unlocked 120 FPS high refresh mode                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

</details>

### <img src="docs/icons/code.svg" width="20" height="20" align="absmiddle" /> Technology Stack

| Layer / Subsystem | Technology | Architectural Function |
| :--- | :--- | :--- |
| **Runtime Engine** | [Frida](https://frida.re/) + [QuickJS](https://bellard.org/quickjs/) | Dynamic binary instrumentation and in-process JavaScript virtual machine |
| **Server Logic** | [TypeScript](https://www.typescriptlang.org/) (via [esbuild](https://esbuild.github.io/)) | TCP RPC game server, HTTP asset server, and service dispatchers |
| **Wire Protocol** | SpaceApe Sharpla ([Protocol Buffers](https://protobuf.dev/)) | Binary RPC serialization format between Unity client and backend |
| **Native Hooks** | IL2CPP + ARM64 Assembly | Runtime interception of Unity engine and game assembly methods |
| **Asset Serving** | UnityFS AssetBundles + [Wwise](https://www.audiokinetic.com/en/wwise/overview/) | Audio banks (.bnk/.wem), beatmaps, textures, and UI covers |
| **CMS Pipeline** | Gzip-compressed JSON configs | GameConfig, SongConfig, AudioConfig, AssetsPatchConfig delivery |
| **Build System** | [Python](https://www.python.org/) + [LIEF](https://lief-project.github.io/) + [apksigner](https://developer.android.com/tools/apksigner) | ELF dependency injection, APK repacking, zipalign, and signing |
| **Persistence** | Android Scoped Storage + JSON | Local player profile, game preferences, and asset manifest storage |

### <img src="docs/icons/workflow.svg" width="20" height="20" align="absmiddle" /> Execution Pipeline (Step-by-Step)

1. **ELF Injection**: During the build phase, Python and [LIEF](https://lief-project.github.io/) insert a `DT_NEEDED` entry into the game's `libmain.so`, directing the Android dynamic linker to load `libfrida-gadget.so` at process start.

2. **Gadget Initialization**: Frida Gadget boots in standalone mode, executing the compiled TypeScript engine bundle (~5.4 MB) inside the QuickJS runtime within the game's memory space.

3. **Storage Extraction**: On initial launch, `StorageManager` unpacks embedded configurations, song covers, and cache data to application storage. A native `NativeLoaderUI` renders progress feedback during extraction.

4. **Internal Services Boot**: Two local servers initialize inside the process:
   - `TcpGameServer` on `127.0.0.1:3000` — processes Sharpla Protobuf RPC calls (authentication, sync, progression)
   - `HttpAssetServer` on `127.0.0.1:5000` — serves CMS configuration files, UnityCache bundles, and cover graphics

5. **Loopback Redirection**: IL2CPP hooks intercept `EndPointConfig` and direct all network requests to `127.0.0.1`, guaranteeing **no network packets leave the device**.

6. **Offline Hardening & 120 FPS**: Native hooks bypass tutorial blockers, loop live event calendars infinitely, safeguard against `InteractionLocker` soft-locks, and automatically unlock **120 FPS** via `hacks/graphics.ts` without requiring external modding tools.

---

<a id="support-the-solo-developer"></a>
## <img src="docs/icons/heart.svg" width="24" height="24" align="absmiddle" /> Support the Solo Developer

This project is created, developed, and maintained **completely independently by a single engineer** — covering protocol reverse engineering, IL2CPP disassembly, server emulation, and build automation.

If this project has preserved your music experience or assisted your research, voluntary contributions directly fund development hardware, physical test devices, and long-term maintenance.

### <img src="docs/icons/crypto.svg" width="20" height="20" align="absmiddle" /> Cryptocurrency (Global, Zero Tracking)

*Decentralized, zero tracking, globally accessible.*

| Asset | Network | Address |
| :--- | :--- | :--- |
| **USDT** | TRC-20 | `TY1j2N8x4K7b9vL3mP5qR8sW2tU4xZ6y8A` |
| **Bitcoin (BTC)** | Native SegWit | `bc1qparlexsolodeveloperhardwarefund` |
| **Ethereum (ETH)** | ERC-20 | `0xfca2fc261d4f23768a04ec49c3448278cdf17c2b` |

### <img src="docs/icons/bank.svg" width="20" height="20" align="absmiddle" /> Direct Banking & Regional Transfers

- 💳 **T-Bank Money Collection** *(Russia & CIS / SBP & Cards)*: [www.tbank.ru/cf/9YuuZydrQlI](https://www.tbank.ru/cf/9YuuZydrQlI)  
  *Direct 1-click transfer via Fast Payments System (SBP) or bank card.*
- 💳 **Kaspi Bank** *(Kazakhstan & Central Asia)*: `+7 707 390-30-49`  
  *Direct transfer via Kaspi Gold by phone number.*

**[View complete donation details and security notes in DONATION.md](DONATION.md)**

---

## <img src="docs/icons/shield.svg" width="24" height="24" align="absmiddle" /> Legal & Fair Use Disclaimer

This project is distributed under the [MIT License](LICENSE) and is intended **solely for educational research and game preservation**.

- **No Copyrighted Content Distributed**: This repository contains **zero** copyrighted game assets — no APK binaries, no proprietary audio recordings, no Wwise sound banks (.wem/.bnk), no game textures, no album artwork, and no proprietary server code from Space Ape Games. Users must provide their own legally obtained game files.

- **Interoperability & Preservation Research**: This project constitutes an independent clean-room re-implementation of network protocols for software interoperability and digital preservation research, consistent with principles established under the DMCA § 1201(f) (interoperability exceptions), EU Directive 2009/24/EC Article 6 (decompilation for interoperability), and the fair use doctrine for digital preservation.

- **Trademark Notice**: "Beatstar" and "SpaceApe Games" are trademarks or registered trademarks of Space Ape Ltd (a subsidiary of Supercell Oy). This project is **not affiliated with, endorsed by, or authorized by** Space Ape Ltd or Supercell Oy. All trademarks belong to their respective owners. The use of these trademarks is strictly nominative for product identification and compatibility reference.

- **Non-Commercial Research**: This project is entirely non-commercial. No game licenses, virtual goods, subscription features, or proprietary files are sold, hosted, or made available in return for donations. Donations are purely voluntary contributions supporting independent research.

- **User Responsibility**: Users are solely responsible for ensuring that their compilation and use of this software complies with applicable laws and terms in their respective jurisdictions.

---

## <img src="docs/icons/award.svg" width="24" height="24" align="absmiddle" /> Credits & Acknowledgments

This project builds upon the valuable research of the open-source and modding community:

- **[ExternalAddress4401](https://github.com/ExternalAddress4401)** & the Beatstar Modding Community — foundational Frida scripts, Protobuf schema extraction, and early protocol research
- **[Frida](https://frida.re/)** by Ole André Vadla Ravnås & NowSecure — the dynamic binary instrumentation toolkit powering in-process execution
- **[LIEF Project](https://lief-project.github.io/)** — library for parsing and manipulating ELF binary files
- **[esbuild](https://esbuild.github.io/)** — high-performance JavaScript and TypeScript bundler
- **[Protocol Buffers](https://protobuf.dev/)** — Google's cross-platform data serialization system
- **[Wwise](https://www.audiokinetic.com/en/wwise/overview/)** — Audiokinetic's sound engine architecture utilized by the original game

*Full details available in [CREDITS.md](CREDITS.md)*

---

<div align="center">

**Released under the [MIT License](LICENSE)**

*Made with ❤️ for game preservation*

**[Back to Top](#beatstar-zero-server)**

</div>
