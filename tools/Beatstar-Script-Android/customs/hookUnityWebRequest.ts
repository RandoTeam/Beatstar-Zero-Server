import Logger from "../lib/Logger.js";
import { StorageManager } from "../lib/StorageManager.js";

export const hookUnityWebRequest = () => {
  try {
    const baseDir = StorageManager.getStorageDir();
    const appFilesDir = StorageManager.getAppFilesDir();
    const stringKeepAlive: any[] = [];

    const mapUrlToLocalFile = (str: string): string => {
      if (str.includes("/covers/")) {
        const parts = str.split("/covers/");
        if (parts.length > 1) {
          const rawName = parts[1].split("?")[0];
          const hasExt = /\.(png|jpg|jpeg)$/i.test(rawName);
          const finalName = hasExt ? rawName : `${rawName}.png`;
          return `file://${baseDir}/covers/${finalName}`;
        }
      }
      if (str.includes("/streamedimages/")) {
        const parts = str.split("/streamedimages/");
        if (parts.length > 1) {
          const guid = parts[1].split("?")[0];
          return `file://${appFilesDir}/streamedimages/${guid}`;
        }
      }
      if (str.match(/\/trackSkin[a-zA-Z]+\//)) {
        const parts = str.split(/\/trackSkin[a-zA-Z]+\//);
        if (parts.length > 1) {
          const guid = parts[1].split("?")[0];
          return `file://${appFilesDir}/streamedimages/${guid}`;
        }
      }
      if (str.includes("/streamableemojis/") || str.includes("/emoji/")) {
        const parts = str.split(/\/(streamableemojis|emoji)\//);
        if (parts.length > 2) {
          const guid = parts[2].split("?")[0];
          return `file://${appFilesDir}/streamableemojis/${guid}`;
        }
      }
      // Fallback to local HTTP server for CMS or other CDN assets
      if (str.includes("assets.flamingo.newbirds.net") || str.includes("assets.beatstar.com") || str.includes("localhost:3570")) {
        return str.replace(/https?:\/\/(assets\.flamingo\.newbirds\.net|assets\.beatstar\.com|localhost:3570)/i, "http://127.0.0.1:5000");
      }
      return str;
    };

    const attachGetHook = (method: any) => {
      if (!method || !method.virtualAddress) return;
      Interceptor.attach(method.virtualAddress, {
        onEnter: function (args) {
          try {
            const uriPtr = args[0];
            if (!uriPtr || uriPtr.isNull()) return;
            const uriObj = new Il2Cpp.String(uriPtr);
            let str = uriObj.content || uriObj.toString();
            let originalStr = str;
            if (str && (str.includes("assets.flamingo.newbirds.net") || str.includes("assets.beatstar.com") || str.includes("localhost:3570") || str.includes("localhost:5000") || str.includes("127.0.0.1:5000"))) {
              str = mapUrlToLocalFile(str);
              if (str !== originalStr) {
                const newUri = Il2Cpp.string(str);
                stringKeepAlive.push(newUri);
                if (stringKeepAlive.length > 200) stringKeepAlive.shift();
                args[0] = newUri.handle;
                Logger.log(`[UnityWebRequest] Redirected CDN to: ${str}`);
              }
            }
          } catch (e) {}
        }
      });
    };

    const assembly = Il2Cpp.domain.assembly("UnityEngine.UnityWebRequestModule")?.image;
    if (assembly) {
      const uwr = assembly.class("UnityEngine.Networking.UnityWebRequest");
      if (uwr) {
        attachGetHook(uwr.method("Get", 1));

        const setUrl = uwr.method("set_url");
        if (setUrl) {
          setUrl.implementation = function (value: Il2Cpp.String) {
            if (value && !value.isNull()) {
              let str = value.content || value.toString();
              let originalStr = str;
              if (str && (str.includes("assets.flamingo.newbirds.net") || str.includes("assets.beatstar.com") || str.includes("localhost:3570") || str.includes("localhost:5000") || str.includes("127.0.0.1:5000"))) {
                str = mapUrlToLocalFile(str);
                if (str !== originalStr) {
                  value = Il2Cpp.string(str);
                  Logger.log(`[UnityWebRequest] (set_url) Redirected CDN to: ${str}`);
                }
              }
            }
            return setUrl.bind(this).invoke(value);
          };
        }
      }
    }

    const texAssembly = Il2Cpp.domain.assembly("UnityEngine.UnityWebRequestTextureModule")?.image;
    if (texAssembly) {
      const uwrTex = texAssembly.class("UnityEngine.Networking.UnityWebRequestTexture");
      if (uwrTex) {
        attachGetHook(uwrTex.method("GetTexture", 1));
        attachGetHook(uwrTex.method("GetTexture", 2));
      }
    }
    
    Logger.log("[hookUnityWebRequest] Installed native file:/// URI redirect hooks for UnityWebRequest");
  } catch (e: any) {
    Logger.log(`[hookUnityWebRequest] Error: ${e.message}`);
  }
};
