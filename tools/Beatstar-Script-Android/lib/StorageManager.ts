import Java from "frida-java-bridge";
import { DeviceFs } from "./DeviceFs.js";
import Logger from "./Logger.js";
import { NativeLoaderUI } from "./NativeLoaderUI.js";

export class StorageManager {
  private static appFilesDir: string = "";
  private static baseDir: string = "";
  private static initialized: boolean = false;

  static getAppFilesDir(): string {
    if (this.appFilesDir) return this.appFilesDir;

    try {
      if (Java.available) {
        let detected = "";
        Java.performNow(() => {
          try {
            const ActivityThread = Java.use("android.app.ActivityThread");
            const app = ActivityThread.currentApplication();
            if (app) {
              const context = app.getApplicationContext();
              if (context) {
                try {
                  const ext = context.getExternalFilesDir(null);
                  if (ext) {
                    detected = ext.getAbsolutePath();
                  }
                } catch (e) {}

                if (!detected) {
                  try {
                    const filesDir = context.getFilesDir();
                    if (filesDir) {
                      detected = filesDir.getAbsolutePath();
                    }
                  } catch (e) {}
                }
              }
            }
          } catch (e: any) {
            Logger.log(`[StorageManager] Context lookup error: ${e.message}`);
          }
        });
        if (detected) {
          this.appFilesDir = detected;
          return this.appFilesDir;
        }
      }
    } catch (e: any) {
      Logger.log(`[StorageManager] Storage detection exception: ${e.message}`);
    }

    // Default Android app-owned fallback
    this.appFilesDir = "/storage/emulated/0/Android/data/com.spaceapegames.beatstar/files";
    return this.appFilesDir;
  }

  static getCacheDir(): string {
    try {
      if (Java.available) {
        let detected = "";
        Java.performNow(() => {
          try {
            const ActivityThread = Java.use("android.app.ActivityThread");
            const app = ActivityThread.currentApplication();
            if (app) {
              const context = app.getApplicationContext();
              if (context) {
                const cDir = context.getExternalCacheDir();
                if (cDir) detected = cDir.getAbsolutePath();
              }
            }
          } catch (e) {}
        });
        if (detected) return detected;
      }
    } catch (e) {}
    return "/storage/emulated/0/Android/data/com.spaceapegames.beatstar/cache";
  }

  static getStorageDir(): string {
    if (this.baseDir) return this.baseDir;
    this.baseDir = `${this.getAppFilesDir()}/beatstar`;
    return this.baseDir;
  }

  static async init(): Promise<void> {
    if (this.initialized) return;
    const appFiles = this.getAppFilesDir();
    const storage = this.getStorageDir();
    Logger.log(`[StorageManager] Initializing storage (appFiles: ${appFiles}, offline: ${storage})`);

    // Ensure canonical Beatstar app directories exist
    DeviceFs.mkdirs(`${appFiles}/UnityCache`);
    DeviceFs.mkdirs(`${appFiles}/UnityCache/Shared`);
    DeviceFs.mkdirs(`${appFiles}/streamedimages`);
    DeviceFs.mkdirs(`${appFiles}/streamableemojis`);

    // Ensure BeatClone offline directories exist
    const subdirs = [
      "",
      "/cms",
      "/songs",
      "/covers",
      "/customs",
      "/script",
      "/bundles"
    ];

    for (const sub of subdirs) {
      DeviceFs.mkdirs(`${storage}${sub}`);
    }

    // Bootstrap check: verify both flag and native cache directory presence
    const flagPath = `${storage}/bootstrap_complete_v3.flag`;
    const cacheDir = this.getCacheDir();
    const nativeCacheShared = `${cacheDir}/UnityCache/Shared`;
    const needsExtraction = !DeviceFs.exists(flagPath) || !DeviceFs.exists(nativeCacheShared);

    if (needsExtraction) {
      NativeLoaderUI.show();
      Logger.log("[StorageManager] Extracting embedded APK payload to internal and external storage...");
      this.extractEmbeddedPayload();
      try {
        DeviceFs.writeFileSync(flagPath, "BOOTSTRAP_OK");
      } catch (e) {}
      // Do NOT hide NativeLoaderUI here — it stays visible during engine init.
      // Update status to show we're past extraction.
      NativeLoaderUI.updateProgress(100, "Starting offline engine...");
    } else {
      NativeLoaderUI.show();
      NativeLoaderUI.updateProgress(100, "Loading...");
      Logger.log("[StorageManager] Bootstrap payload already active.");
    }

    // Initialize user profile
    const userPath = `${storage}/user`;
    if (!DeviceFs.exists(userPath)) {
      const defaultUuid = "c0ffee00-1337-4bbf-8888-000000000001";
      try {
        DeviceFs.writeFileSync(userPath, defaultUuid);
      } catch (e) {}
    }

    this.initialized = true;
  }

