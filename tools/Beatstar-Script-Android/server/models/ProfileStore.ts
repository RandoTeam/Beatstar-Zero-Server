import { StorageManager } from "../../lib/StorageManager.js";
import { DeviceFs } from "../../lib/DeviceFs.js";
import { CatalogStore } from "./CatalogStore.js";
import allVisuals from "../../customs/allVisualIds.json";
import Logger from "../../lib/Logger.js";

export interface ShopOfferItem {
  templateId: number;
  costDiamonds: number;
  rewardType: "cards" | "song" | "diamonds";
  targetId: number;
  amount: number;
  purchased: boolean;
}

export interface UserProfile {
  id: number;
  uuid: string;
  username: string;
  name?: string;
  country?: string;
  avatar?: number;
  banner?: number;
  starCount: number;
  diamonds: number;
  beatCoins: number;
  selectedBeatmapId: number;
  level: number;
  experience: number;
  totalScore: number;
  beatmapsPlayed: number;
  profileIconId: number;
  callingCardTemplateId: number;
  globalSkinId: number;
  ownedSkins: number[];
  ownedProfileIcons: number[];
  autoShuffle: boolean;
  perfectPlusHighlight: boolean;
  accuracyText: boolean;
  unlockAllSongs: boolean;
  cards: Record<number, number>;
  caseRequirements: Record<number, number>;
  unlockedSongIds: number[];
  lastShopRefreshMsecs: number;
  claimedDailyFreeMsecs: number;
  dailyOffers: ShopOfferItem[];
  tourPoints?: number;
}

export interface SongScore {
  beatmapId: number;
  absoluteScore: number;
  normalizedScore: number;
  highestGrade: number;
  highestCheckpoint: number;
  highestStreak: number;
  playedCount: number;
}

export interface CustomSongScore {
  beatmapId: number;
  absoluteScore: number;
  normalizedScore: number;
}

