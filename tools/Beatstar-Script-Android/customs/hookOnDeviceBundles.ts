import Logger from "../lib/Logger.js";
import ClassResolver from "../lib/ClassResolver.js";
import { HttpAssetServer } from "../server/HttpAssetServer.js";
import unityCacheMap from "./unityCacheMap.json";

/**
 * On-Device Bundles, Network Reachability, Promo Suppression,
 * and Beatmap Variant Asset Remapping Hooks.
 */
export const hookOnDeviceBundles = () => {
  try {
    Logger.log("[hookOnDeviceBundles] Initializing IL2CPP hooks with ClassResolver...");

    // 1. Force Unity Application to report local area network reachability (offline localhost)
    const appClass = ClassResolver.findClass("UnityEngine.Application", "UnityEngine.CoreModule")
      || ClassResolver.findClass("UnityEngine.Application");
    if (appClass) {
      const getReachability = ClassResolver.tryMethod(appClass, "get_internetReachability", 0);
      if (getReachability) {
        getReachability.implementation = function () {
          return 2; // ReachableViaLocalAreaNetwork
        };
        Logger.log("[hookOnDeviceBundles] Hooked Application.get_internetReachability -> 2 (LAN)");
      }
    }

    // 2. Hook SpaceApe NetworkMonitor
    const netMonClass = ClassResolver.findClass("NetworkMonitor", "SpaceApe.Network")
      || ClassResolver.findClass("NetworkMonitor");
    if (netMonClass) {
      const getReach = ClassResolver.tryMethod(netMonClass, "get_Reachability", 0);
      if (getReach) {
        getReach.implementation = function () {
          return 2; // ReachableViaLocalAreaNetwork
        };
      }
    }

    // 3. Hook AppAssetBundleQueue: Manage local bundle readiness and unpause queue
    const queueClass = ClassResolver.findClass("BeatStar.GameAssets.AppAssetBundleQueue", "Assembly-CSharp")
      || ClassResolver.findClass("AppAssetBundleQueue");
    if (queueClass) {
      const isBundleOnDevice = ClassResolver.tryMethod(queueClass, "IsAssetBundleOnDevice", 1);
      if (isBundleOnDevice) {
        isBundleOnDevice.implementation = function (unityAssetBundle: any) {
          try {
            if (!unityAssetBundle || unityAssetBundle.isNull()) return false;
            try {
              const size = Number(unityAssetBundle.field("SizeInBytes")?.value || 0);
              if (size === 0) return true; // Custom songs
            } catch (e) {}

            try {
              const bundleIdRaw = unityAssetBundle.field("id")?.value?.toString() || "";
              const bundleId = bundleIdRaw.replace(/^"|"$/g, "").toLowerCase();
              if (bundleId && (unityCacheMap as Record<string, string>)[bundleId]) {
                return true;
              }
            } catch (e) {}
          } catch (e) {}
          return isBundleOnDevice.bind(this).invoke(unityAssetBundle);
        };
      }

      const getIsPaused = ClassResolver.tryMethod(queueClass, "get_IsPaused", 0);
      if (getIsPaused) {
        getIsPaused.implementation = function () {
          return false; // Queue remains active to process streaming downloads
        };
      }
      Logger.log("[hookOnDeviceBundles] Hooked AppAssetBundleQueue (IsAssetBundleOnDevice cache mapped & get_IsPaused -> false)");
    }

    // 4. Hook AssetBundleManager: Check local cached presence
    const abmClass = ClassResolver.findClass("com.spaceape.assetstreaming.AssetBundleManager", "SpaceApe.UnityAssets")
      || ClassResolver.findClass("AssetBundleManager");
    if (abmClass) {
      const hasDownloaded = ClassResolver.tryMethod(abmClass, "HasAssetBundleBeenDownloaded", 2);
      if (hasDownloaded) {
        hasDownloaded.implementation = function (bundle: any, includeDependencies: any) {
          try {
            if (!bundle || bundle.isNull()) return false;
            try {
              const size = Number(bundle.field("SizeInBytes")?.value || 0);
              if (size === 0) return true;
            } catch (e) {}

            try {
              const bundleIdRaw = bundle.field("id")?.value?.toString() || "";
              const bundleId = bundleIdRaw.replace(/^"|"$/g, "").toLowerCase();
              if (bundleId && (unityCacheMap as Record<string, string>)[bundleId]) {
                return true;
              }
            } catch (e) {}
          } catch (e) {}
          return hasDownloaded.bind(this).invoke(bundle, includeDependencies);
        };
      }
      const loadAsset = ClassResolver.tryMethod(abmClass, "LoadAsset", 2);
      if (loadAsset) {
        loadAsset.implementation = function (uasset: any, resultCallback: any) {
          try {
            if (uasset && !uasset.isNull()) {
              const nameField = uasset.field("name");
              const currentName = nameField?.value?.toString()?.replace(/^"|"$/g, "") || "";
              if (currentName && (currentName.includes("Assets/Audio/Banks/") || currentName.includes("Assets/beatmapInteractions/"))) {
                nameField.value = Il2Cpp.string(currentName.toLowerCase());
                Logger.log(`[hookOnDeviceBundles] Lowercased uasset path: ${currentName} -> ${currentName.toLowerCase()}`);
              }
            }
          } catch (e) {}
          return loadAsset.bind(this).invoke(uasset, resultCallback);
        };
        Logger.log("[hookOnDeviceBundles] Hooked AssetBundleManager.LoadAsset (auto-lowercasing custom assets)");
      }
      Logger.log("[hookOnDeviceBundles] Hooked AssetBundleManager.HasAssetBundleBeenDownloaded (cache mapped)");
    }

    // 5. Suppress Promo interstitials in offline mode (avoids NullReference / empty campaigns freeze)
    const promoSystem = ClassResolver.findClass("PromoInterstitialSystem")
      || ClassResolver.findClass("PromoInterstitialSystem", "MetaLogic");
    if (promoSystem) {
      promoSystem.methods.forEach(m => {
        if (
          m.name === "ShouldShowPromoInterstitial" ||
          m.name === "ShouldShowInterstitial" ||
          m.name === "CanShowInterstitial" ||
          m.name === "TryShowInterstitial"
        ) {
          m.implementation = function (...args: any[]) {
            return false;
          };
        }
      });
      Logger.log("[hookOnDeviceBundles] Hooked PromoInterstitialSystem (suppressed popups)");
    }

    // 6. Hook AssetBundle.LoadAsset & Contains to remap beatmap variant assets (e.g. 762-2 -> 762)
    const assetBundleClass = ClassResolver.findClass("UnityEngine.AssetBundle", "UnityEngine.AssetBundleModule")
      || ClassResolver.findClass("UnityEngine.AssetBundle", "UnityEngine.CoreModule")
      || ClassResolver.findClass("UnityEngine.AssetBundle");

    if (assetBundleClass) {
      const loadAssetMethod = ClassResolver.tryMethod(assetBundleClass, "LoadAsset", 2);
      if (loadAssetMethod) {
        loadAssetMethod.implementation = function (name: Il2Cpp.String, type: any) {
          const nameStr = (name && "content" in name && name.content !== null)
            ? (name.content as string)
            : (name ? name.toString().replace(/^"|"$/g, "") : "");

          if (nameStr && nameStr.includes("beatmapInteractions/")) {
            // 1. Try direct invocation first
            try {
              const directAsset = loadAssetMethod.bind(this).invoke(name, type);
              if (directAsset && !directAsset.isNull()) return directAsset;
            } catch (e) {}

            // 2. Extract track number and test aliases (e.g., 795-1 -> 1795, 795, 795-1)
            const m = nameStr.match(/(\d+)/);
            if (m) {
              const baseId = m[1];
              const aliases = [
                `Assets/beatmapInteractions/1${baseId}.bytes`,
                `Assets/beatmapInteractions/${baseId}.bytes`,
                `Assets/beatmapInteractions/${baseId}-1.bytes`,
                `Assets/beatmapInteractions/${baseId}-2.bytes`,
                `Assets/beatmapInteractions/1${baseId}-1.bytes`,
                `Assets/beatmapInteractions/1${baseId}-2.bytes`,
              ];
              for (const alias of aliases) {
                if (alias === nameStr) continue;
                try {
                  const aliasStr = Il2Cpp.string(alias);
                  const foundAsset = loadAssetMethod.bind(this).invoke(aliasStr, type);
                  if (foundAsset && !foundAsset.isNull()) {
                    Logger.log(`[hookOnDeviceBundles] Resolved beatmap variant alias: ${nameStr} -> ${alias}`);
                    return foundAsset;
                  }
                } catch (e) {}
              }
            }
          } else if (nameStr && nameStr.includes("Assets/Audio/Banks/TST")) {
            // Fix Custom Song Audio Bank alias (BinStar converts use TST00026, client might ask for TST00025)
            try {
              const directAsset = loadAssetMethod.bind(this).invoke(name, type);
              if (directAsset && !directAsset.isNull()) return directAsset;
            } catch (e) {}

            try {
              const getAllAssetNames = ClassResolver.tryMethod(this.class, "GetAllAssetNames", 0);
              if (getAllAssetNames) {
                const namesArray = getAllAssetNames.bind(this).invoke() as any;
                if (namesArray && !namesArray.isNull()) {
                  for (let i = 0; i < namesArray.length; i++) {
                    const assetNameObj = namesArray.get(i);
                    const assetName = assetNameObj ? (assetNameObj.content as string) : "";
                    if (assetName && (assetName.includes("tst00025") || assetName.includes("tst00026"))) {
                      Logger.log(`[hookOnDeviceBundles] Resolved Audio Bank dynamic alias: ${nameStr} -> ${assetName}`);
                      const foundAsset = loadAssetMethod.bind(this).invoke(Il2Cpp.string(assetName), type);
                      if (foundAsset && !foundAsset.isNull()) return foundAsset;
                    }
                  }
                }
              }
            } catch (e) {}
          }

          // Universal invoke: try original name first, then lowercase fallback for custom bundles
          try {
            const result = loadAssetMethod.bind(this).invoke(name, type);
            if (result && !result.isNull()) return result;
          } catch (e) {}

          // Lowercase fallback: custom bundles from BinStar converter have lowercase container paths
          if (nameStr) {
            const lower = nameStr.toLowerCase();
            if (lower !== nameStr) {
              try {
                const lowerResult = loadAssetMethod.bind(this).invoke(Il2Cpp.string(lower), type);
                if (lowerResult && !lowerResult.isNull()) {
                  return lowerResult;
                }
              } catch (e) {}
            }
          }

          return loadAssetMethod.bind(this).invoke(name, type);
        };
      }

      const containsMethod = ClassResolver.tryMethod(assetBundleClass, "Contains", 1);
      if (containsMethod) {
        containsMethod.implementation = function (name: Il2Cpp.String) {
          const nameStr = (name && "content" in name && name.content !== null)
            ? (name.content as string)
            : (name ? name.toString().replace(/^"|"$/g, "") : "");

          try {
            if (containsMethod.bind(this).invoke(name)) return true;
          } catch (e) {}

          if (nameStr && nameStr.includes("beatmapInteractions/")) {
            const m = nameStr.match(/(\d+)/);
            if (m) {
              const baseId = m[1];
              const aliases = [
                `Assets/beatmapInteractions/1${baseId}.bytes`,
                `Assets/beatmapInteractions/${baseId}.bytes`,
                `Assets/beatmapInteractions/${baseId}-1.bytes`,
                `Assets/beatmapInteractions/${baseId}-2.bytes`,
                `Assets/beatmapInteractions/1${baseId}-1.bytes`,
                `Assets/beatmapInteractions/1${baseId}-2.bytes`,
              ];
              for (const alias of aliases) {
                if (alias === nameStr) continue;
                try {
                  if (containsMethod.bind(this).invoke(Il2Cpp.string(alias))) {
                    return true;
                  }
                } catch (e) {}
              }
            }
          } else if (nameStr && nameStr.includes("Assets/Audio/Banks/TST")) {
            try {
              const getAllAssetNames = ClassResolver.tryMethod(this.class, "GetAllAssetNames", 0);
              if (getAllAssetNames) {
                const namesArray = getAllAssetNames.bind(this).invoke() as any;
                if (namesArray && !namesArray.isNull()) {
                  for (let i = 0; i < namesArray.length; i++) {
                    const assetNameObj = namesArray.get(i);
                    const assetName = assetNameObj ? (assetNameObj.content as string) : "";
                    if (assetName && (assetName.includes("tst00025") || assetName.includes("tst00026"))) {
                      if (containsMethod.bind(this).invoke(Il2Cpp.string(assetName))) {
                        return true;
                      }
                    }
                  }
                }
              }
            } catch (e) {}
          }

          // Universal lowercase fallback for custom bundles
          if (nameStr) {
            const lower = nameStr.toLowerCase();
            if (lower !== nameStr) {
              try {
                if (containsMethod.bind(this).invoke(Il2Cpp.string(lower))) {
                  return true;
                }
              } catch (e) {}
            }
          }

          return false;
        };
      }
      Logger.log("[hookOnDeviceBundles] Hooked AssetBundle.LoadAsset & Contains for beatmap variant remapping");
    }

    Logger.log("[hookOnDeviceBundles] All on-device bundle hooks successfully registered.");
  } catch (e: any) {
    Logger.log(`[hookOnDeviceBundles] Error initializing hooks: ${e.message}`);
  }
};
