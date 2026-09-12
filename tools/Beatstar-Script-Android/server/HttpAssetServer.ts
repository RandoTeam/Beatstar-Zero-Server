import http from "http";
import { StorageManager } from "../lib/StorageManager.js";
import { DeviceFs } from "../lib/DeviceFs.js";
import { ProfileStore } from "./models/ProfileStore.js";
import { FallbackAssets } from "./models/FallbackAssets.js";
import { CMS_HASHES } from "./services/CMSService.js";
import coverMap from "../customs/coverMap.json";
import unityCacheMap from "../customs/unityCacheMap.json";
import Logger from "../lib/Logger.js";

export class HttpAssetServer {
  private static cacheMap: Map<string, string> = new Map();
  private static cmsCache: Map<string, Buffer> = new Map();
  private static indexed: boolean = false;

  private static primeCmsCache(): void {
    const baseDir = StorageManager.getStorageDir();
    const appFilesDir = StorageManager.getAppFilesDir();
    const cmsDirs = [
      `${baseDir}/cms`,
      `${appFilesDir}/beatstar/cms`,
      `${appFilesDir}/cms`,
    ];

    for (const dir of cmsDirs) {
      if (DeviceFs.exists(dir)) {
        try {
          const files = DeviceFs.readdirSync(dir);
          for (const f of files) {
            const fullPath = `${dir}/${f}`;
            const slug = f.replace(/\.gz$/i, "").toLowerCase();
            if (!this.cmsCache.has(slug) && DeviceFs.exists(fullPath)) {
              const buf = DeviceFs.readFileSync(fullPath);
              if (buf && buf.length > 0) {
                this.cmsCache.set(slug, buf);
                this.cmsCache.set(f.toLowerCase(), buf);
              }
            }
          }
        } catch (e: any) {
          Logger.log(`[HttpAssetServer] CMS prime error in ${dir}: ${e.message}`);
        }
      }
    }
    Logger.log(`[HttpAssetServer] Primed CMS cache with ${this.cmsCache.size} files`);
  }

  private static indexUnityCache(): void {
    if (this.indexed) return;
    const appFilesDir = StorageManager.getAppFilesDir();
    const storageDir = StorageManager.getStorageDir();
    const cacheDir = StorageManager.getCacheDir();
    
    const searchDirs = [
      `${cacheDir}/UnityCache/Shared`,
      `${appFilesDir}/UnityCache/Shared`,
      `${storageDir}/UnityCache/Shared`,
      `${appFilesDir}/beatstar/UnityCache/Shared`,
    ];

    // 1. Prime cacheMap with static unityCacheMap definitions
    const staticMap = unityCacheMap as Record<string, string>;
    for (const [bId, relPath] of Object.entries(staticMap)) {
      for (const sharedDir of searchDirs) {
        const candidate = `${sharedDir}/${relPath}`;
        if (DeviceFs.exists(candidate)) {
          this.cacheMap.set(bId.toLowerCase(), candidate);
          const parts = relPath.split("_");
          if (parts[1]) {
            const hashPart = parts[1].split("/")[0].toLowerCase();
            this.cacheMap.set(hashPart, candidate);
            if (hashPart.length >= 32) {
              this.cacheMap.set(hashPart.substring(0, 32), candidate);
            }
          }
          break;
        }
      }
    }

    try {
      for (const sharedDir of searchDirs) {
        if (DeviceFs.exists(sharedDir)) {
          const folders = DeviceFs.readdirSync(sharedDir);
          for (const folder of folders) {
            const parts = folder.split("_");
            const bundleId = parts[0] ? parts[0].toLowerCase() : "";
            const hashPart = parts[1] ? parts[1].toLowerCase() : "";
            const hash32 = hashPart.length >= 32 ? hashPart.substring(0, 32) : "";

            const folderPath = `${sharedDir}/${folder}`;
            try {
              const sub = DeviceFs.readdirSync(folderPath);
              const subFolder = Array.isArray(sub) && sub.length > 0 ? sub[0] : "";
              if (subFolder) {
                const dataFile = `${folderPath}/${subFolder}/__data`;
                if (DeviceFs.exists(dataFile)) {
                  if (bundleId) this.cacheMap.set(bundleId, dataFile);
                  if (hashPart) this.cacheMap.set(hashPart, dataFile);
                  if (hash32) this.cacheMap.set(hash32, dataFile);
                  this.cacheMap.set(folder.toLowerCase(), dataFile);
                }
              }
            } catch (e) {}
          }
          Logger.log(`[HttpAssetServer] Indexed UnityCache bundles from ${sharedDir}`);
        }
      }
      Logger.log(`[HttpAssetServer] Total cacheMap entries: ${this.cacheMap.size}`);
      this.indexed = true;
    } catch (e: any) {
      Logger.log(`[HttpAssetServer] UnityCache index error: ${e.message}`);
    }
  }

