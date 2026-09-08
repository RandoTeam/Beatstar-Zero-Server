import Logger from "../lib/Logger.js";
import { StorageManager } from "../lib/StorageManager.js";
import unityCacheMap from "./unityCacheMap.json";

export const hookRemoteBundles = () => {
  try {
    const assembly = Il2Cpp.domain.assembly("SpaceApe.UnityAssets")?.image;
    if (!assembly) return;

    const downloader = assembly.class("com.spaceape.assetstreaming.AssetBundleDownloader");
    if (!downloader) return;

    const m = downloader.method("DownloadRemoteBundle");
    if (!m) return;

    const cacheDir = StorageManager.getCacheDir();
    const appFilesDir = StorageManager.getAppFilesDir();
    const sharedCachePrefix = `${cacheDir}/UnityCache/Shared`;
    const assetBundlesPrefix = `${appFilesDir}/AssetBundles`;

    Logger.log(`[hookRemoteBundles] Initialized with ${Object.keys(unityCacheMap).length} static cache entries`);

    m.implementation = function (
      bundle: any,
      url: Il2Cpp.String,
      onComplete: any
    ) {
      try {
        let str = url ? url.toString() : "";

        if (str.startsWith('"') && str.endsWith('"')) {
          str = str.slice(1, -1);
        }

        let bundleId = "";
        const bundleMatch = str.match(/([0-9a-f]{32})/i);
        if (bundleMatch) {
          bundleId = bundleMatch[1].toLowerCase();
        }

        // Check if the URL points to a local cache bundle, APK-embedded bundle, or remote CDN
        if (bundleId && (unityCacheMap as Record<string, string>)[bundleId]) {
          const relPath = (unityCacheMap as Record<string, string>)[bundleId];
          const targetFile = `${sharedCachePrefix}/${relPath}`;
          const newUrl = `file://${targetFile}`;
          url = Il2Cpp.string(newUrl);
        } else if (str.includes("jar:file://") || str.includes("base.apk!")) {
          // APK-embedded bundle extracted to files/AssetBundles
          const fileName = str.substring(str.lastIndexOf("/") + 1);
          const targetFile = `${assetBundlesPrefix}/${fileName}`;
          const newUrl = `file://${targetFile}`;
          url = Il2Cpp.string(newUrl);
        } else if (str.includes("assets.flamingo.newbirds.net")) {
          str = str.replace(/https?:\/\/assets\.flamingo\.newbirds\.net/i, "http://127.0.0.1:5000");
          url = Il2Cpp.string(str);
        }
      } catch (e: any) {
        Logger.log(`[hookRemoteBundles] Error: ${e.message}`);
      }

      return this.method("DownloadRemoteBundle").invoke(bundle, url, onComplete);
    };

    Logger.log("[hookRemoteBundles] DownloadRemoteBundle hook installed successfully");
  } catch (e: any) {
    Logger.log(`[hookRemoteBundles] Hook install error: ${e.message}`);
  }
};
