import Logger from "../lib/Logger.js";

/**
 * Ensures FirstPlayGameBehaviour and GameBehaviourController don't pause the rhythm game
 */
export const bypassTutorialBlock = () => {
  try {
    const assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;
    
    const gbc = assembly.class("RhythmGame.GameBehaviours.GameBehaviourController");
    if (gbc) {
      gbc.methods.forEach(m => {
        if (m.name === "ShouldBeBlocked" || m.name === "ShouldStopForBlockAndStop" || m.name === "get_SoftFailEnabled") {
          m.implementation = function(...args: any[]) {
            return false;
          };
        }
      });
    }

    const firstPlay = assembly.class("RhythmGame.GameBehaviours.FirstPlayGameBehaviour");
    if (firstPlay) {
      firstPlay.methods.forEach(m => {
        if (m.name === "ShouldBeBlocked" || m.name === "ShouldStopForBlockAndStop") {
          m.implementation = function(...args: any[]) {
            return false;
          };
        }
      });
    }
    Logger.log("[BeatClone] bypassTutorialBlock applied successfully");
  } catch(e: any) {
    Logger.log(`[BeatClone] bypassTutorialBlock error: ${e.message}`);
  }
};
