import { ProfileStore } from "./ProfileStore.js";
import Logger from "../../lib/Logger.js";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  score: number;
  country: string;
  profileIcon_id: number;
  callingCardTemplate_id: number;
  highestStreak: number;
  starCount: number;
  isFriend: boolean;
  isLocalPlayer: boolean;
  beatmapId?: number;
}

export interface BotRival {
  id: string;
  name: string;
  country: string;
  avatar: number;
  banner: number;
  baseScore: number;
  starCount: number;
  streak: number;
}

export class LeaderboardEngine {
  private static bots: BotRival[] = [];

  static init() {
    if (this.bots.length > 0) return;

    const names = [
      "NovaBeat", "StarlightPro", "VortexTap", "RhythmNinja", "TokyoDrift",
      "CyberGroove", "MelodyMaster", "BassDrop", "PixelEcho", "PulseRider",
      "BeatKing99", "NeonStriker", "SonicBoom", "EchoDancer", "HyperTap",
      "AstroGroove", "SynthWave", "CosmicBeat", "ElectroPulse", "ZeroGravity",
      "NightRider", "QuantumTempo", "SolarFlare", "LunaGroove", "AuroraTap",
      "PhantomBeat", "VeloxRhythm", "OmegaDrop", "ApexStriker", "TitanSound",
      "ValkyrieBeat", "ZenithPulse", "EclipseTap", "VelocityKing", "ShadowRhythm",
      "RadiantBeat", "ChronoGroove", "MatrixTap", "InfernoDrop", "BlazeRider",
      "FrostPulse", "StormStriker", "ThunderGroove", "ViperBeat", "CobaltTap",
      "RubyRhythm", "EmeraldSound", "SapphirePulse", "DiamondDrop", "ObsidianBeat",
      "SkylineGroove", "UrbanTap", "NeonCity", "MetroPulse", "GlitchRider",
      "CipherBeat", "AeroTempo", "PrismStriker", "FluxGroove", "ZenithBeat",
      "MirageTap", "SpecterPulse", "ArcaneSound", "VortexGroove", "CosmoStriker",
      "AuraRhythm", "BreezeTap", "CascadeBeat", "DriftPulse", "EchoGroove",
      "FableStriker", "GaleTempo", "HelixBeat", "IrisTap", "JadePulse",
      "KryptonGroove", "LotusStriker", "MysticBeat", "NexusTap", "OrionPulse",
      "PioneerGroove", "QuasarStriker", "RiftBeat", "SolaceTap", "TritonPulse",
      "UnityGroove", "VektorStriker", "WhisperBeat", "XenonTap", "YonderPulse",
      "ZephyrGroove", "AlphaStriker", "BetaBeat", "GammaTap", "DeltaPulse",
      "EpsilonGroove", "ZetaStriker", "EtaBeat", "ThetaTap", "IotaPulse"
    ];

    const countries = [
      "US", "GB", "JP", "DE", "FR", "BR", "KR", "VN", "CA", "AU",
      "IT", "ES", "MX", "NL", "SE", "PL", "NO", "FI", "NZ", "CH"
    ];

    for (let i = 0; i < names.length; i++) {
      const country = countries[i % countries.length];
      const avatar = (i % 16) + 1;
      const banner = (i % 10) + 1;
      const starCount = 300 + Math.floor(Math.sin(i * 13) * 150) + (i * 12);
      const baseScore = 20000000 + (names.length - i) * 450000 + Math.floor(Math.sin(i * 7) * 200000);
      const streak = 150 + (i % 300);

      this.bots.push({
        id: `bot-rival-${(i + 1).toString().padStart(3, "0")}`,
        name: names[i],
        country,
        avatar,
        banner,
        baseScore,
        starCount,
        streak,
      });
    }
  }

  static getLeaderboard(
    leaderboardName: string = "Global",
    friendsOnly: boolean = false,
    count: number = 50
  ): {
    leaderboardName: string;
    entries: LeaderboardEntry[];
    myEntry: LeaderboardEntry;
    totalEntries: number;
    results: Array<{ player: string; score: number }>;
    playerLeaderboardInfo: { score: number; position: number; percentile: number };
  } {
    this.init();
    const profile = ProfileStore.getProfile();
    const isSongBoard = leaderboardName.startsWith("Beatmap:") || !isNaN(Number(leaderboardName));

    if (isSongBoard) {
      const songId = Number(leaderboardName.replace("Beatmap:", "")) || 1;
      return this.getSongLeaderboard(songId, count);
    }

    // Global / Country / Friends leaderboard
    let pool: Array<{
      id: string;
      name: string;
      score: number;
      country: string;
      avatar: number;
      banner: number;
      starCount: number;
      streak: number;
      isLocal: boolean;
      isFriend: boolean;
    }> = this.bots.map((b, idx) => ({
      id: b.id,
      name: b.name,
      score: b.baseScore,
      country: b.country,
      avatar: b.avatar,
      banner: b.banner,
      starCount: b.starCount,
      streak: b.streak,
      isLocal: false,
      isFriend: idx < 15,
    }));

    // Insert user
    pool.push({
      id: profile.uuid || "local-user-player",
      name: profile.name || "Player",
      score: profile.totalScore || 0,
      country: profile.country || "US",
      avatar: profile.avatar || 1,
      banner: profile.banner || 1,
      starCount: profile.starCount || 0,
      streak: 250,
      isLocal: true,
      isFriend: false,
    });

    if (leaderboardName.startsWith("Country:")) {
      const reqCountry = leaderboardName.replace("Country:", "").toUpperCase();
      pool = pool.filter((p) => p.country === reqCountry || p.isLocal);
    } else if (friendsOnly) {
      pool = pool.filter((p) => p.isFriend || p.isLocal);
    }

    // Sort descending
    pool.sort((a, b) => b.score - a.score);

    let myRank = 1;
    const entries: LeaderboardEntry[] = [];
    const results: Array<{ player: string; score: number }> = [];

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      const rank = i + 1;
      if (p.isLocal) {
        myRank = rank;
      }
      const entry: LeaderboardEntry = {
        rank,
        userId: p.id,
        name: p.name,
        score: p.score,
        country: p.country,
        profileIcon_id: p.avatar,
        callingCardTemplate_id: p.banner,
        highestStreak: p.streak,
        starCount: p.starCount,
        isFriend: p.isFriend,
        isLocalPlayer: p.isLocal,
      };

      if (entries.length < count) {
        entries.push(entry);
        results.push({ player: p.id, score: p.score });
      }
    }

