# Credits and Acknowledgments

This project builds upon the foundational research of open-source developers and reverse engineers:

### Original Beatstar Script & Community
- **ExternalAddress4401** and the Beatstar Modding Discord community: For the initial `Beatstar-Script-Android` Frida implementation, early packet interception research, and protocol definitions.
- **Beatstar-Zero-Server**: Represents an in-depth evolution and re-architecting of that foundation, transforming it into a 100% stable, standalone, in-process offline game preservation platform with calendar cycling, anti-softlock hardening, and zero external server dependency.

### Open Source Tools
- **Frida (NowSecure)**: Dynamic instrumentation framework powering the in-process QuickJS runtime (`libfrida-gadget.so`).
- **LIEF**: Binary parsing and modification library for ELF dynamic linking (`DT_NEEDED`).
- **ESBuild**: Fast JavaScript/TypeScript bundler.
- **Android SDK Tools**: `zipalign`, `apksigner`.

*All trademarks, game names, and copyrights belong to Space Ape Games and their respective owners. This repository contains zero proprietary game assets or copyrighted music.*