  static hasCachedBundle(key: string): boolean {
    if (!key) return false;
    this.indexUnityCache();
    const cleanKey = key.replace(/\.bundle$/i, "").toLowerCase();
    const staticMap = unityCacheMap as Record<string, string>;
    return this.cacheMap.has(cleanKey) || this.cacheMap.has(key.toLowerCase()) || Boolean(staticMap[cleanKey]);
  }

  static start(port: number = 5000): void {
    this.indexUnityCache();
    this.primeCmsCache();
    const baseDir = StorageManager.getStorageDir();
    const appFilesDir = StorageManager.getAppFilesDir();

    const requestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
      try {
        const url = req.url || "";
        const cleanUrl = url.split("?")[0];
        const parts = cleanUrl.split("/").filter(Boolean);
        const lastPart = parts[parts.length - 1] || "";
        const bundleName = lastPart.replace(/\.bundle$/i, "").toLowerCase();

        Logger.log(`[HttpAssetServer] ${req.method} ${cleanUrl} (bundleName: ${bundleName})`);

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");

        if (req.method === "OPTIONS") {
          res.writeHead(200);
          res.end();
          return;
        }

        // CUSTOM RENAME API
        if (cleanUrl.startsWith("/custom/rename")) {
          try {
            let newName = "";
            if (url.indexOf("name=") !== -1) {
              newName = url.split("name=")[1].split("&")[0];
              newName = decodeURIComponent(newName);
            }
            if (newName) {
              ProfileStore.load();
              ProfileStore.setUsername(newName);
              const currentDiamonds = ProfileStore.getProfile().diamonds ?? 67025;
              ProfileStore.setDiamonds(Math.max(0, currentDiamonds - 1));
              Logger.log(`[HttpAssetServer] Processed custom rename request: ${newName}`);
            }
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("OK");
          } catch (e: any) {
            Logger.log(`[HttpAssetServer] Rename error: ${e.message}`);
            res.writeHead(500);
            res.end("Error");
          }
          return;
        }

        // 1. CMS Config Files
        if (cleanUrl.startsWith("/cms/")) {
          const slugWithGz = parts[1] || "";
          const slug = slugWithGz.replace(/\.gz$/i, "").replace(/\/json$/i, "").replace(/\/raw$/i, "").toLowerCase();
          
          let data = this.cmsCache.get(slug) || this.cmsCache.get(slugWithGz.toLowerCase());
          if (!data || data.length === 0) {
            this.primeCmsCache();
            data = this.cmsCache.get(slug) || this.cmsCache.get(slugWithGz.toLowerCase());
          }

          if (data && data.length > 0) {
            res.writeHead(200, {
              "Content-Type": "application/gzip",
              "Content-Length": data.length,
            });
            res.end(data);
            return;
          }

          const gzPath = `${baseDir}/cms/${parts[1] || slug}.gz`;
          const rawPath = `${baseDir}/cms/${parts[1] || slug}`;

          if (DeviceFs.exists(gzPath)) {
            const diskData = DeviceFs.readFileSync(gzPath);
            if (diskData && diskData.length > 0) {
              this.cmsCache.set(slug, diskData);
              res.writeHead(200, {
                "Content-Type": "application/gzip",
                "Content-Length": diskData.length,
              });
              res.end(diskData);
              return;
            }
          } else if (DeviceFs.exists(rawPath)) {
            const diskData = DeviceFs.readFileSync(rawPath);
            if (diskData && diskData.length > 0) {
              this.cmsCache.set(slug, diskData);
              res.writeHead(200, {
                "Content-Type": "application/octet-stream",
                "Content-Length": diskData.length,
              });
              res.end(diskData);
              return;
            }
          }

          res.writeHead(404);
          res.end("CMS config not found");
          return;
        }

        // 2. Info / Hashes
        if (cleanUrl === "/info") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(CMS_HASHES));
          return;
        }

        // 2b. Custom Song Bundles & Metadata (/customs/...)
        if (cleanUrl.includes("/customs/")) {
          const sub = cleanUrl.substring(cleanUrl.indexOf("/customs/"));
          const customPaths = [
            `${baseDir}${sub}`,
            `${appFilesDir}/beatstar${sub}`,
            `${appFilesDir}${sub}`
          ];
          for (const cp of customPaths) {
            if (DeviceFs.exists(cp)) {
              const data = DeviceFs.readFileSync(cp);
              res.writeHead(200, {
                "Content-Type": "application/octet-stream",
                "Content-Length": data.byteLength.toString(),
                "Access-Control-Allow-Origin": "*",
              });
              res.end(data);
              return;
            }
          }
        }

