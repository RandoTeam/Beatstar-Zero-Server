import ClassResolver from "../lib/ClassResolver.js";
import Logger from "../lib/Logger.js";
import { CatalogStore } from "../server/models/CatalogStore.js";

export function hookSongInfoElement(): void {
  try {
    const SongInfoElement = ClassResolver.findClass("SongInfoElement", "Assembly-CSharp") 
                         || ClassResolver.findClass("SongInfoElement");
    if (!SongInfoElement) {
      Logger.log("[SongInfoElement] Class not found");
      return;
    }

    CatalogStore.load();
    const songs = CatalogStore.getSongs();
    const songMap = new Map<number, any>();
    for (const s of songs) {
      songMap.set(s.id, { 
        title: s.title, 
        artist: s.artist, 
        difficulty: s.difficulty,
        baseColor: s.baseColor,
        darkColor: s.darkColor
      });
    }

    // Pre-resolve IL2CPP field accessors at hook registration time to avoid
    // per-call reflection overhead in the hot path (called on every song list item)
    let cachedSongNameField: any = null;
    let cachedArtistNameField: any = null;
    let cachedDifficultyField: any = null;
    let cachedBeatmapSongIdField: any = null;
    let cachedSongTemplateIdField: any = null;

    try {
      cachedSongNameField = SongInfoElement.field("SongName");
    } catch (e) {}
    try {
      cachedArtistNameField = SongInfoElement.field("ArtistName");
    } catch (e) {}
    try {
      cachedDifficultyField = SongInfoElement.field("Difficulty");
    } catch (e) {}

    // Cache BeatmapTemplate.Song_id and SongTemplate.id field accessors
    try {
      const BeatmapTemplate = ClassResolver.findClass("BeatmapTemplate", "Assembly-CSharp")
                            || ClassResolver.findClass("BeatmapTemplate");
      if (BeatmapTemplate) cachedBeatmapSongIdField = BeatmapTemplate.field("Song_id");
    } catch (e) {}
    try {
      const SongTemplate = ClassResolver.findClass("SongTemplate", "Assembly-CSharp")
                         || ClassResolver.findClass("SongTemplate");
      if (SongTemplate) cachedSongTemplateIdField = SongTemplate.field("id");
    } catch (e) {}

    const parseHexColor = (hexStr: string) => {
      if (!hexStr) return null;
      const clean = hexStr.replace("#", "").trim();
      if (clean.length === 6) {
        const r = parseInt(clean.substring(0, 2), 16) / 255.0;
        const g = parseInt(clean.substring(2, 4), 16) / 255.0;
        const b = parseInt(clean.substring(4, 6), 16) / 255.0;
        return { r, g, b, a: 1.0 };
      }
      return null;
    };

    SongInfoElement.methods.forEach((m) => {
      if (m.name !== "Setup") return;

      m.implementation = function (...args: any[]) {
        try {
          const firstArg = args[0];
          if (!firstArg || firstArg.isNull()) {
            return;
          }

          // Safely call native setup.
          try {
            m.bind(this).invoke(...args);
          } catch (e: any) {}

          let songId = 0;
          let isBeatmap = false;
          try {
            const className = firstArg.class.name;
            if (className === "BeatmapTemplate") {
              isBeatmap = true;
              songId = cachedBeatmapSongIdField
                ? firstArg.field("Song_id").value
                : firstArg.field("Song_id").value;
            } else if (className === "SongTemplate") {
              songId = cachedSongTemplateIdField
                ? firstArg.field("id").value
                : firstArg.field("id").value;
            }
          } catch (e) {}

          if (songId > 0) {
            const catalogSong = songMap.get(songId);
            if (catalogSong) {
              // 1. Inject song title
              try {
                const songNameObj = this.field("SongName").value;
                if (songNameObj && !songNameObj.isNull()) {
                  songNameObj.method("set_text").invoke(Il2Cpp.string(catalogSong.title));
                }
              } catch (e) {}
              
              // 2. Inject artist name
              try {
                const artistNameObj = this.field("ArtistName").value;
                if (artistNameObj && !artistNameObj.isNull()) {
                  artistNameObj.method("set_text").invoke(Il2Cpp.string(catalogSong.artist));
                }
              } catch (e) {}

              // 3. Explicitly initialize Difficulty Element
              try {
                const diffObj = this.field("Difficulty").value;
                if (diffObj && !diffObj.isNull()) {
                  let variant = null;
                  if (isBeatmap) {
                    try { variant = firstArg.field("_BeatmapVariantReference").value; } catch (e) {}
                    if (!variant || variant.isNull()) {
                      try { variant = firstArg.method("get_BeatmapVariantReference").invoke(); } catch (e) {}
                    }
                  }

                  if (variant && !variant.isNull()) {
                    try {
                      const setupMethod = diffObj.method("Setup", 1);
                      if (setupMethod) setupMethod.invoke(variant);
                    } catch (e) {}
                  }

                  // Force activate visuals to ensure it's not hidden by native exception
                  try {
                    const visuals = diffObj.field("visuals").value;
                    if (visuals && !visuals.isNull()) {
                      visuals.method("SetActive").invoke(true);
                    } else {
                      const go = diffObj.method("get_gameObject").invoke();
                      if (go && !go.isNull()) go.method("SetActive").invoke(true);
                    }
                  } catch (e) {}
                }
              } catch (e) {}

              // 4. Tint background graphics if colors available
              try {
                if (catalogSong.baseColor) {
                  const baseCol = parseHexColor(catalogSong.baseColor);
                  if (baseCol) {
                    const baseGraphics = this.field("baseColorTintables").value;
                    if (baseGraphics && !baseGraphics.isNull()) {
                      const len = baseGraphics.length;
                      for (let i = 0; i < len; i++) {
                        const g = baseGraphics.get(i);
                        if (g && !g.isNull()) {
                          try { g.method("set_color").invoke(baseCol); } catch (e) {}
                        }
                      }
                    }
                  }
                }
              } catch (e) {}
            }
          }
        } catch (e: any) {
          Logger.log(`[SongInfoElement] Setup hook error: ${e.message}`);
        }
      };
    });

    Logger.log("[SongInfoElement] Successfully hooked ALL Setup overloads with Song_id resolution, Difficulty & Color Tinting");
  } catch (err: any) {
    Logger.log(`[SongInfoElement] Fatal error: ${err.message}`);
  }
}
