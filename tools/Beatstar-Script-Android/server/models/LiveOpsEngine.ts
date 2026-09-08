import { LiveOpsCalendar } from "./LiveOpsCalendar.js";
import { SeasonEngine } from "./SeasonEngine.js";
import { ShowdownEngine } from "./ShowdownEngine.js";
import { NewsEngine } from "./NewsEngine.js";
import Logger from "../../lib/Logger.js";

export class LiveOpsEngine {
  /**
   * Generates active & upcoming LiveOps events config (Daily Shuffle + Multi-Day Tournaments)
   */
  static getLiveOpsEventConfig(now: number = Date.now()): any {
    return {
      LiveOpsEvents: LiveOpsCalendar.getRollingEvents(now),
    };
  }

  /**
   * Generates active Season / Tour Pass config
   */
  static getLiveOpsSeasonConfig(now: number = Date.now()): any {
    return SeasonEngine.getLiveOpsSeasonConfig(now);
  }

  /**
   * Generates verified Community Hub & News Feed stories
   */
  static getNewsFeedStories(): any[] {
    return NewsEngine.getNewsFeedStories();
  }
}
