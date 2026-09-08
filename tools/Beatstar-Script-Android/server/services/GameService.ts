import { createBatchRequest } from "@externaladdress4401/beatstar-protobuf/protos/BatchRequest";
import {
  SyncReq,
  SyncReqEnum,
} from "@externaladdress4401/beatstar-protobuf/protos/SyncReq";
import { ExecuteSharplaAuditReqEnums } from "@externaladdress4401/beatstar-protobuf/protos/ExecuteSharplaAuditReq";
import { SyncResp } from "@externaladdress4401/beatstar-protobuf/protos/SyncResp";
import { ExecuteSharplaAuditResp } from "@externaladdress4401/beatstar-protobuf/protos/ExecuteSharplaAuditResp";
import {
  createExecuteSharplaAuditResp,
  createServerClientMessageHeader,
  createSyncResp,
} from "@externaladdress4401/beatstar-protobuf/responses";
import { createEmptyResponse } from "@externaladdress4401/beatstar-protobuf/utils";
import { Client } from "../Client.js";
import { Packet } from "../Packet.js";
import { BaseService } from "./BaseService.js";
import { ProfileStore } from "../models/ProfileStore.js";
import missingIds from "../../customs/missingBeatmapIds.json";
import { CatalogStore } from "../models/CatalogStore.js";
import { LiveOpsEngine } from "../models/LiveOpsEngine.js";
import { toArray } from "../utilities/toArray.js";
import allVisuals from "../../customs/allVisualIds.json";
import Logger from "../../lib/Logger.js";

const RpcType = {
  5: "Sync",
  28: "ExecuteAudit",
} as const;

// Patch ExecuteSharplaAuditReqEnums to register missing audit types
// IL2CPP dump: SetCallingCard_SharplaAudit._PolymorphicId=75 (field: callingCard_id varint)
//              SetProfileIcon_SharplaAudit._PolymorphicId=111 (field: profileIcon_id varint)
//              SetGlobalTrackSkin_SharplaAudit._PolymorphicId=112 (field: trackSkin_id varint)
try {
  const auditGroup = ExecuteSharplaAuditReqEnums.get(1);
  if (auditGroup && auditGroup.fields) {
    const typeField = auditGroup.fields.get(1);
    if (typeField && typeField.enums) {
      const callingCardFields = new Map([[1, { name: "callingCard_id", type: "varint" }]]);
      const profileIconFields = new Map([[1, { name: "profileIcon_id", type: "varint" }]]);
      const trackSkinFields = new Map([
        [1, { name: "trackSkin_id", type: "varint" }],
        [2, { name: "trackSkin_id_2", type: "varint" }],
        [3, { name: "trackSkin_id_3", type: "varint" }]
      ]);
      const genreTrackSkinFields = new Map([
        [1, { name: "genre_id", type: "varint" }],
        [2, { name: "trackSkin_id", type: "varint" }]
      ]);
      const addRoosterFields = new Map([
        [1, { name: "query", type: "string" }],
        [2, { name: "openEnded", type: "bool" }],
      ]);
      const markSeenDatedRoosterFields = new Map([
        [1, { name: "key", type: "varint" }],
        [2, { name: "dateMsecs", type: "varint" }],
      ]);
      const markSeenRoosterFields = new Map([
        [1, { name: "query", type: "string" }],
        [2, { name: "openEnded", type: "bool" }],
        [3, { name: "queries", type: "string-repeat" }],
      ]);
      const markSeenStringDatedRoosterFields = new Map([
        [1, { name: "key", type: "string" }],
        [2, { name: "dateMsecs", type: "varint" }],
      ]);
      const removeSeenStringDatedRoosterFields = new Map([
        [1, { name: "query", type: "string" }],
        [2, { name: "openEnded", type: "bool" }],
        [3, { name: "queries", type: "string-repeat" }],
      ]);

      if (!typeField.enums[6]) typeField.enums[6] = markSeenRoosterFields;
      if (!typeField.enums[13]) typeField.enums[13] = addRoosterFields;
      if (!typeField.enums[24]) typeField.enums[24] = markSeenDatedRoosterFields;
      if (!typeField.enums[29]) typeField.enums[29] = markSeenStringDatedRoosterFields;
      if (!typeField.enums[36]) typeField.enums[36] = removeSeenStringDatedRoosterFields;
      if (!typeField.enums[75]) typeField.enums[75] = callingCardFields;
      if (!typeField.enums[110]) typeField.enums[110] = genreTrackSkinFields;
      if (!typeField.enums[111]) typeField.enums[111] = profileIconFields;
      if (!typeField.enums[112]) typeField.enums[112] = trackSkinFields;
    }
  }
} catch (e: any) {
  Logger.log(`[GameService] Audit enum patch error: ${e.message}`);
}

