import { Buffer } from "buffer";
(globalThis as any).Buffer = Buffer;
import "frida-il2cpp-bridge";
import Device from "../lib/Device.js";
import { lengthFixer } from "../functions/lengthFixer.js";
import { hookGraphics } from "../hacks/graphics.js";
import { search } from "../functions/search.js";
import { hookSupportButton } from "../hacks/hookSupportButton.js";
import { customServer } from "../utilities/customServer.js";
import { hookCintaId } from "../private-server/hookCintaId.js";
import { activateMod } from "../utilities/activateMod.js";
import { logErrors } from "../utilities/logErrors.js";
import { customColors } from "../functions/customColors.js";
import { saveDeviceId } from "../functions/saveDeviceId.js";
import SettingsReader from "../lib/SettingsReader.js";
import Logger from "../lib/Logger.js";
import { hookScoring } from "../customs/hookScoring.js";
import { hookOnDeviceBundles } from "../customs/hookOnDeviceBundles.js";
import { hookRemoteBundles } from "../customs/hookRemoteBundles.js";
import { hookProfile } from "../customs/hookProfile.js";
import { hookSongInfoElement } from "../customs/hookSongInfoElement.js";
import { hookNameChange } from "../customs/hookNameChange.js";
import { ignoreBundleHash } from "../customs/ignoreBundleHash.js";
import { bypassTutorialBlock } from "../hacks/bypassTutorialBlock.js";
import { hookPlaySongScreen } from "../customs/hookPlaySongScreen.js";
import { hookUnityWebRequest } from "../customs/hookUnityWebRequest.js";
import { disableTutorial } from "../functions/disableTutorial.js";
import { StorageManager } from "../lib/StorageManager.js";
import { TcpGameServer } from "../server/TcpGameServer.js";
import { HttpAssetServer } from "../server/HttpAssetServer.js";
import { hardenOffline } from "../utilities/OfflineHarden.js";
import { hookDeviceSettings } from "../customs/hookDeviceSettings.js";
import { songNameHack } from "../hacks/songName.js";

rpc.exports = {
  init(stage, parameters) {
    return new Promise<void>((resolve) => {
      Logger.log(`[Frida Gadget] RPC init called with stage: ${stage}`);
      resolve();
    });
  },
};

Il2Cpp.perform(async () => {
  try {
    Logger.log("==========================================");
    Logger.log("    BEATSTAR STANDALONE OFFLINE INIT     ");
    Logger.log("==========================================");

    // 1. Initialize App-Owned Storage & Payload
    await StorageManager.init();

    // 2. Start In-Process TCP Game Server (SpaceApe Sharpla Protobuf) on 127.0.0.1:3000
    Logger.log("[Init] Starting TcpGameServer on 127.0.0.1:3000...");
    TcpGameServer.start(3000);

    // 3. Start In-Process HTTP Asset & CMS Server on 127.0.0.1:5000
    Logger.log("[Init] Starting HttpAssetServer on 127.0.0.1:5000...");
    HttpAssetServer.start(5000);

    // 4. Hook SpaceApe Network Endpoint to 127.0.0.1:3000
    Logger.log("[Init] Hooking custom server endpoint");
    customServer();

    // 5. Hook user identity & settings
    Logger.log("[Init] Hooking Cinta ID");
    hookCintaId();

    Logger.log("[Init] Saving device ID");
    saveDeviceId();

    Logger.log("[Init] Applying custom colors");
    customColors();

    Logger.log("[Init] Hooking IL2CPP error and exception logging");
    logErrors();

    Logger.log("[Init] Activating mod systems");
    activateMod();

    Logger.log("[Init] Hooking support button for manual refresh");
    hookSupportButton();

    Logger.log("[Init] Applying track length fixer");
    lengthFixer();

    Logger.log("[Init] Hooking graphics (120 FPS unlocked)");
    hookGraphics();

    Logger.log("[Init] Hooking song search bar");
    search();

    Logger.log("[Init] Hooking gameplay scoring");
    hookScoring();

    Logger.log("[Init] Hooking on-device bundles & download state");
    hookOnDeviceBundles();
    hookRemoteBundles();
    hookUnityWebRequest();

    Logger.log("[Init] Hooking offline player profile & FTUE state");
    hookProfile();

    Logger.log("[Init] Bypassing bundle hash verification");
    ignoreBundleHash();

    Logger.log("[Init] Bypassing tutorial restrictions");
    bypassTutorialBlock();

    Logger.log("[Init] Disabling FTUE tutorial flags");
    disableTutorial();


    // 7. Harden against external network & safe offline UI
    hardenOffline();

    // 7.1. Disable developer placeholder debug mode and text outlines
    Logger.log("[Init] Disabling developer debug mode & text overrides");
    hookDeviceSettings();

    // 7.2. Hook song metadata localization
    Logger.log("[Init] Hooking song titles & artists localization");
    songNameHack();

    // 8. Hook SongInfoElement & StaticContextImage null guards
    Logger.log("[Init] Hooking SongInfoElement & StaticContextImage guards");
    hookSongInfoElement();

    hookNameChange();
    
    // 10. Hook PlaySongScreenController and suppress error dialogs
    Logger.log("[Init] Hooking PlaySongScreenController & ErrorHandling");
    hookPlaySongScreen();

    Device.toast("Beatstar Offline: Ready (120 FPS)");
    Logger.log("[Init] Complete offline initialization finished.");
  } catch (err: any) {
    Logger.log(`[Init] Fatal initialization error: ${err.message}\n${err.stack}`);
  }
}, "main");
