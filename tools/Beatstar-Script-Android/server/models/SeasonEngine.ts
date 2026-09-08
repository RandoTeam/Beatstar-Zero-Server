import { CatalogStore } from "./CatalogStore.js";
import Logger from "../../lib/Logger.js";

export interface SeasonDefinition {
  seasonNumber: number;
  idLabel: string;
  name: string;
  durationDays: number;
}

export const ALL_SEASONS: SeasonDefinition[] = [
  { seasonNumber: 1, idLabel: "Season_1", name: "Holiday Mix", durationDays: 28 },
  { seasonNumber: 2, idLabel: "Season_2", name: "Love Mix", durationDays: 28 },
  { seasonNumber: 3, idLabel: "Season_3", name: "Spring Break Mix", durationDays: 28 },
  { seasonNumber: 4, idLabel: "Season_4", name: "<b>Iconic Mix</b>", durationDays: 28 },
  { seasonNumber: 5, idLabel: "Season_5", name: "<b>AFRICA TO THE WORLD</b>", durationDays: 28 },
  { seasonNumber: 6, idLabel: "Season_6", name: "<b>FREEDOM</b>", durationDays: 28 },
  { seasonNumber: 7, idLabel: "Season_7", name: "<b>HIGH VOLTAGE</b>", durationDays: 28 },
  { seasonNumber: 8, idLabel: "Season_8", name: "<b>SUMMER DAZE</b>", durationDays: 28 },
  { seasonNumber: 9, idLabel: "Season_9", name: "<b>UK TAKEOVER</b>", durationDays: 28 },
  { seasonNumber: 10, idLabel: "Season_10", name: "<b>GAME TIME</b>", durationDays: 28 },
  { seasonNumber: 11, idLabel: "Season_11", name: "<b>LET'S RIDE</b>", durationDays: 28 },
  { seasonNumber: 12, idLabel: "Season_12", name: "<b>GUITARS AND BARS</b>", durationDays: 28 },
  { seasonNumber: 13, idLabel: "Season_13", name: "<b>HOLIDAY PARTY 2</b>", durationDays: 28 },
  { seasonNumber: 14, idLabel: "Season_14", name: "<b>MIDNIGHT GALA</b>", durationDays: 28 },
  { seasonNumber: 15, idLabel: "Season_15", name: "<b>SUPER SET</b>", durationDays: 28 },
  { seasonNumber: 16, idLabel: "Season_16", name: "<b>LOVE GAMES</b>", durationDays: 28 },
  { seasonNumber: 17, idLabel: "Season_17", name: "<b>AMPED UP!</b>", durationDays: 28 },
  { seasonNumber: 18, idLabel: "Season_18", name: "<b>RISE AND SHINE</b>", durationDays: 28 },
  { seasonNumber: 19, idLabel: "Season_19", name: "<b>NEON NIGHTS</b>", durationDays: 28 },
  { seasonNumber: 20, idLabel: "Season_20", name: "<b>CENTER STAGE</b>", durationDays: 28 },
  { seasonNumber: 21, idLabel: "Season_21", name: "<b>RAINBOW RHYTHMS</b>", durationDays: 28 },
  { seasonNumber: 22, idLabel: "Season_22", name: "<b>SONIC GALAXY</b>", durationDays: 28 },
  { seasonNumber: 23, idLabel: "Season_23", name: "<b>HEATWAVE</b>", durationDays: 28 },
  { seasonNumber: 24, idLabel: "Season_24", name: "<b>ISLAND BREEZE</b>", durationDays: 28 },
  { seasonNumber: 25, idLabel: "Season_25", name: "<b>WILD HEARTS</b>", durationDays: 28 },
  { seasonNumber: 26, idLabel: "Season_26", name: "<b>RETRO RUSH</b>", durationDays: 28 },
  { seasonNumber: 27, idLabel: "Season_27", name: "<b>GROOVE LOUNGE</b>", durationDays: 28 },
  { seasonNumber: 28, idLabel: "Season_28", name: "<b>MONSTER BEATS</b>", durationDays: 28 },
  { seasonNumber: 29, idLabel: "Season_29", name: "<b>AUTUMN GOLD</b>", durationDays: 28 },
  { seasonNumber: 30, idLabel: "Season_30", name: "<b>HOLIDAY SPECTACULAR</b>", durationDays: 28 },
  { seasonNumber: 31, idLabel: "Season_31", name: "<b>SPARKLE AND POP</b>", durationDays: 28 },
  { seasonNumber: 32, idLabel: "Season_32", name: "<b>FROST AND FURY</b>", durationDays: 28 },
  { seasonNumber: 33, idLabel: "Season_33", name: "<b>HARMONIC ODYSSEY</b>", durationDays: 28 },
  { seasonNumber: 34, idLabel: "Season_34", name: "<b>SHOWTIME</b>", durationDays: 28 },
  { seasonNumber: 35, idLabel: "Season_35", name: "<b>SPRING FRESH</b>", durationDays: 28 },
  { seasonNumber: 36, idLabel: "Season_36", name: "<b>JUKEBOX JAM</b>", durationDays: 28 },
  { seasonNumber: 37, idLabel: "Season_37", name: "<b>THE KILLERS PRESENTS</b>", durationDays: 28 },
  { seasonNumber: 38, idLabel: "Season_38", name: "<b>SUNRISE FESTIVAL</b>", durationDays: 28 },
  { seasonNumber: 39, idLabel: "Season_39", name: "<b>LOVE SPECTRUM</b>", durationDays: 28 },
  { seasonNumber: 40, idLabel: "Season_40", name: "<b>ELECTRIC SUMMER</b>", durationDays: 28 },
  { seasonNumber: 41, idLabel: "Season_41", name: "<b>SUNSET FIESTA</b>", durationDays: 28 },
  { seasonNumber: 42, idLabel: "Season_42", name: "<b>RHYTHM RUMBLE</b>", durationDays: 28 },
  { seasonNumber: 43, idLabel: "Season_43", name: "<b>IN YOUR HANDS</b>", durationDays: 28 },
  { seasonNumber: 44, idLabel: "Season_44", name: "<b>MOON MUSIC (COLDPLAY)</b>", durationDays: 28 },
  { seasonNumber: 45, idLabel: "Season_45", name: "<b>SHOCKWAVE</b>", durationDays: 28 },
  { seasonNumber: 46, idLabel: "Season_46", name: "<b>WINTER HAZE</b>", durationDays: 28 },
  { seasonNumber: 47, idLabel: "Season_47", name: "<b>HOLIDAY WISHES</b>", durationDays: 28 },
  { seasonNumber: 48, idLabel: "Season_48", name: "<b>NEW HORIZONS</b>", durationDays: 28 },
  { seasonNumber: 49, idLabel: "Season_49", name: "<b>ROCK REVIVAL</b>", durationDays: 28 },
  { seasonNumber: 50, idLabel: "Season_50", name: "<b>PEACE AND LOVE (JOHN LENNON)</b>", durationDays: 28 },
  { seasonNumber: 51, idLabel: "Season_51", name: "<b>MIC DROP</b>", durationDays: 28 },
  { seasonNumber: 52, idLabel: "Season_52", name: "<b>MAESTRO TOUR PASS</b>", durationDays: 28 },
  { seasonNumber: 53, idLabel: "Season_53", name: "<b>DECIBEL DELUXE</b>", durationDays: 28 },
  { seasonNumber: 54, idLabel: "Season_54", name: "<b>MAESTRO II</b>", durationDays: 28 },
  { seasonNumber: 55, idLabel: "Season_55", name: "<b>RIFF MACHINE</b>", durationDays: 28 },
  { seasonNumber: 56, idLabel: "Season_56", name: "<b>RAVES & REQUIEMS</b>", durationDays: 28 },
  { seasonNumber: 57, idLabel: "Season_57", name: "<b>MAY DAZE</b>", durationDays: 28 },
  { seasonNumber: 58, idLabel: "Season_58", name: "<b>MEGA MIX (PART 1)</b>", durationDays: 28 },
  { seasonNumber: 59, idLabel: "Season_59", name: "<b>MEGA MIX (PART 2)</b>", durationDays: 28 },
  { seasonNumber: 60, idLabel: "Season_60", name: "<b>SUMMER MIX</b>", durationDays: 28 },
  { seasonNumber: 61, idLabel: "Season_61", name: "<b>SUNSET SERENADE (ACT I)</b>", durationDays: 28 },
  { seasonNumber: 62, idLabel: "Season_62", name: "<b>SUNSET SERENADE (ACT II)</b>", durationDays: 28 },
  { seasonNumber: 63, idLabel: "Season_63", name: "<b>SUNSET SERENADE (FINALE)</b>", durationDays: 28 },
];