export class ProfileStore {
  private static profile: UserProfile = {
    id: 1,
    uuid: "c0ffee00-1337-4bbf-8888-000000000001",
    username: "IliaRus",
    name: "IliaRus",
    country: "US",
    avatar: 1,
    banner: 1,
    starCount: 0,
    diamonds: 67025,
    beatCoins: 150,
    selectedBeatmapId: 1,
    level: 30,
    experience: 500000,
    totalScore: 50000000,
    beatmapsPlayed: 150,
    profileIconId: (allVisuals as any).iconIds[0] || 1159378479,
    callingCardTemplateId: 1,
    globalSkinId: 0,
    ownedSkins: (allVisuals as any).skinIds || [],
    ownedProfileIcons: (allVisuals as any).iconIds || [],
    autoShuffle: false,
    perfectPlusHighlight: true,
    accuracyText: true,
    unlockAllSongs: true,
    cards: { 1: 25, 2: 30, 3: 15, 4: 20, 5: 30, 6: 10, 7: 12, 8: 18, 9: 5 },
    caseRequirements: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 30, 7: 30, 8: 30, 9: 30 },
    unlockedSongIds: [],
    lastShopRefreshMsecs: 0,
    claimedDailyFreeMsecs: 0,
    dailyOffers: [],
  };

  private static scores: Map<number, SongScore> = new Map();
  private static customScores: Map<number, CustomSongScore> = new Map();
  private static loaded: boolean = false;
  private static saveTimerId: ReturnType<typeof setTimeout> | null = null;

  /** Debounced save: coalesces rapid writes (e.g. song scrolling) into a single disk write after 2s */
  private static scheduleSave(): void {
    if (this.saveTimerId !== null) {
      clearTimeout(this.saveTimerId);
    }
    this.saveTimerId = setTimeout(() => {
      this.saveTimerId = null;
      this.save();
    }, 2000);
  }

  private static getProfileFilePath(): string {
    return `${StorageManager.getStorageDir()}/profile.json`;
  }

  // Base star count to satisfy all Journey requirements on fresh profiles.
  // Actual stars from gameplay are added on top of this floor.
  private static BASE_STAR_COUNT = 5000;

  private static calculateStarsFromScores(): number {
    let stars = this.BASE_STAR_COUNT;
    this.scores.forEach((s) => {
      const grade = s.highestGrade || 0;
      if (grade === 1) stars += 1;
      else if (grade === 2) stars += 2;
      else if (grade === 5) stars += 3;
      else if (grade === 3) stars += 4;
      else if (grade >= 4) stars += 5;
    });
    return stars;
  }

  static getTotalStars(): number {
    this.load();
    return this.calculateStarsFromScores();
  }

  static load(): void {
    if (this.loaded) return;
    this.loaded = true;
    const filePath = this.getProfileFilePath();
    this.profile.uuid = StorageManager.getUserUuid();

    try {
      if (DeviceFs.exists(filePath)) {
        const raw = DeviceFs.readTextFileSync(filePath);
        const data = JSON.parse(raw);
        if (data.profile) {
          this.profile = { ...this.profile, ...data.profile };
          if (!this.profile.profileIconId || this.profile.profileIconId <= 1000) {
            this.profile.profileIconId = (allVisuals as any).iconIds[0] || 1159378479;
          }
        }
        if (data.scores) {
          for (const k of Object.keys(data.scores)) {
            const id = parseInt(k, 10);
            this.scores.set(id, data.scores[k]);
          }
        }
        if (data.customScores) {
          for (const k of Object.keys(data.customScores)) {
            const id = parseInt(k, 10);
            this.customScores.set(id, data.customScores[k]);
          }
        }
        if (!this.profile.ownedProfileIcons || this.profile.ownedProfileIcons.length < 50) {
          this.profile.ownedProfileIcons = (allVisuals as any).iconIds || [];
        }
        if (!this.profile.ownedSkins || this.profile.ownedSkins.length < 50) {
          this.profile.ownedSkins = (allVisuals as any).skinIds || [];
        }
        this.profile.starCount = this.calculateStarsFromScores();
        Logger.log(`[ProfileStore] Loaded profile & ${this.scores.size} scores from ${filePath} (Total stars: ${this.profile.starCount})`);
      } else {
        Logger.log("[ProfileStore] No profile.json found, creating initial profile.");
        this.profile.starCount = this.calculateStarsFromScores();
        this.save();
      }
    } catch (e: any) {
      Logger.log(`[ProfileStore] Error loading profile: ${e.message}`);
    }
  }

  static save(): void {
    const filePath = this.getProfileFilePath();
    try {
      this.profile.starCount = this.calculateStarsFromScores();
      const scoresObj: Record<string, any> = {};
      this.scores.forEach((v, k) => {
        scoresObj[k.toString()] = v;
      });

      const customScoresObj: Record<string, any> = {};
      this.customScores.forEach((v, k) => {
        customScoresObj[k.toString()] = v;
      });

      const payload = {
        profile: this.profile,
        scores: scoresObj,
        customScores: customScoresObj,
        lastSaved: Date.now(),
      };

      DeviceFs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
      Logger.log(`[ProfileStore] Saved profile & scores to ${filePath}`);
    } catch (e: any) {
      Logger.log(`[ProfileStore] Error saving profile: ${e.message}`);
    }
  }

  static getProfile(): UserProfile {
    this.load();
    this.profile.starCount = this.getTotalStars();
    return this.profile;
  }

  static getScore(beatmapId: number): SongScore | undefined {
    this.load();
    return this.scores.get(beatmapId);
  }

  static getCustomScore(beatmapId: number): CustomSongScore | undefined {
    this.load();
    return this.customScores.get(beatmapId);
  }

  static getAllScores(): SongScore[] {
    this.load();
    return Array.from(this.scores.values());
  }

  static setSelectedBeatmap(beatmapId: number): void {
    this.load();
    this.profile.selectedBeatmapId = beatmapId;
    this.scheduleSave(); // Non-critical: debounce to avoid lag on rapid scrolling
  }

  static setAvatar(iconId: number): void {
    this.load();
    this.profile.profileIconId = iconId;
    if (!this.profile.ownedProfileIcons.includes(iconId)) {
      this.profile.ownedProfileIcons.push(iconId);
    }
    this.save();
  }

  static setCallingCard(cardId: number): void {
    this.load();
    this.profile.callingCardTemplateId = cardId;
    this.save();
  }

  static setSkin(skinId: number, genreId?: number): void {
    this.load();
    this.profile.globalSkinId = skinId;
    if (!this.profile.genreSkins) {
      this.profile.genreSkins = {};
    }
    if (genreId && genreId > 0) {
      this.profile.genreSkins[genreId] = skinId;
    }
    if (!this.profile.ownedSkins) {
      this.profile.ownedSkins = [];
    }
    if (!this.profile.ownedSkins.includes(skinId)) {
      this.profile.ownedSkins.push(skinId);
    }
    this.save();
  }

  static setUsername(newName: string): void {
    this.load();
    if (newName && newName.trim().length > 0) {
      this.profile.username = newName.trim();
      this.profile.name = newName.trim();
      this.save();
      Logger.log(`[ProfileStore] Username changed to: ${newName.trim()}`);
    }
  }

  static addDiamonds(amount: number): void {
    this.load();
    this.profile.diamonds = Math.max(0, (this.profile.diamonds || 0) + amount);
    this.save();
  }

  static setDiamonds(amount: number): void {
    this.load();
    this.profile.diamonds = Math.max(0, amount);
    this.save();
  }

  static addStars(amount: number): void {
    this.load();
    this.profile.starCount = Math.max(0, (this.profile.starCount || 0) + amount);
    this.save();
  }

  static setStars(amount: number): void {
    this.load();
    this.profile.starCount = Math.max(0, amount);
    this.save();
  }

  static addTourPoints(amount: number): void {
    this.load();
    if (!this.profile.tourPoints) {
      this.profile.tourPoints = 0;
    }
    this.profile.tourPoints += amount;
    this.save();
    Logger.log(`[ProfileStore] Added ${amount} Tour Points. Total: ${this.profile.tourPoints}`);
  }

  static getTourPoints(): number {
    this.load();
    return this.profile.tourPoints || 0;
  }

  static incrementPlayCount(beatmapId: number): void {
    this.load();
    this.profile.beatmapsPlayed = (this.profile.beatmapsPlayed || 0) + 1;
    const existing = this.scores.get(beatmapId);
    if (existing) {
      existing.playedCount += 1;
    } else {
      this.scores.set(beatmapId, {
        beatmapId,
        absoluteScore: 0,
        normalizedScore: 0,
        highestGrade: 0,
        highestCheckpoint: 0,
        highestStreak: 0,
        playedCount: 1,
      });
    }
    this.save();
  }

  static updateScoreFromAudit(audit: any): void {
    this.load();
    const songId = audit.song_id;
    const scoreVal = audit.score?.absoluteScore || audit.absoluteScore || 0;
    const normVal = audit.score?.normalizedScore || audit.normalizedScore || 0;
    const streak = audit.maxStreak || audit.highestStreak || 0;
    const checkpoint = audit.checkpointReached || audit.highestCheckpoint || 0;
    const difficulty = audit.difficulty || 4;
    const isDeluxe = audit.isDeluxe || false;

    if (songId >= 10000) {
      const existingCustom = this.customScores.get(songId);
      if (!existingCustom || scoreVal > existingCustom.absoluteScore) {
        this.customScores.set(songId, {
          beatmapId: songId,
          absoluteScore: scoreVal,
          normalizedScore: normVal,
        });
        Logger.log(`[ProfileStore] Updated custom score for ${songId}: ${scoreVal}`);
        this.save();
      }
      return;
    }

    const existing = this.scores.get(songId);
    const medalId = this.calculateMedal(scoreVal, difficulty, isDeluxe);

    if (!existing) {
      this.scores.set(songId, {
        beatmapId: songId,
        absoluteScore: scoreVal,
        normalizedScore: normVal,
        highestGrade: medalId,
        highestCheckpoint: checkpoint,
        highestStreak: streak,
        playedCount: 1,
      });
    } else {
      existing.playedCount = (existing.playedCount || 0) + 1;
      if (scoreVal > existing.absoluteScore) {
        existing.absoluteScore = scoreVal;
        existing.normalizedScore = normVal;
      }
      // Compare medal tiers using tier rank rather than raw non-linear varints
      const rankOrder = isDeluxe
        ? [0, 1, 2, 5, 3, 4, 9, 10, 11]
        : [0, 1, 2, 5, 3, 4, 6, 7, 8];
      const currentRank = rankOrder.indexOf(existing.highestGrade || 0);
      const newRank = rankOrder.indexOf(medalId);
      if (newRank > currentRank) {
        existing.highestGrade = medalId;
      }
      existing.highestStreak = Math.max(existing.highestStreak, streak);
      existing.highestCheckpoint = Math.max(existing.highestCheckpoint, checkpoint);
    }

    // Recalculate total score
    let sumScore = 0;
    this.scores.forEach((s) => {
      sumScore += s.absoluteScore || 0;
    });
    this.profile.totalScore = Math.max(this.profile.totalScore || 0, sumScore);

    Logger.log(`[ProfileStore] Updated score for ${songId}: ${scoreVal} (Medal ID: ${medalId})`);
    this.save();
  }

  static setCustomization(type: number, enabled: boolean): void {
    this.load();
    switch (type) {
      case 104:
        this.profile.autoShuffle = enabled;
        break;
      case 105:
        this.profile.perfectPlusHighlight = enabled;
        break;
      case 106:
        this.profile.accuracyText = enabled;
        break;
    }
    this.save();
  }

  /**
   * Calculates numeric medal grade ID for Beatstar varint encoding:
   * 1: 1 Star, 2: 2 Stars, 5: 3 Stars, 3: 4 Stars, 4: 5 Stars,
   * 6: Gold, 7: Platinum, 8: Diamond,
   * 9: Deluxe Gold, 10: Deluxe Platinum, 11: Deluxe Diamond.
   */
  private static calculateMedal(score: number, difficulty: number, isDeluxe: boolean): number {
    const fixedScore = score ?? 0;
    const vanillaTable: Record<number, number[]> = {
      1: [0, 20000, 50000, 80000, 95000, 97000, 98000, 99000],
      3: [0, 15000, 37500, 60000, 71250, 72750, 73500, 74250],
      4: [0, 10000, 17500, 35000, 47500, 48500, 49000, 49500],
      5: [0, 10000, 17500, 35000, 47500, 48500, 49000, 49500],
    };

    const deluxeTable: Record<number, number[]> = {
      1: [0, 20000, 50000, 80000, 95000, 97800, 98600, 99500],
      3: [0, 15000, 37500, 60000, 71250, 73350, 73950, 74625],
      4: [0, 10000, 17500, 35000, 47500, 48900, 49300, 49750],
      5: [0, 10000, 17500, 35000, 47500, 48900, 49300, 49750],
    };

    const table = isDeluxe ? deluxeTable : vanillaTable;
    const row = table[difficulty] || table[4];

    // Standard 8-tier medal index mapping matching the 8 thresholds
    const gradeMap = [1, 2, 5, 3, 4, 6, 7, 8];
    const deluxeGradeMap = [1, 2, 5, 3, 4, 9, 10, 11];

    let idx = 0;
    for (let i = 0; i < row.length; i++) {
      if (fixedScore >= row[i]) {
        idx = i;
      }
    }

    const mapping = isDeluxe ? deluxeGradeMap : gradeMap;
    return mapping[idx] || 1;
  }

  static addCards(genreId: number, count: number): void {
    this.load();
    if (!this.profile.cards) {
      this.profile.cards = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    }
    this.profile.cards[genreId] = (this.profile.cards[genreId] || 0) + count;
    Logger.log(`[ProfileStore] Added ${count} cards for genre ${genreId}. Total: ${this.profile.cards[genreId]}`);
    this.save();
  }

  static addBeatCoins(amount: number): void {
    this.load();
    this.profile.beatCoins = (this.profile.beatCoins || 0) + amount;
    Logger.log(`[ProfileStore] Added ${amount} Beat Coins. Total: ${this.profile.beatCoins}`);
    this.save();
  }

  static isSongUnlocked(songId: number): boolean {
    this.load();
    if (this.profile.unlockAllSongs) return true;
    return this.profile.unlockedSongIds?.includes(songId) ?? false;
  }

  static unlockSong(songId: number): void {
    this.load();
    if (!this.profile.unlockedSongIds) {
      this.profile.unlockedSongIds = [];
    }
    if (!this.profile.unlockedSongIds.includes(songId)) {
      this.profile.unlockedSongIds.push(songId);
      Logger.log(`[ProfileStore] Song unlocked: ${songId}`);
      this.save();
    }
  }

  static openBox(genreCaseId: number): { droppedSongId: number; rewardTO: any } {
    this.load();
    CatalogStore.load();
    const songs = CatalogStore.getSongs();

    // Map case ID to candidate pool
    const unlockedSet = new Set(this.profile.unlockedSongIds || []);
    let eligible = songs.filter((s) => !unlockedSet.has(s.id));

    if (genreCaseId === 9) {
      // Deluxe case
      const deluxeEligible = eligible.filter((s) => s.deluxe);
      if (deluxeEligible.length > 0) eligible = deluxeEligible;
    } else if (genreCaseId !== 8) {
      // Genre specific (if genre matches or fallback)
      const genreEligible = eligible.filter((s) => !s.deluxe);
      if (genreEligible.length > 0) eligible = genreEligible;
    }

    if (eligible.length === 0) {
      eligible = songs; // All songs unlocked fallback
    }

    // Shuffle and pick 1 winner + up to 2 other draft candidates for the 3-card animation
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const winner = shuffled[0];
    const draftCandidates = shuffled.slice(0, Math.min(3, shuffled.length)).map((s) => s.id);

    // Deduct cost
    const cardCost = genreCaseId === 9 ? 100 : 30; // Deluxe is usually 100 cards
    const costDiamonds = genreCaseId === 9 ? 199 : 149;
    
    if (!this.profile.cards) {
      this.profile.cards = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    }

    if (this.profile.cards[genreCaseId] >= cardCost) {
      this.profile.cards[genreCaseId] -= cardCost;
      Logger.log(`[ProfileStore] Deducted ${cardCost} cards for box ${genreCaseId}`);
    } else {
      // Bought from shop with diamonds!
      this.profile.diamonds = Math.max(0, (this.profile.diamonds || 0) - costDiamonds);
      Logger.log(`[ProfileStore] Deducted ${costDiamonds} diamonds for box ${genreCaseId}`);
    }

    this.unlockSong(winner.id);
    this.save();

    Logger.log(`[ProfileStore] Box ${genreCaseId} opened! Unlocked song ${winner.id} (${winner.title})`);

    return {
      droppedSongId: winner.id,
      rewardTO: {
        box_id: genreCaseId,
        beatmapSelection: {
          beatmaps_id: draftCandidates,
          seed: Math.floor(Math.random() * 1000000),
          beatmapPool_id: [genreCaseId],
        },
      },
    };
  }

  static refreshShopIfNeeded(): boolean {
    this.load();
    const now = Date.now();
    const DAY_MSECS = 86400000;

    const timeDiff = now - (this.profile.lastShopRefreshMsecs || 0);
    if (timeDiff >= 0 && timeDiff < DAY_MSECS && this.profile.dailyOffers?.length > 0) {
      return false;
    }

    // Generate fresh daily offers
    this.profile.lastShopRefreshMsecs = now;
    this.profile.dailyOffers = [
      { templateId: 101, costDiamonds: 0, rewardType: "diamonds", targetId: 0, amount: 10, purchased: false },
      { templateId: 102, costDiamonds: 30, rewardType: "cards", targetId: 1, amount: 10, purchased: false },
      { templateId: 103, costDiamonds: 45, rewardType: "cards", targetId: 2, amount: 15, purchased: false },
      { templateId: 104, costDiamonds: 60, rewardType: "cards", targetId: 3, amount: 20, purchased: false },
    ];
    this.save();
    Logger.log("[ProfileStore] Daily shop offers refreshed");
    return true;
  }

  static claimDailyFreeGems(): boolean {
    this.load();
    const freeOffer = this.profile.dailyOffers?.find((o) => o.templateId === 101 && !o.purchased);
    if (!freeOffer) return false;

    freeOffer.purchased = true;
    this.addDiamonds(freeOffer.amount || 10);
    this.profile.claimedDailyFreeMsecs = Date.now();
    this.save();
    Logger.log(`[ProfileStore] Claimed daily free ${freeOffer.amount} diamonds`);
    return true;
  }

  static buyShopOffer(templateId: number): boolean {
    this.load();
    const offer = this.profile.dailyOffers?.find((o) => o.templateId === templateId && !o.purchased);
    if (!offer) return false;

    if ((this.profile.diamonds || 0) < offer.costDiamonds) {
      Logger.log(`[ProfileStore] Insufficient diamonds for offer ${templateId}`);
      return false;
    }

    this.profile.diamonds -= offer.costDiamonds;
    offer.purchased = true;

    if (offer.rewardType === "cards") {
      this.addCards(offer.targetId, offer.amount);
    } else if (offer.rewardType === "diamonds") {
      this.addDiamonds(offer.amount);
    }

    this.save();
    Logger.log(`[ProfileStore] Purchased shop offer ${templateId}`);
    return true;
  }
}