const BatchRequest = createBatchRequest({
  5: SyncReqEnum,
  28: ExecuteSharplaAuditReqEnums,
});

const RequestType = {
  MarkSeenRooster: 6,
  SetSelectedSong: 8,
  RhythmGameStarted: 11,
  RhythmGameEnded: 12,
  AddRooster: 13,
  MarkSeenDatedRooster: 24,
  MarkSeenStringDatedRooster: 29,
  ShopSystemRefresh: 30,
  SetFtueFlag: 33,
  RemoveSeenStringDatedRooster: 36,
  RefreshBonusCardsSystem: 58,
  SetCallingCard: 75,
  SetCustomization: 100,
  SetTrackSkinForGenre: 110,
  SetProfileIcon: 111,
  SetGlobalTrackSkin: 112,
} as const;

export class GameService extends BaseService {
  name = "gameservice";

  async handlePacket(packet: Packet, client: Client) {
    let parsedPayload: any;
    try {
      parsedPayload = packet.parsePayload(BatchRequest);
    } catch (e: any) {
      Logger.log(`[GameService] BatchRequest parse error: ${e.message}`);
      return;
    }

    const requests = toArray(parsedPayload.requests);
    const responses: any[] = [];

    for (const request of requests) {
      const rpcType = (RpcType as any)[Number(request.rpcType)];

      if (rpcType === "Sync") {
        Logger.log("[GameService] Handling Sync request");
        const profile = ProfileStore.getProfile();
        const songs = CatalogStore.getSongs();

        const unlockedSongs = profile.unlockAllSongs 
          ? songs 
          : songs.filter((s) => profile.unlockedSongIds?.includes(s.id));

        const beatmapsList: any[] = unlockedSongs.map((s) => {
          const score = ProfileStore.getScore(s.id);
          const entry: any = {
            template_id: s.id,
            BragState: {},
            HighestScore: score?.absoluteScore
              ? {
                  normalizedScore: score.normalizedScore || 0,
                  absoluteScore: score.absoluteScore,
                }
              : {},
            HighestCheckpoint: score?.highestCheckpoint || 0,
            HighestStreak: score?.highestStreak || 0,
            PlayedCount: score?.playedCount || 0,
            RewardedSource: 11, // StarMilestone unlock
            Version: 1,
            absoluteScore: score?.absoluteScore || 0,
          };
          if (score?.highestGrade && score.highestGrade > 0) {
            entry.HighestGrade_id = score.highestGrade;
          }
          return entry;
        });

        const existingIds = new Set(unlockedSongs.map((s) => s.id));
        for (const tid of missingIds) {
          if (!existingIds.has(tid)) {
            beatmapsList.push({
              template_id: tid,
              BragState: {},
              HighestScore: {},
              HighestCheckpoint: 0,
              HighestStreak: 0,
              PlayedCount: 0,
              RewardedSource: 11,
              Version: 1,
              absoluteScore: 0,
            });
          }
        }

        const totalStars = ProfileStore.getTotalStars();
        const syncRespObj = createSyncResp({
          "{username}": profile.username,
          "{beatmaps}": beatmapsList,
          "{NewsFeedStories}": LiveOpsEngine.getNewsFeedStories(),
          "{starCount}": totalStars,
          "{diamonds}": profile.diamonds ?? 67025,
          "{selectedBeatmap}": profile.selectedBeatmapId || 1,
          "{time}": Date.now(),
          "{playerCustomizations}": {
            AutoShuffleDisabled: !profile.autoShuffle,
            AccuracyModeEnabled: profile.perfectPlusHighlight,
            AccuracyTextEnabled: profile.accuracyText,
          },
        });

        // Populate basicInfo, currencies, playerVisuals, cases, starMilestones, and LiveOps dynamically
        try {
          const bodyObj = syncRespObj?.requests?.[0]?.body?.[0];
          if (bodyObj) {
            bodyObj.liveOpsEventConfig = LiveOpsEngine.getLiveOpsEventConfig();
            bodyObj.liveOpsSeasonConfig = LiveOpsEngine.getLiveOpsSeasonConfig();
          }

          const profileObj = bodyObj?.profile?.[0];
          if (profileObj) {
            profileObj.basicInfo = [
              {
                level: profile.level || 30,
                beatmapsPlayed: profile.beatmapsPlayed || 150,
                stars: totalStars,
                score: profile.totalScore || 50000000,
                experience: profile.experience || 500000,
                country: profile.country || "US",
              },
            ];

            profileObj.currencies = [
              { currency_id: 3, amount: profile.diamonds ?? 67025 },
              { currency_id: 5, amount: profile.beatCoins || 150 },
              { currency_id: 7, amount: totalStars },
              { currency_id: 9, amount: 25 },
            ];

            profileObj.playerVisuals = [
              {
                callingCard: [
                  {
                    template_id: profile.callingCardTemplateId || 1,
                  },
                ],
                profileIcon_id: (profile.profileIconId && profile.profileIconId > 1000) ? profile.profileIconId : ((allVisuals as any).iconIds?.[0] || 1159378479),
              },
            ];

            // Populate all genre cases with generous card counts
            const allGenreIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            const cardCounts = allGenreIds.map((genreId) => ({
              caseTemplate_id: genreId,
              count: 999,
            }));
            const reqCounts = allGenreIds.map((genreId) => ({
              caseTemplate_id: genreId,
              count: 1,
            }));

            profileObj.cases = [
              {
                cards: cardCounts,
                countRequiredToOpenCase: reqCounts,
                numCasesOpened: 999,
              },
            ];

            // Unlock all 30 Journey Venues / Ranks and claim all star milestones
            profileObj.starMilestoneData = [
              {
                currentVenue_id: 30,
                venueReachedTimeMsecs: Date.now(),
                claimedMilestones_id: Array.from({ length: 150 }, (_, i) => i + 1),
              },
            ];

            const activeSkinId = profile.globalSkinId || 0;
            const genreSkinList = [];
            if (profile.genreSkins) {
              for (const g of Object.keys(profile.genreSkins)) {
                genreSkinList.push({ genre_id: Number(g), skin_id: profile.genreSkins[Number(g)] });
              }
            }

            profileObj.subProfileTOs = [
              {
                type: 11,
                globalSkin_id: activeSkinId,
                owned_id: profile.ownedSkins && profile.ownedSkins.length >= 50 ? profile.ownedSkins : (allVisuals as any).skinIds || [],
                skinsSetToGenres: genreSkinList,
              },
              {
                type: 12,
                owned_id: profile.ownedProfileIcons && profile.ownedProfileIcons.length >= 50 ? profile.ownedProfileIcons : (allVisuals as any).iconIds || [],
              },
            ];

            // Enable nickname change feature — no cooldown in offline mode
            profileObj.playerNameChangeInfo = [{
              lastTimeChangedMsecs: 0,
            }];

            // Unlock all emotes for Merch Collection -> Emotes tab
            profileObj.emojis = [{
              unlockedEmojis_new_id: (allVisuals as any).emojiIds || [1, 3, 4, 5, 6, 7, 8, 9, 10, 12],
            }];

            // Unlock all calling cards (banners)
            profileObj.callingCards = [{
              unlocked_id: (allVisuals as any).bannerIds || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
              seen_id: []
            }];

            // Initialize shop items (empty to prevent NREs)
            profileObj.shopItems = [{
              boughtItems: []
            }];

            // Force Unlock Premium Tour Pass and all 30 levels
            const activeSeasonId = bodyObj?.liveOpsSeasonConfig?.Seasons?.[0]?.seasonNumber || 1;
            profileObj.seasons = [{
              season_id: activeSeasonId,
              premiumPassActive: true,
              levelIndex: 30,
              claimedFreeLevels: Array.from({length:30}, (_,i)=>i+1),
              claimedPremiumLevels: Array.from({length:30}, (_,i)=>i+1)
            }];

            // Initialize roosters (notification badges / seen markers) to prevent UserRoosters NPE
            profileObj.roosters = [{
              queryStrings: [],
              dates: [],
              stringdates: []
            }];

          }
        } catch (e: any) {
          Logger.log(`[GameService] Profile injection error: ${e.message}`);
        }

        const syncResponse = await packet.buildResponse(
          createServerClientMessageHeader({}),
          syncRespObj,
          SyncResp,
          false
        );

        client.write(syncResponse);
        return;
      }

      if (rpcType === "ExecuteAudit") {
        const audit = request.audit;
        if (audit) {
          Logger.log(`[GameService] Raw Audit received: type=${audit.type} keys=${JSON.stringify(Object.keys(audit))}`);
          if (audit.type === RequestType.SetSelectedSong) {
            Logger.log(`[GameService] Audit: SetSelectedSong (${audit.song_id})`);
            ProfileStore.setSelectedBeatmap(audit.song_id);
          } else if (audit.type === RequestType.RhythmGameStarted) {
            Logger.log(`[GameService] Audit: RhythmGameStarted (${audit.song_id})`);
            ProfileStore.incrementPlayCount(audit.song_id);
          } else if (audit.type === RequestType.RhythmGameEnded) {
            Logger.log(`[GameService] Audit: RhythmGameEnded (${audit.song_id})`);
            ProfileStore.updateScoreFromAudit(audit);
            // Award gameplay rewards: Beat Coins, genre cards, and Tour Pass points
            ProfileStore.addBeatCoins(15);
            ProfileStore.addCards((audit.song_id % 7) + 1, 2);
            ProfileStore.addTourPoints(25);
          } else if (audit.type === RequestType.ShopSystemRefresh) {
            Logger.log("[GameService] Audit: ShopSystemRefresh");
            ProfileStore.refreshShopIfNeeded();
          } else if (audit.type === RequestType.RefreshBonusCardsSystem) {
            Logger.log("[GameService] Audit: RefreshBonusCardsSystem");
            ProfileStore.addCards(8, 3); // Wishlist cards reward
          } else if (audit.type === RequestType.SetCustomization) {
            if (audit.Data) {
              Logger.log(`[GameService] Audit: SetCustomization (${audit.Data.type} = ${audit.Data.Enabled})`);
              ProfileStore.setCustomization(audit.Data.type, audit.Data.Enabled);
            }
          } else if (audit.type === RequestType.SetCallingCard) {
            const cardId = audit.callingCard_id;
            Logger.log(`[GameService] Audit: SetCallingCard (${cardId})`);
            if (cardId) ProfileStore.setCallingCard(cardId);
          } else if (audit.type === RequestType.SetProfileIcon) {
            const iconId = audit.profileIcon_id;
            Logger.log(`[GameService] Audit: SetProfileIcon (${iconId})`);
            if (iconId) ProfileStore.setAvatar(iconId);
          } else if (audit.type === RequestType.SetGlobalTrackSkin) {
            const skinId = audit.trackSkin_id || audit.trackSkin_id_2 || audit.trackSkin_id_3;
            Logger.log(`[GameService] Audit: SetGlobalTrackSkin (${skinId})`);
            if (skinId) ProfileStore.setSkin(skinId);
          } else if (audit.type === RequestType.SetTrackSkinForGenre) {
            const skinId = audit.trackSkin_id || audit.skin_id;
            const genreId = audit.genre_id || audit.songGenre_id;
            Logger.log(`[GameService] Audit: SetTrackSkinForGenre (skin=${skinId}, genre=${genreId})`);
            if (skinId) ProfileStore.setSkin(skinId, genreId);
          } else if (audit.case_id || audit.box_id) {
            const boxId = audit.case_id || audit.box_id;
            Logger.log(`[GameService] Audit: OpenBox (${boxId})`);
            ProfileStore.openBox(boxId);
          } else if (
            audit.type === RequestType.MarkSeenRooster ||
            audit.type === RequestType.AddRooster ||
            audit.type === RequestType.MarkSeenDatedRooster ||
            audit.type === RequestType.MarkSeenStringDatedRooster ||
            audit.type === RequestType.RemoveSeenStringDatedRooster
          ) {
            Logger.log(`[GameService] Audit: Rooster update (type=${audit.type})`);
          }
        }
        responses.push(createEmptyResponse(request));
      } else {
        responses.push(createEmptyResponse(request));
      }
    }

    const auditResponse = await packet.buildResponse(
      createServerClientMessageHeader({}),
      createExecuteSharplaAuditResp({
        "{requests}": responses,
      }),
      ExecuteSharplaAuditResp
    );
    client.write(auditResponse);
  }
}