export class SeasonEngine {
  private static readonly DAY_MSECS = 86400000;
  private static readonly SEASON_CYCLE_DAYS = 28;

  /**
   * Builds the 30-level Tour Pass reward ladder
   */
  static buildSeasonLevels(): any[] {
    const levels = [];
    for (let i = 1; i <= 30; i++) {
      levels.push({
        migratedID: i,
        pointsRequired: i * 5, // 5, 10, 15, ..., 150
        freeReward: { currency_id: 3, amount: 5 + i * 2 },
        premiumReward: { currency_id: 3, amount: 15 + i * 5 },
        freeRewardIsInteresting: i % 5 === 0,
        premiumRewardIsInteresting: true,
      });
    }
    return levels;
  }

  /**
   * Calculates the active season configuration dynamically based on current epoch
   */
  static getLiveOpsSeasonConfig(now: number = Date.now()): any {
    CatalogStore.load();
    const songs = CatalogStore.getSongs().filter((s) => s.id !== 990);
    const songCount = songs.length > 0 ? songs.length : 1;

    const epochDays = Math.floor(now / this.DAY_MSECS);
    const seasonCycle = Math.floor(epochDays / this.SEASON_CYCLE_DAYS);
    const seasonIndex = ((seasonCycle % ALL_SEASONS.length) + ALL_SEASONS.length) % ALL_SEASONS.length;
    const activeSeason = ALL_SEASONS[seasonIndex];

    const seasonStart = seasonCycle * this.SEASON_CYCLE_DAYS * this.DAY_MSECS;
    const seasonEnd = seasonStart + this.SEASON_CYCLE_DAYS * this.DAY_MSECS;

    // Pick 9 representative songs for this season's reward boxes
    const seasonSongIds: number[] = [];
    for (let i = 0; i < 9; i++) {
      const idx = (seasonIndex * 9 + i) % songCount;
      seasonSongIds.push(songs[idx]?.id || 1);
    }

    const levels = this.buildSeasonLevels();

    return {
      Seasons: [
        {
          id: activeSeason.seasonNumber,
          idLabel: activeSeason.idLabel,
          name: activeSeason.name,
          seasonNumber: activeSeason.seasonNumber,
          startTimeMsecs: seasonStart,
          endTimeMsecs: seasonEnd,
          beatmaps_id: seasonSongIds,
          premiumPassPricePoint_id: 1,
          enabled: true,
          firstBonusLevel: 31,
          developmentState: 1,
          songsRequired: 9,
          allowCosmeticFreeRewards: true,
          genericRewards: {
            currency_id: 3,
            amount: 10,
          },
          levels,
        },
      ],
    };
  }
}
