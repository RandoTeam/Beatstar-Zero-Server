import Logger from "./Logger.js";
import { StorageManager } from "./StorageManager.js";
import { DeviceFs } from "./DeviceFs.js";

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface Settings {
  serverIp: string;
  serverPort: number;
  serverExpressPort: number;
  graphics?: "low" | "med" | "high" | "high_120";
  loadScript?: string;
  aPlusColor?: Color;
  aColor?: Color;
  bColor?: Color;
  logErrors?: string;
  fps?: number;
  offline?: string;
  fakeVersion?: string;
}

class SettingsReader {
  settings: Settings = {
    serverIp: "127.0.0.1",
    serverPort: 3000,
    serverExpressPort: 5000,
    graphics: "high_120",
    offline: "true",
    loadScript: "true",
  };
  private initialized: boolean = false;

  init() {
    if (this.initialized) return;
    try {
      const storageDir = StorageManager.getStorageDir();
      const settingsPath = `${storageDir}/settings.json`;
      if (DeviceFs.exists(settingsPath)) {
        const raw = DeviceFs.readTextFileSync(settingsPath);
        const parsed = JSON.parse(raw);
        this.settings = { ...this.settings, ...parsed };
      } else {
        try {
          DeviceFs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2));
        } catch (e) {}
      }
    } catch (e: any) {
      Logger.log(`[SettingsReader] Init error: ${e.message}`);
    }
    this.initialized = true;
  }

  getSetting<K extends keyof Settings>(setting: K): Settings[K] {
    if (!this.initialized) this.init();
    return this.settings?.[setting];
  }
}

export default new SettingsReader();
