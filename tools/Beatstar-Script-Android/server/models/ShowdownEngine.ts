import { ProfileStore } from "./ProfileStore.js";
import Logger from "../../lib/Logger.js";

export interface BotCompetitor {
  name: string;
  country: string;
  avatarId: number;
  callingCardId: number;
  skillLevel: number; // 0: low, 1: mid, 2: top
  score: number;
}

const BOT_PREFIXES = ["Lil", "Fire", "Deck", "Party", "Potato", "Mic", "Gold", "Lit", "DJ", "Dark", "Sky", "Neon", "Retro", "Hyper", "Sonic", "Pixel"];
const BOT_SUFFIXES = ["Crash", "One", "Fox", "Boss", "vibes", "Bone", "Rock", "LOL", "crush", "75", "91", "555", "329", "111", "18", "x91"];
const COUNTRIES = ["US", "GB", "DE", "FR", "BR", "JP", "KR", "CA", "AU", "IT", "ES", "PL", "MX", "NL", "SE"];

export class ShowdownEngine {
  /**
   * Generates a random realistic bot competitor
   */
  private static generateBot(index: number, maxScore: number = 50000): BotCompetitor {
    const prefix = BOT_PREFIXES[Math.floor(Math.random() * BOT_PREFIXES.length)];
    const suffix = BOT_SUFFIXES[Math.floor(Math.random() * BOT_SUFFIXES.length)];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const avatarId = (index * 7 + 3) % 140 + 1;
    const callingCardId = (index * 5 + 1) % 150 + 1;

    let score = 0;
    if (index === 0 || index === 1) {
      // Top bot (Rank 1-2 competitor): 98.5% - 99.8% of max score
      const ratio = 0.985 + Math.random() * 0.013;
      score = Math.floor(maxScore * ratio);
    } else if (index >= 2 && index <= 4) {
      // Mid bot (Rank 3-5 competitor): 95.0% - 98.0%
      const ratio = 0.95 + Math.random() * 0.03;
      score = Math.floor(maxScore * ratio);
    } else {
      // Low bot (Rank 6-7): 90.0% - 94.5%
      const ratio = 0.9 + Math.random() * 0.045;
      score = Math.floor(maxScore * ratio);
    }

    return {
      name: `${prefix}${suffix}`,
      country,
      avatarId,
      callingCardId,
      skillLevel: index < 2 ? 2 : index < 5 ? 1 : 0,
      score,
    };
  }

  /**
   * Generates 7 AI opponents for an 8-player heat
   */
  static generateHeatCompetitors(beatmapId: number, maxScore: number = 50000): BotCompetitor[] {
    const bots: BotCompetitor[] = [];
    for (let i = 0; i < 7; i++) {
      bots.push(this.generateBot(i, maxScore));
    }
    // Sort descending
    bots.sort((a, b) => b.score - a.score);
    return bots;
  }

  /**
   * Simulates the Grand Prize Spin Wheel with 10-spin pity counter
   */
  static spinPrizeWheel(claimsCount: number = 0): {
    rewardType: string;
    amount: number;
    isGrandPrize: boolean;
  } {
    // Pity check: Every 10 spins guarantees Grand Prize
    if (claimsCount > 0 && claimsCount % 10 === 0) {
      Logger.log("[ShowdownEngine] Pity triggered! Awarding Grand Prize.");
      return { rewardType: "song", amount: 1, isGrandPrize: true };
    }

    const rand = Math.random() * 100;
    if (rand < 5) {
      // 5% Grand Prize Song
      return { rewardType: "song", amount: 1, isGrandPrize: true };
    } else if (rand < 20) {
      // 15% 25 Deluxe Cards
      return { rewardType: "deluxe_cards", amount: 25, isGrandPrize: false };
    } else if (rand < 30) {
      // 10% 10 Diamonds
      return { rewardType: "diamonds", amount: 10, isGrandPrize: false };
    } else if (rand < 50) {
      // 20% 15 Deluxe Cards
      return { rewardType: "deluxe_cards", amount: 15, isGrandPrize: false };
    } else if (rand < 70) {
      // 20% 5 Diamonds
      return { rewardType: "diamonds", amount: 5, isGrandPrize: false };
    } else {
      // 30% 25 Tour Points
      return { rewardType: "tour_points", amount: 25, isGrandPrize: false };
    }
  }
}
