import Logger from "../lib/Logger.js";

/**
 * Official UI translations and song title/artist strings (4,500+ entries)
 * are served natively by HttpAssetServer from LangConfig.gz.
 * Dynamic and custom song info elements are populated directly via hookSongInfoElement.ts.
 */
export function songNameHack(): void {
  Logger.log("[songName] Official translations active via native LangConfig CMS delivery");
}
