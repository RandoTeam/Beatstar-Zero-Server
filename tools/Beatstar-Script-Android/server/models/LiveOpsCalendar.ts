import { CatalogStore } from "./CatalogStore.js";
import Logger from "../../lib/Logger.js";

export interface MasterEventDefinition {
  id: number;
  idLabel: string;
  nameTxt: string;
  eventFlavourTxt: string;
  type: number; // 2: Shuffle, 3: Leaderboard Heat, 4: Totaliser
  template: string;
  durationDays: number;
  featuredSongNames: string[];
  bannerImage: string;
  bannerGradient?: { colorTop: string; colorBottom: string };
  tileRimColour?: string;
  rewardTokens: { [key: string]: number };
}

export const HISTORICAL_MASTER_EVENTS: MasterEventDefinition[] = [
  {
    id: 2001,
    idLabel: "Event_Heatstar_Plus",
    nameTxt: "<b>HEATSTAR PLUS</b>",
    eventFlavourTxt: "Turn up the temperature! Compete across the hottest high-tempo tracks in Beatstar history.",
    type: 3,
    template: "LeaderboardHeatTemplate",
    durationDays: 3,
    featuredSongNames: ["Gangnam Style", "Godzilla", "Believer", "Numb", "Say So", "American Idiot"],
    bannerImage: "banner_heatstar_plus",
    bannerGradient: { colorTop: "0xFF5500", colorBottom: "0x880000" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2002,
    idLabel: "Event_Eminem_CurtainCall2",
    nameTxt: "<b>EMINEM: CURTAIN CALL 2</b>",
    eventFlavourTxt: "Celebrate the Rap God with high-intensity Eminem anthems and exclusive cosmetic rewards.",
    type: 3,
    template: "ArtistSpecialTemplate",
    durationDays: 3,
    featuredSongNames: ["Godzilla", "From the D 2 the LBC", "Godzilla", "Feel Good Inc."],
    bannerImage: "banner_eminem_curtaincall2",
    bannerGradient: { colorTop: "0xD90429", colorBottom: "0x2B2D42" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2003,
    idLabel: "Event_LinkinPark_Meteora20",
    nameTxt: "<b>LINKIN PARK: METEORA 20</b>",
    eventFlavourTxt: "Honor 20 years of Meteora with iconic nu-metal masterpieces and legendary rock hits.",
    type: 3,
    template: "ArtistSpecialTemplate",
    durationDays: 3,
    featuredSongNames: ["Numb", "In The End", "Breaking The Law", "Sugar, We're Goin Down"],
    bannerImage: "banner_linkinpark_meteora20",
    bannerGradient: { colorTop: "0x3D5A80", colorBottom: "0x293241" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2004,
    idLabel: "Event_ImagineDragons_NightVisions",
    nameTxt: "<b>IMAGINE DRAGONS ANNIVERSARY</b>",
    eventFlavourTxt: "Get ready for radioactive energy! Unleash your stadium rock rhythm in this championship.",
    type: 3,
    template: "ArtistSpecialTemplate",
    durationDays: 3,
    featuredSongNames: ["Believer", "Radioactive", "Sharks", "Enemy", "Bones"],
    bannerImage: "banner_imaginedragons_nightvisions",
    bannerGradient: { colorTop: "0x6075B2", colorBottom: "0x37427A" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2005,
    idLabel: "Event_DeluxeDash_Plus",
    nameTxt: "<b>DELUXE DASH PLUS</b>",
    eventFlavourTxt: "Experience chart-topping anthems upgraded to extreme Deluxe difficulty with swipe patterns.",
    type: 3,
    template: "DeluxeDashTemplate",
    durationDays: 3,
    featuredSongNames: ["Wake Me Up", "Enter Sandman", "Last Resort", "MONTERO (Call Me By Your Name)"],
    bannerImage: "banner_deluxe_dash_plus",
    bannerGradient: { colorTop: "0xFFD700", colorBottom: "0xFF8C00" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2006,
    idLabel: "Event_Cherry_Blossom_Festival",
    nameTxt: "<b>CHERRY BLOSSOM FESTIVAL</b>",
    eventFlavourTxt: "Welcome the spring bloom with elegant melodies and serene rhythm challenges.",
    type: 3,
    template: "ThemedEventTemplate",
    durationDays: 3,
    featuredSongNames: ["Say So", "Love Me Like You Do", "Feel Good Inc.", "Gangnam Style"],
    bannerImage: "banner_cherry_blossom",
    bannerGradient: { colorTop: "0xFFB7C5", colorBottom: "0xFF69B4" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2007,
    idLabel: "Event_Halloween_TrickOrTreat",
    nameTxt: "<b>TRICK OR TREAT SPOOKTACULAR</b>",
    eventFlavourTxt: "Enter the haunted realm! Spooky beats, dark basslines, and terrifying note density await.",
    type: 3,
    template: "HolidayEventTemplate",
    durationDays: 3,
    featuredSongNames: ["Firestarter", "Godzilla", "Enter Sandman", "Hey Ya!"],
    bannerImage: "banner_halloween_trick_or_treat",
    bannerGradient: { colorTop: "0xFF7518", colorBottom: "0x4B0082" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2008,
    idLabel: "Event_St_Patricks_Parade",
    nameTxt: "<b>ST. PATRICK'S PARADE</b>",
    eventFlavourTxt: "May the luck of the Irish be with you! Spin the pot of gold for shamrock rewards.",
    type: 3,
    template: "HolidayEventTemplate",
    durationDays: 3,
    featuredSongNames: ["Feel Good Inc.", "Believer", "Breaking The Law", "Gangnam Style"],
    bannerImage: "banner_st_patricks",
    bannerGradient: { colorTop: "0x009A49", colorBottom: "0xFF7900" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2009,
    idLabel: "Event_LunarNewYear_RedEnvelope",
    nameTxt: "<b>LUNAR NEW YEAR: RED ENVELOPE</b>",
    eventFlavourTxt: "Celebrate the Year of the Dragon with auspicious tracks and abundant prize tokens.",
    type: 3,
    template: "HolidayEventTemplate",
    durationDays: 3,
    featuredSongNames: ["Gangnam Style", "Say So", "Hey Ya!", "Godzilla"],
    bannerImage: "banner_lunar_new_year",
    bannerGradient: { colorTop: "0xDE2910", colorBottom: "0xFFDE00" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 2010,
    idLabel: "Event_WinterWonderland_ItsAWrap",
    nameTxt: "<b>IT'S A WRAP: HOLIDAY SPECTACULAR</b>",
    eventFlavourTxt: "Wrap up the year with the greatest hits, holiday specials, and festive winter beats!",
    type: 3,
    template: "HolidayEventTemplate",
    durationDays: 3,
    featuredSongNames: ["Blinding Lights", "Believer", "Numb", "Wake Me Up", "Hey Ya!"],
    bannerImage: "banner_winter_wonderland",
    bannerGradient: { colorTop: "0x00B4D8", colorBottom: "0x0077B6" },
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 3001,
    idLabel: "Event_Totaliser_BeatPop",
    nameTxt: "<b>BEAT POP TOTALISER</b>",
    eventFlavourTxt: "Collect Event Beats across pop classics to unlock exclusive cosmetic boxes and cards.",
    type: 4,
    template: "BeatChaserTotaliserTemplate",
    durationDays: 3,
    featuredSongNames: ["Say So", "Love Me Like You Do", "Hey Ya!", "Feel Good Inc."],
    bannerImage: "banner_beat_pop",
    tileRimColour: "0xFF1493",
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
  {
    id: 3002,
    idLabel: "Event_Totaliser_GreenGameJam",
    nameTxt: "<b>EARTH DAY: GREEN GAME JAM</b>",
    eventFlavourTxt: "Play for the planet! Collect eco-beats and unlock the exclusive Harlequin Toad skin.",
    type: 4,
    template: "BeatChaserTotaliserTemplate",
    durationDays: 3,
    featuredSongNames: ["Feel Good Inc.", "Hey Ya!", "Believer", "Wake Me Up"],
    bannerImage: "banner_green_game_jam",
    tileRimColour: "0x2E8B57",
    rewardTokens: { "1": 25, "2": 20, "3": 18, "4": 15, "5": 12, "6": 10, "7": 8, "8": 5 },
  },
];

export class LiveOpsCalendar {
  private static readonly DAY_MSECS = 86400000;
  private static readonly ANNOUNCE_WINDOW_MSECS = 86400000 * 2; // 48 hours announcement

  /**
   * Resolves valid song IDs from catalog, guaranteeing excluding missing ID 990
   */
  private static resolveValidSongIds(preferredNames: string[], count: number = 3): number[] {
    CatalogStore.load();
    const songs = CatalogStore.getSongs();
    const result: number[] = [];

    for (const name of preferredNames) {
      const match = songs.find(
        (s) => s.name?.toLowerCase().includes(name.toLowerCase()) && s.id !== 990
      );
      if (match && !result.includes(match.id)) {
        result.push(match.id);
      }
      if (result.length >= count) break;
    }

    // Fallbacks if fewer found
    let idx = 0;
    while (result.length < count && idx < songs.length) {
      const sid = songs[idx].id;
      if (sid !== 990 && !result.includes(sid)) {
        result.push(sid);
      }
      idx++;
    }

    return result.length > 0 ? result : [1, 3, 4];
  }

  /**
   * Resolves 3 deterministic, unique valid song IDs for Daily Shuffle based on cycle day,
   * cycling across all 1,262 official songs forever.
   */
  private static resolveDailyShuffleSongIds(cycleDay: number): number[] {
    CatalogStore.load();
    const songs = CatalogStore.getSongs().filter((s) => s.id !== 990);
    if (songs.length === 0) return [1, 3, 4];
    const total = songs.length;
    const safeDay = ((cycleDay % 1000000) + 1000000) % 1000000;
    const idx1 = (safeDay * 7) % total;
    const idx2 = (safeDay * 7 + 17) % total;
    const idx3 = (safeDay * 7 + 43) % total;
    const res = [songs[idx1].id, songs[idx2].id, songs[idx3].id];
    return Array.from(new Set(res));
  }

  /**
   * Generates the rolling LiveOpsEvents config:
   * 1. Daily Song Shuffle (always active for current 24h cycle)
   * 2. Active Multi-Day Event / Showdown (currently ongoing)
   * 3. Upcoming Announced Event (starting within 48h)
   */
  static getRollingEvents(now: number = Date.now()): any[] {
    const cycleDay = Math.floor(now / this.DAY_MSECS);
    const dayStart = cycleDay * this.DAY_MSECS;
    const dayEnd = dayStart + this.DAY_MSECS;

    const eventsList: any[] = [];

    // 1. Daily Song Shuffle Event (Always Active, dynamically rotates every 24h)
    const shuffleSongIds = this.resolveDailyShuffleSongIds(cycleDay);
    eventsList.push({
      id: 1001,
      idLabel: "Daily_Shuffle",
      nameTxt: "Daily Shuffle",
      startTimeMsecs: dayStart,
      endTimeMsecs: dayEnd,
      useLocalTime: true,
      developmentState: 1,
      type: 2, // LiveOpsSongShuffleEventTemplate
      template: "DailyShuffleTemplate",
      LiveOpsSongShuffleEventTemplate: {
        numSongs: 3,
        numPlays: 2,
        repeatDurationMsecs: this.DAY_MSECS,
        pickedBeatmaps_id: shuffleSongIds,
      },
    });

    // 2. Multi-Day Event Cycle (Each event runs for strictly 3 days, perfectly aligned)
    const masterEvents = HISTORICAL_MASTER_EVENTS;
    const totalEvents = masterEvents.length;
    
    const safeCycle = Math.floor(cycleDay / 3);
    const currentEventIndex = ((safeCycle % totalEvents) + totalEvents) % totalEvents;
    const nextEventIndex = (currentEventIndex + 1) % totalEvents;

    const currentDef = masterEvents[currentEventIndex];
    const nextDef = masterEvents[nextEventIndex];

    const currentEventStart = safeCycle * 3 * this.DAY_MSECS;
    const currentEventEnd = currentEventStart + 3 * this.DAY_MSECS;

    const nextEventStart = currentEventEnd;
    const nextEventEnd = nextEventStart + 3 * this.DAY_MSECS;

    // A. Add Current Active Showdown/Event
    const activeSongIds = this.resolveValidSongIds(currentDef.featuredSongNames, 2);
    eventsList.push({
      id: currentDef.id,
      idLabel: currentDef.idLabel,
      nameTxt: currentDef.nameTxt,
      startTimeMsecs: currentEventStart,
      endTimeMsecs: currentEventEnd,
      useLocalTime: true,
      developmentState: 1,
      type: currentDef.type,
      template: currentDef.template,
      LiveOpsLeaderboardEventTemplate: {
        numPlayers: 8,
        numAiPlayers: 7,
        numAttempts: 3,
        playActiveDurationMsecs: currentDef.durationDays * this.DAY_MSECS,
        eventEndedCooloffDurationMsecs: 3600000,
        spinTicketCost: { currency_id: 9, amount: 10 },
        initialTickets: 20,
        eventFlavourTxt: currentDef.eventFlavourTxt,
        segments: activeSongIds.map((sid) => ({
          beatmaps: [{ beatmap_id: sid, buyCost: 0 }],
        })),
        rewardTiers: [
          { position: 1, tokens: 25 },
          { position: 2, tokens: 20 },
          { position: 3, tokens: 18 },
          { position: 4, tokens: 15 },
          { position: 5, tokens: 12 },
          { position: 6, tokens: 10 },
          { position: 7, tokens: 8 },
          { position: 8, tokens: 5 },
        ],
      },
    });

    // B. Add Upcoming Announced Event (if within announcement window)
    if (nextEventStart - now <= this.ANNOUNCE_WINDOW_MSECS) {
      const upcomingSongIds = this.resolveValidSongIds(nextDef.featuredSongNames, 2);
      eventsList.push({
        id: nextDef.id,
        idLabel: nextDef.idLabel,
        nameTxt: nextDef.nameTxt,
        startTimeMsecs: nextEventStart,
        endTimeMsecs: nextEventEnd,
        useLocalTime: true,
        developmentState: 1,
        type: nextDef.type,
        template: nextDef.template,
        LiveOpsLeaderboardEventTemplate: {
          numPlayers: 8,
          numAiPlayers: 7,
          numAttempts: 3,
          playActiveDurationMsecs: nextDef.durationDays * this.DAY_MSECS,
          eventEndedCooloffDurationMsecs: 3600000,
          spinTicketCost: { currency_id: 9, amount: 10 },
          initialTickets: 20,
          eventFlavourTxt: nextDef.eventFlavourTxt,
          segments: upcomingSongIds.map((sid) => ({
            beatmaps: [{ beatmap_id: sid, buyCost: 0 }],
          })),
          rewardTiers: [
            { position: 1, tokens: 25 },
            { position: 2, tokens: 20 },
            { position: 3, tokens: 18 },
            { position: 4, tokens: 15 },
            { position: 5, tokens: 12 },
            { position: 6, tokens: 10 },
            { position: 7, tokens: 8 },
            { position: 8, tokens: 5 },
          ],
        },
      });
    }

    Logger.log(`[LiveOpsCalendar] Generated ${eventsList.length} rolling events (Active: ${currentDef.nameTxt})`);
    return eventsList;
  }
}