  private static extractEmbeddedPayload() {
    try {
      if (Java.available) {
        Java.performNow(() => {
          try {
            const ActivityThread = Java.use("android.app.ActivityThread");
            const app = ActivityThread.currentApplication();
            if (!app) return;
            const context = app.getApplicationContext();
            const assetManager = context.getAssets();
            const File = Java.use("java.io.File");
            const FileOutputStream = Java.use("java.io.FileOutputStream");
            
            let FileUtils: any = null;
            try {
              FileUtils = Java.use("android.os.FileUtils");
            } catch (e) {}

            let extractedFiles = 0;
            const copyAssetRecursive = (assetPath: string, destPath: string) => {
              try {
                const list = assetManager.list(assetPath);
                if (list && list.length > 0) {
                  const destDir = File.$new(destPath);
                  if (!destDir.exists()) destDir.mkdirs();

                  for (let i = 0; i < list.length; i++) {
                    const item = list[i];
                    const subAsset = assetPath ? `${assetPath}/${item}` : item;
                    const subDest = `${destPath}/${item}`;
                    copyAssetRecursive(subAsset, subDest);
                  }
                } else {
                  try {
                    const is = assetManager.open(assetPath);
                    const outFile = File.$new(destPath);
                    const parent = outFile.getParentFile();
                    if (parent && !parent.exists()) parent.mkdirs();

                    const os = FileOutputStream.$new(outFile);
                    
                    if (FileUtils) {
                      FileUtils.copy(is, os);
                    } else {
                      const buffer = Java.array("byte", new Array(16384).fill(0));
                      let read = 0;
                      while ((read = is.read(buffer)) !== -1) {
                        os.write(buffer, 0, read);
                      }
                    }
                    os.flush();
                    os.close();
                    is.close();
                    extractedFiles++;
                    if (extractedFiles % 100 === 0) {
                      NativeLoaderUI.updateProgress(-1, `Unpacking files... (${extractedFiles})`);
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            };

            const appFiles = this.getAppFilesDir();
            const storage = this.getStorageDir();
            const cacheDir = this.getCacheDir();

            // List top-level items under "beatstar" in APK assets
            const topList = assetManager.list("beatstar");
            if (topList && topList.length > 0) {
              for (let i = 0; i < topList.length; i++) {
                const item = topList[i];
                const assetSub = `beatstar/${item}`;
                if (item === "UnityCache") {
                  // Extract UnityCache to BOTH locations but via symlink/single copy
                  // Primary: native Unity Cache directory
                  copyAssetRecursive(assetSub, `${cacheDir}/${item}`);
                  // Secondary: app files dir — create a marker so HttpAssetServer can index both
                  // Skip duplicate copy to save 4400+ file ops and ~2 min of extraction time
                } else if (item === "streamedimages" || item === "streamableemojis" || item === "save_prod") {
                  // Extract to canonical root files dir
                  copyAssetRecursive(assetSub, `${appFiles}/${item}`);
                } else {
                  // Extract to offline beatstar dir
                  copyAssetRecursive(assetSub, `${storage}/${item}`);
                }
              }
            } else {
              copyAssetRecursive("beatstar", storage);
            }
            
            // Extract native AssetBundles from APK so UnityWebRequest can read them via file:///
            copyAssetRecursive("AssetBundles", `${appFiles}/AssetBundles`);

            Logger.log(`[StorageManager] Successfully extracted ${extractedFiles} embedded APK payload files.`);
          } catch (e: any) {
            Logger.log(`[StorageManager] Error during asset extraction: ${e.message}`);
          }
        });
      }
    } catch (e: any) {
      Logger.log(`[StorageManager] extractEmbeddedPayload exception: ${e.message}`);
    }
  }

  static getUserUuid(): string {
    const root = this.getStorageDir();
    const userPath = `${root}/user`;
    try {
      if (DeviceFs.exists(userPath)) {
        const u = DeviceFs.readTextFileSync(userPath).trim();
        if (u) return u;
      }
    } catch (e) {}
    return "c0ffee00-1337-4bbf-8888-000000000001";
  }
}