        // 3. UnityCache AssetBundles (/5/...)
        if (cleanUrl.startsWith("/5") || cleanUrl.includes(".bundle")) {
          let dataPath = this.cacheMap.get(bundleName);
          if (!dataPath) {
            this.indexUnityCache();
            dataPath = this.cacheMap.get(bundleName);
          }

          // Direct lookup via unityCacheMap if not found in cacheMap
          if (!dataPath) {
            const staticMap = unityCacheMap as Record<string, string>;
            const relPath = staticMap[bundleName] || staticMap[bundleName.split("_")[0]];
            if (relPath) {
              const cacheDir = StorageManager.getCacheDir();
              const candidatePaths = [
                `${cacheDir}/UnityCache/Shared/${relPath}`,
                `${appFilesDir}/UnityCache/Shared/${relPath}`,
                `${baseDir}/UnityCache/Shared/${relPath}`,
                `${appFilesDir}/beatstar/UnityCache/Shared/${relPath}`,
              ];
              for (const cand of candidatePaths) {
                if (DeviceFs.exists(cand)) {
                  dataPath = cand;
                  this.cacheMap.set(bundleName, cand);
                  break;
                }
              }
            }
          }

          if (dataPath && DeviceFs.exists(dataPath)) {
            const data = DeviceFs.readFileSync(dataPath);
            Logger.log(`[HttpAssetServer] 200 OK for bundle: ${bundleName} from cache (${data.length} bytes)`);
            res.writeHead(200, {
              "Content-Type": "application/octet-stream",
              "Content-Length": data.length,
            });
            res.end(data);
            return;
          }

          // Fallback to bundles directory
          const prefix = bundleName.split("_")[0];
          const candidatePaths = [
            `${baseDir}/bundles/${bundleName}.bundle`,
            `${baseDir}/bundles/${bundleName}`,
            `${baseDir}/bundles/${prefix}.bundle`,
            `${baseDir}/bundles/${prefix}`,
            `${baseDir}/bundles/${lastPart}`
          ];

          for (const candPath of candidatePaths) {
            if (DeviceFs.exists(candPath)) {
              const data = DeviceFs.readFileSync(candPath);
              Logger.log(`[HttpAssetServer] 200 OK for bundle: ${bundleName} from ${candPath} (${data.length} bytes)`);
              res.writeHead(200, {
                "Content-Type": "application/octet-stream",
                "Content-Length": data.length,
              });
              res.end(data);
              return;
            }
          }

          // FALLBACK DUMMY BUNDLE TO PREVENT UNITY INFINITE LOOP
          const firstMapKey = Object.keys(unityCacheMap as Record<string, string>)[0];
          const firstRelPath = (unityCacheMap as Record<string, string>)[firstMapKey];
          if (firstRelPath) {
            const cacheDir = StorageManager.getCacheDir();
            const dummyPaths = [
              `${cacheDir}/UnityCache/Shared/${firstRelPath}`,
              `${baseDir}/UnityCache/Shared/${firstRelPath}`,
              `${appFilesDir}/UnityCache/Shared/${firstRelPath}`,
              `${StorageManager.getStorageDir()}/UnityCache/Shared/${firstRelPath}`,
            ];
            for (const dp of dummyPaths) {
              if (DeviceFs.exists(dp)) {
                const data = DeviceFs.readFileSync(dp);
                Logger.log(`[HttpAssetServer] 404 -> 200 DUMMY BUNDLE for: ${bundleName}`);
                res.writeHead(200, {
                  "Content-Type": "application/octet-stream",
                  "Content-Length": data.length,
                });
                res.end(data);
                return;
              }
            }
          }

          Logger.log(`[HttpAssetServer] 404 NOT FOUND for bundle: ${cleanUrl} (bundleName: ${bundleName})`);
          res.writeHead(404);
          res.end();
          return;
        }

