import { setCinta } from "../lib/Globals.js";
import { StorageManager } from "../lib/StorageManager.js";
import Logger from "../lib/Logger.js";

/**
 * Reads a cinta ID from the user file to authenticate a user.
 */
export const hookCintaId = () => {
  try {
    const loginRuntime = Il2Cpp.domain.assembly("SpaceApe.Login.Runtime").image;
    const provider = loginRuntime.class("CintaProvider");
    if (provider) {
      provider.method("get_Cinta").implementation = function () {
        const u = StorageManager.getUserUuid();
        Logger.log(`[CintaProvider] get_Cinta called -> ${u}`);
        const cinta = Il2Cpp.string(u);
        setCinta(cinta.content);
        return cinta;
      };
    }
  } catch (e: any) {
    Logger.log(`[hookCintaId] Error: ${e.message}`);
  }
};
