import { StorageManager } from "../../lib/StorageManager.js";
import { DeviceFs } from "../../lib/DeviceFs.js";
import Logger from "../../lib/Logger.js";
import manifestData from "../../customs/manifest.json";

export interface CatalogSong {
  id: number;
  title: string;
  artist: string;
  bpm: number;
  difficulty: string;
  deluxe: boolean;
  bibleId: string;
  coverArtAssetId: string;
  baseColor: string;
  darkColor: string;
  chartPath: string;
  audioPath: string;
  bundlePath: string;
}

export class CatalogStore {
  private static songs: CatalogSong[] = [];
  private static loaded: boolean = false;

  static load(): void {
    if (this.loaded) return;
    
    // 1. Load from embedded static manifestData first
    try {
      if (manifestData && Array.isArray((manifestData as any).songs)) {
        const missingIds = [990];
        this.songs = ((manifestData as any).songs as CatalogSong[]).filter(
          (s: any) => !missingIds.includes(s.id) && s.id < 20000
        );
        Logger.log(
          `[CatalogStore] Loaded ${this.songs.length} valid official songs from static manifestData (Filtered broken tracks and phantom customs)`
        );
      }
    } catch (e: any) {
      Logger.log(`[CatalogStore] Error parsing static manifest: ${e.message}`);
    }

    // 2. Optional override from runtime storage if present
    const manifestPath = `${StorageManager.getStorageDir()}/manifest.json`;
    try {
      if (DeviceFs.exists(manifestPath)) {
        const raw = DeviceFs.readTextFileSync(manifestPath);
        const data = JSON.parse(raw);
        if (Array.isArray(data.songs) && data.songs.length > 0) {
          const missingIds = [990];
          this.songs = data.songs.filter(
            (s: any) => !missingIds.includes(s.id) && s.id < 20000
          );
          Logger.log(
            `[CatalogStore] Loaded ${this.songs.length} valid official songs from ${manifestPath}`
          );
        }
      }
    } catch (e: any) {}

    this.loaded = true;
  }

  static getSongs(): CatalogSong[] {
    this.load();
    return this.songs;
  }

  static getSongById(id: number): CatalogSong | undefined {
    this.load();
    return this.songs.find((s) => s.id === id);
  }
}