    const myEntry: LeaderboardEntry = {
      rank: myRank,
      userId: profile.uuid || "local-user-player",
      name: profile.name || "Player",
      score: profile.totalScore || 0,
      country: profile.country || "US",
      profileIcon_id: profile.avatar || 1,
      callingCardTemplate_id: profile.banner || 1,
      highestStreak: 250,
      starCount: profile.starCount || 0,
      isFriend: false,
      isLocalPlayer: true,
    };

    const percentile = Math.max(1, Math.min(100, Math.round((myRank / Math.max(1, pool.length)) * 100)));

    return {
      leaderboardName,
      entries,
      myEntry,
      totalEntries: pool.length,
      results,
      playerLeaderboardInfo: {
        score: profile.totalScore || 0,
        position: myRank,
        percentile,
      },
    };
  }

  private static getSongLeaderboard(
    songId: number,
    count: number = 20
  ): {
    leaderboardName: string;
    entries: LeaderboardEntry[];
    myEntry: LeaderboardEntry;
    totalEntries: number;
    results: Array<{ player: string; score: number }>;
    playerLeaderboardInfo: { score: number; position: number; percentile: number };
  } {
    const profile = ProfileStore.getProfile();
    const userSongScore = ProfileStore.getSongScore(songId);

    // Generate ~25 deterministic bot rivals for this song using songId as seed
    const rivals: Array<{
      id: string;
      name: string;
      score: number;
      country: string;
      avatar: number;
      banner: number;
      isLocal: boolean;
    }> = [];

    const baseMax = 50000;
    for (let i = 0; i < 24; i++) {
      const bot = this.bots[(songId * 7 + i * 3) % this.bots.length];
      const variance = (Math.sin(songId * 11 + i * 5) + 1) * 0.5; // 0..1
      const botScore = Math.floor(46500 + variance * 3400); // 46500..49900
      rivals.push({
        id: bot.id,
        name: bot.name,
        score: botScore,
        country: bot.country,
        avatar: bot.avatar,
        banner: bot.banner,
        isLocal: false,
      });
    }

    // Insert user
    rivals.push({
      id: profile.uuid || "local-user-player",
      name: profile.name || "Player",
      score: userSongScore,
      country: profile.country || "US",
      avatar: profile.avatar || 1,
      banner: profile.banner || 1,
      isLocal: true,
    });

    rivals.sort((a, b) => b.score - a.score);

    let myRank = 1;
    const entries: LeaderboardEntry[] = [];
    const results: Array<{ player: string; score: number }> = [];

    for (let i = 0; i < rivals.length; i++) {
      const r = rivals[i];
      const rank = i + 1;
      if (r.isLocal) {
        myRank = rank;
      }
      const entry: LeaderboardEntry = {
        rank,
        userId: r.id,
        name: r.name,
        score: r.score,
        country: r.country,
        profileIcon_id: r.avatar,
        callingCardTemplate_id: r.banner,
        highestStreak: 100,
        starCount: 15,
        isFriend: true,
        isLocalPlayer: r.isLocal,
        beatmapId: songId,
      };

      if (entries.length < count) {
        entries.push(entry);
        results.push({ player: r.id, score: r.score });
      }
    }

    const myEntry: LeaderboardEntry = {
      rank: myRank,
      userId: profile.uuid || "local-user-player",
      name: profile.name || "Player",
      score: userSongScore,
      country: profile.country || "US",
      profileIcon_id: profile.avatar || 1,
      callingCardTemplate_id: profile.banner || 1,
      highestStreak: 100,
      starCount: 15,
      isFriend: false,
      isLocalPlayer: true,
      beatmapId: songId,
    };

    const percentile = Math.max(1, Math.min(100, Math.round((myRank / rivals.length) * 100)));

    return {
      leaderboardName: `Beatmap:${songId}`,
      entries,
      myEntry,
      totalEntries: rivals.length,
      results,
      playerLeaderboardInfo: {
        score: userSongScore,
        position: myRank,
        percentile,
      },
    };
  }
}
