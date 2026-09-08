import Logger from "../lib/Logger.js";
import ClassResolver from "../lib/ClassResolver.js";

/**
 * PlaySongScreen UI Navigation & Interaction Guard:
 * 1. Guards TryAddNewMedalAchievedSteps against NullReferenceException when loading unplayed/deluxe tracks.
 * 2. Guards SetupFullAnimationIntro and ensures transition coroutines finish cleanly.
 * 3. Prevents permanent interaction lock hangs on the main screen.
 * 4. Suppresses SharplaToRpcExecuter.OnLocalExecutionFailure to prevent Sharpla audit errors
 *    (like 1501 "SongTO not owned") from throwing fatal exceptions that break coroutine flow.
 */
export const hookPlaySongScreen = () => {
  try {
    const assembly = Il2Cpp.domain.assembly("Assembly-CSharp")?.image;
    if (!assembly) {
      Logger.log("[hookPlaySongScreen] Assembly-CSharp not found");
      return;
    }

    const playSongScreenClass = assembly.class("PlaySongScreen");
    if (playSongScreenClass) {
      const tryAddNewMedal = playSongScreenClass.method("TryAddNewMedalAchievedSteps");
      if (tryAddNewMedal) {
        tryAddNewMedal.implementation = function () {
          try {
            return tryAddNewMedal.bind(this).invoke();
          } catch (e: any) {
            Logger.log(`[hookPlaySongScreen] Guarded TryAddNewMedalAchievedSteps NRE: ${e.message}`);
          }
        };
        Logger.log("[hookPlaySongScreen] Hooked and guarded PlaySongScreen.TryAddNewMedalAchievedSteps");
      }

      const setupFullIntro = playSongScreenClass.method("SetupFullAnimationIntro");
      if (setupFullIntro) {
        setupFullIntro.implementation = function () {
          try {
            return setupFullIntro.bind(this).invoke();
          } catch (e: any) {
            Logger.log(`[hookPlaySongScreen] Guarded SetupFullAnimationIntro: ${e.message}`);
          }
        };
        Logger.log("[hookPlaySongScreen] Hooked and guarded PlaySongScreen.SetupFullAnimationIntro");
      }
    }

    // Safety net: Suppress SharplaToRpcExecuter.OnLocalExecutionFailure
    // In offline mode, Sharpla audit failures (1501, etc.) must NOT throw exceptions.
    // The GetOwnedBeatmap hook in hookProfile.ts is the primary fix; this is the fallback.
    const sharplaExecuterClass = ClassResolver.findClass("SharplaToRpcExecuter", "Assembly-CSharp")
      || ClassResolver.findClass("SharplaToRpcExecuter");
    if (sharplaExecuterClass) {
      const onFailure = ClassResolver.tryMethod(sharplaExecuterClass, "OnLocalExecutionFailure", 1);
      if (onFailure) {
        onFailure.implementation = function (result: any) {
          try {
            let errorMsg = "unknown";
            try { errorMsg = result.field("ErrorMessage").value?.toString() || "unknown"; } catch (e) {}
            let errorCode = 0;
            try { errorCode = result.field("Error").value as number; } catch (e) {}
            Logger.log(`[hookPlaySongScreen] Suppressed Sharpla failure code=${errorCode}: ${errorMsg}`);
          } catch (e) {}
          // Do NOT call original — it throws Exception that kills coroutines
        };
        Logger.log("[hookPlaySongScreen] Hooked SharplaToRpcExecuter.OnLocalExecutionFailure (suppressed)");
      }
    }
  } catch (e: any) {
    Logger.log(`[hookPlaySongScreen] Warning: ${e.message}`);
  }
};
