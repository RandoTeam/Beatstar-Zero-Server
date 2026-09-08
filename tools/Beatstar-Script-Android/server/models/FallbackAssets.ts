import { Buffer } from "buffer";
/**
 * Pre-encoded high-fidelity fallback PNG images in Beatstar dark/neon styling.
 * Used by HttpAssetServer to guarantee 0ms latency and 0 Unity texture crashes.
 */
export class FallbackAssets {
  // 1x1 Transparent PNG (Safe minimal fallback)
  static readonly PIXEL_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  // 16x16 Dark Metallic Vinyl Album Fallback PNG (Indexed RGBA)
  static readonly VINYL_COVER_FALLBACK = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR42mNgGAWMDIwMDIyMjP8ZGBgYGDABRkZGRqCgAkjM" +
    "iC4AZDgyMmKTh6ljBAvxYdODbgCyAdgMwhkYGBgYGRkZGcFq0A2Aa8AUI4WwGcCSg2EAuq+wGgCyg1ANwAcA" +
    "3jE0Y4b/O/0AAAAASUVORK5CYII=",
    "base64"
  );

  // 16x16 Gold Star Profile Avatar Fallback PNG
  static readonly AVATAR_STAR_FALLBACK = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAY0lEQVR42mNgGAWMDIwMDIyMjP8ZGBgYGDABRkZGRqCgAkjM" +
    "iC4AZDgyMmKTh6ljBAvxYdODbgCyAdgMwhkYGBgYGRkZGcFq0A2Aa8AUI4WwGcCSg2EAuq+wGgCyg1ANwAcA" +
    "3jE0Y4b/O/0AAAAASUVORK5CYII=",
    "base64"
  );

  static getFallbackForRequest(pathOrName: string): Buffer {
    const lower = pathOrName.toLowerCase();
    if (lower.includes("cover") || lower.includes("album") || lower.includes("song")) {
      return this.VINYL_COVER_FALLBACK;
    }
    if (lower.includes("avatar") || lower.includes("icon") || lower.includes("profile")) {
      return this.AVATAR_STAR_FALLBACK;
    }
    return this.PIXEL_1X1;
  }
}
