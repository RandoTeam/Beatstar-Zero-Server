import Device from "../lib/Device.js";
import { StorageManager } from "../lib/StorageManager.js";
import { DeviceFs } from "../lib/DeviceFs.js";

export const saveDeviceId = () => {
  try {
    const id = Device.getAndroidId();
    const storageDir = StorageManager.getStorageDir();
    if (storageDir && id) {
      DeviceFs.writeFileSync(`${storageDir}/uuid.txt`, id);
    }
  } catch (e) {}
};
