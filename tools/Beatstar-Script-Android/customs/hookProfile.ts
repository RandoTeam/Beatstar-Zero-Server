import Logger from "../lib/Logger.js";
import ClassResolver from "../lib/ClassResolver.js";
import { ProfileStore } from "../server/models/ProfileStore.js";
import { customSongs } from "../lib/Globals.js";

/**
 * Offline Profile Hook:
 * Sets the player name and numGoldDiscBoxesOpened on MyProfileTO via SharplaLocalStorage.Load.
 * NOTE: Player stats (level, stars, score) are NOT set here — they come from SyncResp protobuf
 * via GameService (ScoreTrackerTO, StarMilestonesTO). PlayerBasicInfoTO has no stats fields.
 */
export const hookProfile = () => {
  try {
    const storageClass = ClassResolver.findClass("Sharpla.SharplaLocalStorage", "SharplaLegacyClient")
      || ClassResolver.findClass("Sharpla.SharplaLocalStorage", "SharplaClient")
      || ClassResolver.findClass("Sharpla.SharplaLocalStorage");

    if (storageClass) {
      Logger.log("[hookProfile] Hooking SharplaLocalStorage.Load...");
      storageClass.methods.forEach(m => {
        if (m.name === "Load" && m.returnType.name !== "System.Void") {
          m.implementation = function (...args: any[]) {
            let profile: any = null;
            try {
              profile = m.bind(this).invoke(...args);
            } catch (e: any) {
              Logger.log(`[hookProfile] Original Load failed (${e.message})`);
            }

            const current = ProfileStore.getProfile();

            const setFieldSafe = (obj: any, fieldName: string, val: any) => {
              try {
                if (obj && !obj.isNull()) obj.field(fieldName).value = val;
              } catch (e) {}
            };

            const populateProfile = (prof: any) => {
              if (!prof || prof.isNull()) return;

              setFieldSafe(prof, "name", Il2Cpp.string(current.username || "Player"));
              setFieldSafe(prof, "numGoldDiscBoxesOpened", 10);

              // NOTE: PlayerBasicInfoTO (Android dump L351684) only has:
              //   - saCustomImageKey (0x18)
              //   - deprecatedFacebookAppScopedId (0x20)
              // Level, stars, score, experience, beatmapsPlayed do NOT exist on PlayerBasicInfoTO.
              // These stats are delivered via SyncResp protobuf (ScoreTrackerTO, StarMilestonesTO).
              // Previous attempts to write these fields silently failed (caught by try/catch).
            };

            if (!profile || profile.isNull()) {
              try {
                const myProfileClass = ClassResolver.findClass("com.spaceape.flamingo.model.MyProfileTO")
                  || ClassResolver.findClass("com.spaceape.flamingo.model.MyProfileTO", "SharplaModel")
                  || ClassResolver.findClass("com.spaceape.flamingo.model.MyProfileTO", "RakshaModel");

                if (myProfileClass) {
                  profile = myProfileClass.new();
                  try { profile.method(".ctor").invoke(); } catch (e) {}
                  populateProfile(profile);
                  Logger.log(`[hookProfile] Instantiated fresh MyProfileTO (${current.username})`);
                }
              } catch (e: any) {
                Logger.log(`[hookProfile] Error constructing fallback profile: ${e.message}`);
              }
            } else {
              populateProfile(profile);
            }

            return profile || Il2Cpp.Object.from(ptr(0));
          };
        }
      });
    }

    // 2. Hook UserBeatmaps: IsOwned, GetOwnedBeatmap, and SubCmd_UnlockSong
    const userBeatmapsClass = ClassResolver.findClass("UserBeatmaps", "Assembly-CSharp")
      || ClassResolver.findClass("UserBeatmaps");
    if (userBeatmapsClass) {
      // 2a. IsOwned -> always true (UI unlocking)
      const isOwned = ClassResolver.tryMethod(userBeatmapsClass, "IsOwned", 1);
      if (isOwned) {
        isOwned.implementation = function (beatmapTemplate: any) {
          if (!beatmapTemplate || beatmapTemplate.isNull()) return false;
          return true;
        };
        Logger.log("[hookProfile] Hooked UserBeatmaps.IsOwned -> true");
      }

      // 2b. GetOwnedBeatmap -> Safe fallback for custom songs (id >= 10000)
      const getOwnedBeatmap = ClassResolver.tryMethod(userBeatmapsClass, "GetOwnedBeatmap", 1);
      if (getOwnedBeatmap) {
        const synthesizedCache = new Map<number, any>();
        getOwnedBeatmap.implementation = function (beatmapTemplate: any) {
          try {
            const originalResult = getOwnedBeatmap.bind(this).invoke(beatmapTemplate);
            if (originalResult && !originalResult.isNull()) {
              return originalResult;
            }
          } catch (e) {}

          // If original returns null (e.g. custom song), synthesize BeatmapTO on the fly
          try {
            if (beatmapTemplate && !beatmapTemplate.isNull()) {
              const songId = Number(beatmapTemplate.field("id")?.value || 0);
              if (songId > 0 && synthesizedCache.has(songId)) {
                return synthesizedCache.get(songId);
              }

              const cmdCreate = this.tryMethod("Cmd_CreateBeatmapTO") || this.method("Cmd_CreateBeatmapTO", 2);
              if (cmdCreate) {
                const synthesized = cmdCreate.bind(this).invoke(beatmapTemplate, 11);
                if (synthesized && !synthesized.isNull()) {
                  if (songId > 0) synthesizedCache.set(songId, synthesized);
                  return synthesized;
                }
              }
            }
          } catch (e: any) {
            Logger.log(`[hookProfile] GetOwnedBeatmap fallback error: ${e.message}`);
          }
          return Il2Cpp.Object.from(ptr(0));
        };
        Logger.log("[hookProfile] Hooked UserBeatmaps.GetOwnedBeatmap with synthesized fallback");
      }
      // 2c. SubCmd_UnlockSong — guard against duplicate insertions using a local Set
      // IMPORTANT: We cannot use this.IsOwned() as guard because it's hooked to always return true,
      // which would prevent ALL songs from ever being added to Data.beatmaps.
      const unlockSong = ClassResolver.tryMethod(userBeatmapsClass, "SubCmd_UnlockSong", 4);
      if (unlockSong) {
        const processedUnlockIds = new Set<number>();
        unlockSong.implementation = function (song: any, rewardSource: any, transaction: any, parentStep: any) {
          try {
            if (song && !song.isNull()) {
              const songId = song.field("id").value as number;
              if (processedUnlockIds.has(songId)) {
                return; // Already processed this session, skip duplicate
              }
              processedUnlockIds.add(songId);
            }
          } catch (e) {}
          try {
            return unlockSong.bind(this).invoke(song, rewardSource, transaction, parentStep);
          } catch (e: any) {
            Logger.log(`[hookProfile] SubCmd_UnlockSong invoke error (non-fatal): ${e.message}`);
          }
        };
        Logger.log("[hookProfile] Guarded UserBeatmaps.SubCmd_UnlockSong against duplicates (Set-based)");
      }
    }

    // 3. Helper to look up LiveOpsTrackSkinTemplate by ID from Config
    const getSkinTemplateById = (skinId: number): any => {
      try {
        if (!skinId || skinId === 0) return null;
        const configClass = ClassResolver.findClass("Config", "Assembly-CSharp") || ClassResolver.findClass("Config");
        if (configClass) {
          const getSkinConfig = configClass.tryMethod("get_LiveOpsTrackSkinConfig") || configClass.method("get_LiveOpsTrackSkinConfig", 0);
          let skinConfig: any = null;
          if (getSkinConfig) {
            try { skinConfig = getSkinConfig.invoke(); } catch (e) {}
          }
          if (!skinConfig || skinConfig.isNull()) {
            const root = configClass.field("Root")?.value;
            if (root && !root.isNull()) {
              try { skinConfig = root.field("liveOpsTrackSkinConfig")?.value; } catch (e) {}
              if (!skinConfig || skinConfig.isNull()) {
                try { skinConfig = root.field("LiveOpsTrackSkinConfig")?.value; } catch (e) {}
              }
            }
          }
          if (skinConfig && !skinConfig.isNull()) {
            const getSkinMethod = skinConfig.class.method("GetLiveOpsTrackSkinById", 1);
            if (getSkinMethod) {
              const template = getSkinMethod.bind(skinConfig).invoke(skinId);
              if (template && !template.isNull()) return template;
            }
          }
        }
      } catch (e: any) {
        Logger.log(`[hookProfile] getSkinTemplateById error: ${e.message}`);
      }
      return null;
    };

    // 4. Hook UserTrackSkins for Offline Track Skins Persistence & Direct Theme Resolution
    try {
      const userTrackSkinsClass = ClassResolver.findClass("UserTrackSkins", "Assembly-CSharp")
        || ClassResolver.findClass("UserTrackSkins");
      if (userTrackSkinsClass) {
        // 4a. Hook GetSelectedTrackSkinForGenre (2 params: genreTemplate, fallbackToGlobalSkin)
        const getSelectedWithFallback = ClassResolver.tryMethod(userTrackSkinsClass, "GetSelectedTrackSkinForGenre", 2);
        if (getSelectedWithFallback) {
          getSelectedWithFallback.implementation = function (genreTemplate: any, fallbackToGlobalSkin: any) {
            try {
              const profile = ProfileStore.getProfile();
              let skinId = 0;
              if (genreTemplate && !genreTemplate.isNull()) {
                try {
                  const genreId = Number(genreTemplate.field("id")?.value || 0);
                  if (genreId && profile.genreSkins && profile.genreSkins[genreId]) {
                    skinId = profile.genreSkins[genreId];
                  }
                } catch (e) {}
              }
              if (!skinId && profile.globalSkinId) {
                skinId = profile.globalSkinId;
              }
              if (skinId) {
                const tmpl = getSkinTemplateById(skinId);
                if (tmpl && !tmpl.isNull()) {
                  return tmpl;
                }
              }
            } catch (e: any) {}
            return getSelectedWithFallback.bind(this).invoke(genreTemplate, fallbackToGlobalSkin);
          };
          Logger.log("[hookProfile] Hooked UserTrackSkins.GetSelectedTrackSkinForGenre(2)");
        }

        // 4b. Hook GetSelectedTrackSkinForGenre (1 param: genreTemplate)
        const getSelectedSingle = ClassResolver.tryMethod(userTrackSkinsClass, "GetSelectedTrackSkinForGenre", 1);
        if (getSelectedSingle) {
          getSelectedSingle.implementation = function (genreTemplate: any) {
            try {
              const profile = ProfileStore.getProfile();
              let skinId = 0;
              if (genreTemplate && !genreTemplate.isNull()) {
                try {
                  const genreId = Number(genreTemplate.field("id")?.value || 0);
                  if (genreId && profile.genreSkins && profile.genreSkins[genreId]) {
                    skinId = profile.genreSkins[genreId];
                  }
                } catch (e) {}
              }
              if (!skinId && profile.globalSkinId) {
                skinId = profile.globalSkinId;
              }
              if (skinId) {
                const tmpl = getSkinTemplateById(skinId);
                if (tmpl && !tmpl.isNull()) {
                  return tmpl;
                }
              }
            } catch (e: any) {}
            return getSelectedSingle.bind(this).invoke(genreTemplate);
          };
          Logger.log("[hookProfile] Hooked UserTrackSkins.GetSelectedTrackSkinForGenre(1)");
        }

        // 4c. Hook GetDefaultTrackSkinTemplate -> returns active global skin if set
        const getDefaultSkin = ClassResolver.tryMethod(userTrackSkinsClass, "GetDefaultTrackSkinTemplate", 0);
        if (getDefaultSkin) {
          getDefaultSkin.implementation = function () {
            try {
              const profile = ProfileStore.getProfile();
              if (profile.globalSkinId) {
                const tmpl = getSkinTemplateById(profile.globalSkinId);
                if (tmpl && !tmpl.isNull()) return tmpl;
              }
            } catch (e) {}
            return getDefaultSkin.bind(this).invoke();
          };
          Logger.log("[hookProfile] Hooked UserTrackSkins.GetDefaultTrackSkinTemplate");
        }

        // 4d. Hook Cmd_SetGlobalTrackSkin -> persist to ProfileStore
        const setGlobalSkin = ClassResolver.tryMethod(userTrackSkinsClass, "Cmd_SetGlobalTrackSkin", 1);
        if (setGlobalSkin) {
          setGlobalSkin.implementation = function (trackSkinTmpl: any) {
            try {
              if (trackSkinTmpl && !trackSkinTmpl.isNull()) {
                const skinId = Number(trackSkinTmpl.field("id")?.value || 0);
                if (skinId) {
                  Logger.log(`[hookProfile] Cmd_SetGlobalTrackSkin -> Persisting skin ID: ${skinId}`);
                  ProfileStore.setSkin(skinId);
                }
              }
            } catch (e: any) {
              Logger.log(`[hookProfile] Cmd_SetGlobalTrackSkin error: ${e.message}`);
            }
            return setGlobalSkin.bind(this).invoke(trackSkinTmpl);
          };
          Logger.log("[hookProfile] Hooked UserTrackSkins.Cmd_SetGlobalTrackSkin with offline disk save");
        }

        // 4e. Hook Cmd_SetTrackSkinForGenre -> persist to ProfileStore
        const setGenreSkin = ClassResolver.tryMethod(userTrackSkinsClass, "Cmd_SetTrackSkinForGenre", 2);
        if (setGenreSkin) {
          setGenreSkin.implementation = function (genreTmpl: any, trackSkinTmpl: any) {
            try {
              if (trackSkinTmpl && !trackSkinTmpl.isNull()) {
                const skinId = Number(trackSkinTmpl.field("id")?.value || 0);
                let genreId = 0;
                if (genreTmpl && !genreTmpl.isNull()) {
                  genreId = Number(genreTmpl.field("id")?.value || 0);
                }
                if (skinId) {
                  Logger.log(`[hookProfile] Cmd_SetTrackSkinForGenre -> Genre: ${genreId}, Skin: ${skinId}`);
                  ProfileStore.setSkin(skinId, genreId);
                }
              }
            } catch (e: any) {
              Logger.log(`[hookProfile] Cmd_SetTrackSkinForGenre error: ${e.message}`);
            }
            return setGenreSkin.bind(this).invoke(genreTmpl, trackSkinTmpl);
          };
          Logger.log("[hookProfile] Hooked UserTrackSkins.Cmd_SetTrackSkinForGenre with offline disk save");
        }

        // 4f. Hook IsTrackSkinUnlocked -> return true (unlock all track skins in UI)
        const isSkinUnlocked = ClassResolver.tryMethod(userTrackSkinsClass, "IsTrackSkinUnlocked", 1);
        if (isSkinUnlocked) {
          isSkinUnlocked.implementation = function () {
            return true;
          };
          Logger.log("[hookProfile] Hooked UserTrackSkins.IsTrackSkinUnlocked -> true");
        }

        // 4g. Hook GetOwnedTrackSkinsForGenre -> return GetAllTrackSkinsForGenre
        const getOwnedGenre = ClassResolver.tryMethod(userTrackSkinsClass, "GetOwnedTrackSkinsForGenre", 1);
        if (getOwnedGenre) {
          getOwnedGenre.implementation = function (this: Il2Cpp.Object, genreTmpl: any) {
            try {
              const getAll = this.class.method("GetAllTrackSkinsForGenre", 1) || this.tryMethod("GetAllTrackSkinsForGenre");
              if (getAll) return getAll.bind(this).invoke(genreTmpl);
            } catch (e: any) {}
            return getOwnedGenre.bind(this).invoke(genreTmpl);
          };
          Logger.log("[hookProfile] Hooked UserTrackSkins.GetOwnedTrackSkinsForGenre -> GetAllTrackSkinsForGenre");
        }

        // 4h. Hook GetOwnedTrackSkinsWithNoGenre -> return GetAllTrackSkinsWithNoGenre
        const getOwnedNoGenre = ClassResolver.tryMethod(userTrackSkinsClass, "GetOwnedTrackSkinsWithNoGenre", 0);
        if (getOwnedNoGenre) {
          getOwnedNoGenre.implementation = function (this: Il2Cpp.Object) {
            try {
              const getAll = this.class.method("GetAllTrackSkinsWithNoGenre", 0) || this.tryMethod("GetAllTrackSkinsWithNoGenre");
              if (getAll) return getAll.bind(this).invoke();
            } catch (e: any) {}
            return getOwnedNoGenre.bind(this).invoke();
          };
          Logger.log("[hookProfile] Hooked UserTrackSkins.GetOwnedTrackSkinsWithNoGenre -> GetAllTrackSkinsWithNoGenre");
        }
      }
    } catch (e: any) {
      Logger.log(`[hookProfile] Error hooking UserTrackSkins: ${e.message}`);
    }

    // Hook UserCallingCards for unlocking all banners
    try {
      const userCallingCardsClass = ClassResolver.findClass("UserCallingCards", "Assembly-CSharp")
        || ClassResolver.findClass("UserCallingCards");
      if (userCallingCardsClass) {
        const isCardUnlocked = ClassResolver.tryMethod(userCallingCardsClass, "IsCallingCardUnlocked", 1);
        if (isCardUnlocked) {
          isCardUnlocked.implementation = function () {
            return true;
          };
          Logger.log("[hookProfile] Hooked UserCallingCards.IsCallingCardUnlocked -> true");
        }
      }
    } catch (e: any) {
      Logger.log(`[hookProfile] Error hooking UserCallingCards: ${e.message}`);
    }

    // Hook UserEmojis for unlocking all emojis
    try {
      const userEmojisClass = ClassResolver.findClass("UserEmojis", "Assembly-CSharp")
        || ClassResolver.findClass("UserEmojis");
      if (userEmojisClass) {
        const getUnlockedEmojis = ClassResolver.tryMethod(userEmojisClass, "get_UnlockedEmojis", 0);
        if (getUnlockedEmojis) {
          getUnlockedEmojis.implementation = function (this: Il2Cpp.Object) {
            try {
              const emojiConfig = this.field("liveOpsEmojiConfig")?.value as Il2Cpp.Object;
              if (emojiConfig && !emojiConfig.isNull()) {
                const emojis = emojiConfig.field("LiveOpsEmojis")?.value;
                if (emojis && !emojis.isNull()) return emojis;
              }
            } catch (e: any) {}
            return getUnlockedEmojis.bind(this).invoke();
          };
          Logger.log("[hookProfile] Hooked UserEmojis.get_UnlockedEmojis -> LiveOpsEmojis array");
        }
      }
    } catch (e: any) {
      Logger.log(`[hookProfile] Error hooking UserEmojis: ${e.message}`);
    }

    // 5. Hook RhythmGameTrackSkinProvider.CalculateTrackSkin for in-game theme injection
    try {
      const skinProviderClass = ClassResolver.findClass("RhythmGameTrackSkinProvider", "Assembly-CSharp")
        || ClassResolver.findClass("RhythmGameTrackSkinProvider");
      if (skinProviderClass) {
        const calcTrackSkin = ClassResolver.tryMethod(skinProviderClass, "CalculateTrackSkin", 2);
        if (calcTrackSkin) {
          calcTrackSkin.implementation = function (gameSetup: any, userTrackSkins: any) {
            try {
              const profile = ProfileStore.getProfile();
              let skinId = profile.globalSkinId || 0;
              if (gameSetup && !gameSetup.isNull()) {
                try {
                  const beatmap = gameSetup.field("beatmapTemplate")?.value;
                  if (beatmap && !beatmap.isNull()) {
                    const song = beatmap.field("_Song")?.value;
                    if (song && !song.isNull()) {
                      const genres = song.field("GenreTags_id")?.value;
                      if (genres && genres.length > 0) {
                        const gId = Number(genres.get(0));
                        if (profile.genreSkins && profile.genreSkins[gId]) {
                          skinId = profile.genreSkins[gId];
                        }
                      }
                    }
                  }
                } catch (e) {}
              }
              if (skinId) {
                const tmpl = getSkinTemplateById(skinId);
                if (tmpl && !tmpl.isNull()) {
                  Logger.log(`[RhythmGameTrackSkinProvider] CalculateTrackSkin returning custom skin: ${skinId}`);
                  return tmpl;
                }
              }
            } catch (e: any) {
              Logger.log(`[hookProfile] CalculateTrackSkin error: ${e.message}`);
            }
            try {
              const original = calcTrackSkin.bind(this).invoke(gameSetup, userTrackSkins);
              if (original && !original.isNull()) return original;
            } catch (e: any) {}
            if (userTrackSkins && !userTrackSkins.isNull()) {
              try {
                const getDefault = userTrackSkins.class.method("GetDefaultTrackSkinTemplate", 0);
                if (getDefault) {
                  const defSkin = getDefault.bind(userTrackSkins).invoke();
                  if (defSkin && !defSkin.isNull()) return defSkin;
                }
              } catch (e) {}
            }
            return Il2Cpp.Object.from(ptr(0));
          };
          Logger.log("[hookProfile] Hooked RhythmGameTrackSkinProvider.CalculateTrackSkin with guaranteed fallback");
        }
      }
    } catch (e: any) {
      Logger.log(`[hookProfile] Error hooking RhythmGameTrackSkinProvider: ${e.message}`);
    }

    // 6. Unlock all songs across Journey, Venues, and Boxes in the client UI
    try {
      const campaignSongsSystemClass = ClassResolver.findClass("CampaignSongsSystem", "Assembly-CSharp")
        || ClassResolver.findClass("CampaignSongsSystem");
      if (campaignSongsSystemClass) {
        const isPlayable = ClassResolver.tryMethod(campaignSongsSystemClass, "IsUserPlayable", 1);
        if (isPlayable) {
          isPlayable.implementation = function (_beatmapTemplate: any) {
            return true;
          };
          Logger.log("[hookProfile] Hooked CampaignSongsSystem.IsUserPlayable -> true");
        }

        const isAvailableInRank = ClassResolver.tryMethod(campaignSongsSystemClass, "IsSongAvailableInUserRank", 1);
        if (isAvailableInRank) {
          isAvailableInRank.implementation = function (_beatmap: any) {
            return true;
          };
          Logger.log("[hookProfile] Hooked CampaignSongsSystem.IsSongAvailableInUserRank -> true");
        }

        const findUnowned = ClassResolver.tryMethod(campaignSongsSystemClass, "FindIfAnyUnownedBeatmapsInUserCampaign", 0);
        if (findUnowned) {
          findUnowned.implementation = function () {
            return false;
          };
          Logger.log("[hookProfile] Hooked CampaignSongsSystem.FindIfAnyUnownedBeatmapsInUserCampaign -> false");
        }
      }
    } catch (e: any) {
      Logger.log(`[hookProfile] Error hooking CampaignSongsSystem: ${e.message}`);
    }

    try {
      const songListSongElementClass = ClassResolver.findClass("SongListSongElement", "Assembly-CSharp")
        || ClassResolver.findClass("SongListSongElement");
      if (songListSongElementClass) {
        const getIsUnlocked = ClassResolver.tryMethod(songListSongElementClass, "get_IsUnlocked", 0);
        if (getIsUnlocked) {
          getIsUnlocked.implementation = function () {
            return true;
          };
          Logger.log("[hookProfile] Hooked SongListSongElement.get_IsUnlocked -> true");
        }
      }
    } catch (e: any) {
      Logger.log(`[hookProfile] Error hooking SongListSongElement: ${e.message}`);
    }

    Logger.log("[hookProfile] Profile hooks registered successfully");
  } catch (e: any) {
    Logger.log(`[hookProfile] Registration error: ${e.message}`);
  }
};