        // 4. Streamed Images, Covers & Streamable Emojis
        const isImageRoute = cleanUrl.includes("/images") ||
          cleanUrl.includes("/covers") ||
          cleanUrl.includes("/streamedimages") ||
          cleanUrl.includes("/streamableemojis") ||
          cleanUrl.includes("/emoji") ||
          /\.(png|jpg|jpeg|webp)$/i.test(cleanUrl) ||
          (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[parts.length - 1] || ""));

        if (isImageRoute) {
          const rawName = parts[parts.length - 1] || "";
          const cleanName = rawName.toLowerCase();
          const strippedName = cleanName.replace(/\.(png|jpg|jpeg|webp)$/i, "");
          const map = coverMap as Record<string, string>;

          const mappedRel = map[cleanName] || map[strippedName] || "";
          const imgPaths: string[] = [];

          if (mappedRel) {
            imgPaths.push(`${baseDir}/${mappedRel}`);
            imgPaths.push(`${appFilesDir}/${mappedRel}`);
            imgPaths.push(`${baseDir}/${mappedRel}.png`);
            imgPaths.push(`${appFilesDir}/${mappedRel}.png`);
          }

          imgPaths.push(
            `${appFilesDir}/streamedimages/${rawName}`,
            `${baseDir}/streamedimages/${rawName}`,
            `${appFilesDir}/streamedimages/${rawName}.png`,
            `${baseDir}/streamedimages/${rawName}.png`,
            `${appFilesDir}/streamedimages/${strippedName}.png`,
            `${baseDir}/streamedimages/${strippedName}.png`,
            `${appFilesDir}/streamedimages/${strippedName}.jpg`,
            `${baseDir}/streamedimages/${strippedName}.jpg`,
            `${baseDir}/covers/${rawName}`,
            `${baseDir}/covers/${rawName}.png`,
            `${baseDir}/covers/${strippedName}.png`,
            `${baseDir}/covers/${strippedName}.jpg`,
            `${appFilesDir}/covers/${rawName}`,
            `${appFilesDir}/covers/${rawName}.png`,
            `${appFilesDir}/covers/${strippedName}.png`,
            `${appFilesDir}/covers/${strippedName}.jpg`,
            `${appFilesDir}/streamableemojis/${rawName}`,
            `${baseDir}/streamableemojis/${rawName}`,
            `${appFilesDir}/streamableemojis/${rawName}.png`,
            `${baseDir}/streamableemojis/${rawName}.png`,
            `${appFilesDir}/streamableemojis/${strippedName}.png`,
            `${baseDir}/streamableemojis/${strippedName}.png`
          );

          for (const imgP of imgPaths) {
            if (DeviceFs.exists(imgP)) {
              const data = DeviceFs.readFileSync(imgP);
              res.writeHead(200, {
                "Content-Type": "image/png",
                "Content-Length": data.length,
                "Access-Control-Allow-Origin": "*",
              });
              res.end(data);
              return;
            }
          }

          // Serve high-fidelity branded fallback PNG to prevent Unity DownloadHandlerTexture crash
          const fallbackPng = FallbackAssets.getFallbackForRequest(cleanUrl);
          res.writeHead(200, {
            "Content-Type": "image/png",
            "Content-Length": fallbackPng.length,
            "Access-Control-Allow-Origin": "*",
          });
          res.end(fallbackPng);
          return;
        }

        // 5. Custom Songs Catalog JSON
        if (cleanUrl === "/songs" || cleanUrl === "/api/songs") {
          const songsManifest = `${baseDir}/songs/manifest.json`;
          if (DeviceFs.exists(songsManifest)) {
            const data = DeviceFs.readFileSync(songsManifest);
            res.writeHead(200, {
              "Content-Type": "application/json",
              "Content-Length": data.length,
            });
            res.end(data);
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ songs: [] }));
          return;
        }

        // 6. Songs & Customs
        if (cleanUrl.startsWith("/songs/") || cleanUrl.startsWith("/customs/")) {
          const filePath = `${baseDir}${cleanUrl}`;
          if (DeviceFs.exists(filePath)) {
            const data = DeviceFs.readFileSync(filePath);
            res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": data.length });
            res.end(data);
            return;
          }
          Logger.log(`[HttpAssetServer] 404 NOT FOUND for custom song/asset: ${cleanUrl} (path: ${filePath})`);
          res.writeHead(404);
          res.end();
          return;
        }

        // 7. Mod / Auth / Profile APIs
        if (cleanUrl.startsWith("/verify") || cleanUrl.startsWith("/createAccount")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            status: "SUCCESS",
            userId: "beatclone_offline_master_user",
            token: "beatclone_offline_master_user",
            unlocked: true,
          }));
          return;
        }

        if (cleanUrl.startsWith("/scores")) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify([]));
          return;
        }

        if (cleanUrl.startsWith("/version")) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("1.0.60");
          return;
        }

        if (cleanUrl.startsWith("/api/profile") || cleanUrl.startsWith("/profile")) {
          const profile = ProfileStore.getProfile();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            player: profile,
          }));
          return;
        }

        // Generic 200 OK fallback
        Logger.log(`[HttpAssetServer] Unhandled route, falling back to 200 OK: ${cleanUrl}`);
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OK");
      } catch (err: any) {
        Logger.log(`[HttpAssetServer] Handler error: ${err.message}`);
        try {
          res.writeHead(500);
          res.end();
        } catch (e) {}
      }
    };

    try {
      const server1 = http.createServer(requestHandler);
      server1.listen(port, "0.0.0.0", () => {
        Logger.log(`[HttpAssetServer] Asset & CMS HTTP server listening on 0.0.0.0:${port}`);
      });
    } catch (e: any) {
      Logger.log(`[HttpAssetServer] Start error: ${e.message}`);
    }
  }
}
