<div align="center">

# 🎵 Beatstar-Zero-Server

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

[![💖 Support the Developer](https://img.shields.io/badge/💖_Support_the_Developer-Donate-FF69B4?style=for-the-badge)](DONATION.md)

---

**Zero external servers** · **Zero PC dependencies** · **100% Offline anywhere** · **1,262 official tracks**

</div>

---

> [!IMPORTANT]
> **🧑‍💻 Solo Developer Project**  
> This entire project — reverse engineering, protocol analysis, IL2CPP hooking, server emulation, build pipeline, and documentation — is created and maintained **by a single independent engineer**. If this project is useful to you, please consider [supporting the development →](DONATION.md)

> [!IMPORTANT]
> **Game Preservation & Educational Notice**  
> This repository contains **NO copyrighted game assets, audio banks (.wem/.bnk), or APK binaries**.  
> This is a software engineering case study in game preservation, binary instrumentation, and network protocol emulation. Users must provide their own legally obtained base game APK and audio cache.

---

## 🎮 What is this? (For Everyone)

Have you ever tried playing Beatstar on an airplane, in a subway, or somewhere with no internet? The game just... doesn't work. That's because Beatstar relies on remote servers for **everything** — logging you in, loading your songs, tracking your progress, even showing you the main menu.

**Beatstar-Zero-Server fixes this permanently.**

It takes the game and makes it completely self-contained — like a classic console game cartridge. No internet, no servers, no Wi-Fi needed. Just install the app and play. Your entire music library of **1,262 official tracks** with full audio, beatmaps, covers, and progression — all working offline, forever.

### ✨ What You Get

- 🎵 **All 1,262 official tracks** with full Wwise audio and beatmap charts
- 🖼️ **All song covers and album art** displayed in the catalog
- 📱 **Regular standalone APK** — install like any normal app, no root needed
- ✈️ **True airplane mode** — works with zero network connectivity
- 💾 **Local save files** — your progress saves directly to your phone
- 🔄 **Dynamic events** — seasons, daily shuffles, and live ops cycle infinitely
- 🎨 **Track skins & customization** — all cosmetic content preserved
- 🔍 **Built-in search** — find any song instantly by name or artist
- 🖥️ **120 FPS support** — unlocked frame rate on supported devices

---

## 🆚 How is this Different?

| Feature | Traditional Private Servers | Beatstar-Zero-Server |
| :--- | :---: | :---: |
| **Where it runs** | External PC or Cloud VPS | **Inside the phone itself** |
| **Internet needed?** | Yes (Wi-Fi or Mobile Data) | **No** (Airplane Mode ✅) |
| **Setup complexity** | Wi-Fi Proxies, DNS, VPNs | **None** — regular APK install |
| **UI freezes & soft-locks** | Common (clock mismatches) | **Hardened** with IL2CPP watchdogs |
| **Event calendar** | Breaks when dates pass | **Infinite dynamic loop** |
| **Tracks available** | Depends on server data | **1,262 verified tracks** |
| **Works without PC?** | ❌ | **✅ Completely standalone** |

---

## 🏗️ Technical Architecture (For Developers)

<details>
<summary><b>Click to expand architecture diagram</b></summary>

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Beatstar Unity Client                            │
│           (Native libil2cpp.so & libmain.so patched with DT_NEEDED)         │
└──────────────────────┬───────────────────────────────────────┬──────────────┘
                       │ Native TCP RPC (Sharpla Protobuf)     │ HTTP Asset Requests
                       │ → 127.0.0.1:3000                     │ → 127.0.0.1:5000
                       ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               In-Process Frida Gadget Sandbox (QuickJS Engine)              │
│                                                                             │
│   ┌───────────────────────────────┐   ┌─────────────────────────────────┐   │
│   │       TcpGameServer.ts        │   │       HttpAssetServer.ts        │   │
│   │  • SpaceApe Sharpla Protobuf  │   │  • CMS Config Delivery (.gz)   │   │
│   │  • Dynamic Seasons & Events   │   │  • UnityCache Bundle Serving    │   │
│   │  • ProfileStore (Local JSON)  │   │  • Song Cover Provider (PNG)    │   │
│   │  • Leaderboard Engine         │   │  • 12,399 indexed cache entries │   │
│   └───────────────────────────────┘   └─────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    IL2CPP Native Hooks Layer                        │   │
│   │  • OfflineHarden.ts — InteractionLocker & ErrorHandler guards      │   │
│   │  • hookOnDeviceBundles.ts — AssetBundle cache mapping (12,399)     │   │
│   │  • hookRemoteBundles.ts — Download interception (3,100 entries)    │   │
│   │  • hookGameAudio.ts — Wwise audio bank routing                     │   │
│   │  • hookProfile.ts — Player identity & progression                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

</details>

### 🔧 Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Runtime Engine** | [Frida](https://frida.re/) + QuickJS | Dynamic binary instrumentation, in-process JS sandbox |
| **Server Logic** | TypeScript (compiled via esbuild) | TCP game server, HTTP asset server, all service handlers |
| **Protocol** | SpaceApe Sharpla (Protobuf) | Binary RPC protocol between Unity client and server |
| **Native Hooks** | IL2CPP + ARM64 Assembly | Intercept Unity C# methods at native level |
| **Asset Serving** | UnityFS AssetBundles + Wwise (.bnk/.wem) | Audio banks, beatmap charts, textures, covers |
| **CMS Pipeline** | Gzipped JSON configs (13 files) | GameConfig, SongConfig, AudioConfig, AssetsPatchConfig... |
| **Build System** | Python + LIEF + apksigner | ELF patching, APK assembly, code signing |
| **Storage** | Android Scoped Storage + JSON files | Player profile, settings, manifest persistence |

### 🔬 How It Works (Step by Step)

1. **ELF Injection**: During build, Python + [LIEF](https://lief-project.github.io/) patches the game's `libmain.so` with a `DT_NEEDED` entry that forces Android's dynamic linker to load `libfrida-gadget.so` at process startup.

2. **Gadget Bootstrap**: Frida Gadget initializes in standalone mode, evaluating our compiled TypeScript engine (~5.4 MB) inside a QuickJS sandbox — all within the game's own process memory.

3. **Asset Extraction**: On first launch, `StorageManager` unpacks ~8,000 embedded files (CMS configs, song covers, metadata) from the APK to device storage. A native `NativeLoaderUI` shows a sleek progress screen during this one-time bootstrap.

4. **Server Startup**: Two local servers spin up inside the process:
   - `TcpGameServer` on `127.0.0.1:3000` — handles all Sharpla Protobuf RPCs
   - `HttpAssetServer` on `127.0.0.1:5000` — serves CMS configs, UnityCache bundles, and cover images

5. **Endpoint Redirection**: IL2CPP hooks replace the game's `EndPointConfig` to point all network requests to localhost, ensuring zero traffic ever leaves the device.

6. **Offline Hardening**: Additional IL2CPP hooks guard against `InteractionLocker` soft-locks, suppress error popups, bypass tutorial gates, loop event calendars infinitely, and remap asset bundle signatures.

---

## 🚀 Quick Start — Build Your Offline Game

### Prerequisites

| Tool | Version | Install |
| :--- | :--- | :--- |
| **Python** | 3.9+ | [python.org](https://www.python.org/) |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Android Build-Tools** | Any recent | `zipalign` and `apksigner` in PATH |
| **LIEF** (Python library) | Latest | `pip install lief` |

---

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/RandoTeam/Beatstar-Zero-Server.git
cd Beatstar-Zero-Server/tools/Beatstar-Script-Android
npm install
cd ../..
```

### Step 2: Add Your Game Files

1. **Base Game APK** — Place your own legally obtained ARM64 Beatstar APK:
   ```
   input/Beatstar.apk
   ```

2. **Song Audio Cache** — Copy cached track assets from your Android device:
   ```
   # From your phone:
   /Android/data/com.spaceapegames.beatstar/files/UnityCache/
   
   # Into the project:
   assets_cache/UnityCache/
   ```

### Step 3: Build (One Command)

```bash
python build_offline.py
```

**The script automatically:**
- ⚡ Compiles the TypeScript server into a single `file.js` bundle
- 🔐 Generates the encrypted native Frida gadget payload
- 🔧 Patches `libmain.so` ELF headers with `DT_NEEDED` injection
- 📦 Bundles all offline CMS configs and asset metadata into the APK
- ✍️ Aligns and signs the package with a debug keystore

**Output:** `dist/Beatstar-Offline-arm64.apk` (~1.6 GB)

### Step 4: Install & Play

```bash
adb install dist/Beatstar-Offline-arm64.apk
```

> [!NOTE]
> **First Launch Bootstrap**  
> On the **first launch only**, the app displays a loading screen while unpacking embedded assets (~1.5 GB) to device storage. This takes **1–3 minutes** depending on your phone's storage speed.  
> **Do not close the app during this first bootstrap.** All subsequent launches are near-instant (0–3 seconds).

---

## 💖 Support the Solo Developer

This project is created, developed, and maintained **completely independently by a single engineer**. If it's been useful to you — preserving your music, powering your offline gaming, or simply inspiring your own research — your support means the world.

### 🪙 Cryptocurrency (Global, Zero Tracking)

| Asset | Network | Address |
| :--- | :--- | :--- |
| **USDT** | TRC-20 | `TY1j2N8x4K7b9vL3mP5qR8sW2tU4xZ6y8A` |
| **TON** | TON Network | `EQB_parlex_support_developer_channel` |
| **Bitcoin (BTC)** | Native SegWit | `bc1qparlexsolodeveloperhardwarefund` |
| **Ethereum (ETH)** | ERC-20 | `0xfca2fc261d4f23768a04ec49c3448278cdf17c2b` |

### 💳 Direct Banking (Regional)

- **T-Bank** *(Russia & CIS / SBP & Cards)*: [www.tbank.ru/cf/9YuuZydrQlI](https://www.tbank.ru/cf/9YuuZydrQlI)
- **Kaspi Bank** *(Kazakhstan & Central Asia)*: `+7 707 390-30-49`

**[→ Full donation details and security notes](DONATION.md)**

---

## ⚖️ Legal & Fair Use Disclaimer

- **Preservation & Research**: This project is a software engineering case study in game preservation, binary instrumentation, and reverse engineering of network protocols.
- **No Trademark Infringement**: Beatstar and SpaceApe Games are trademarks of Space Ape Ltd. This project is unaffiliated with, unauthorized by, and not endorsed by Space Ape Ltd or Supercell.
- **Zero Assets Distributed**: No game art, copyrighted music recordings, Wwise audio banks, or proprietary game binaries are hosted in this repository. Users must supply their own legally obtained game files.

---

## 🙏 Credits & Acknowledgments

This project stands on the shoulders of the community:

- **[ExternalAddress4401](https://github.com/ExternalAddress4401)** & the Beatstar Modding Community — early Frida scripts, Protobuf schema extraction, and protocol analysis
- **[Frida](https://frida.re/)** by Ole André Vadla Ravnås & NowSecure — the dynamic binary instrumentation toolkit that makes this possible
- **[LIEF Project](https://lief-project.github.io/)** — ELF binary parsing and manipulation
- **[esbuild](https://esbuild.github.io/)** — blazing-fast TypeScript bundling

*Full details in [CREDITS.md](CREDITS.md)*

---

<div align="center">

**Released under the [MIT License](LICENSE)**

*Made with ❤️ for game preservation*

**[⬆ Back to Top](#-beatstar-zero-server)**

</div>
