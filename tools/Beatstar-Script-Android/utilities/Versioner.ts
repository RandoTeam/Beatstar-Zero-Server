import { StorageManager } from "../lib/StorageManager.js";
import { DeviceFs } from "../lib/DeviceFs.js";
import Logger from "../lib/Logger.js";

const getLocalVersion = () => {
  try {
    const p = `${StorageManager.getStorageDir()}/script/version`;
    if (DeviceFs.exists(p)) {
      return DeviceFs.readTextFileSync(p);
    }
  } catch (e: any) {
    Logger.log(`Failed to get local version: ${e.message}`);
  }
  return "1.0.60";
};

const getLiveVersion = async (): Promise<string | null> => {
  return "1.0.60";
};

export { getLocalVersion, getLiveVersion };
