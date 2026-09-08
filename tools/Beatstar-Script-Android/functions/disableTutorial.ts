import Logger from "../lib/Logger.js";

/**
 * Ensures the game skips all FTUE/tutorial dialogs and goes straight to the Main Menu / Lobby.
 * Only overrides specific tutorial flag IDs (from the original reference implementation),
 * NOT all flags — that would cause TutorialPopupBubbleUi to grab UI interaction locks.
 */
export const disableTutorial = () => {
  try {
    const metalogic = Il2Cpp.domain.assembly("MetaLogic")?.image;
    if (metalogic) {
      const userFlags = metalogic.class("com.spaceape.flamingo.model.UserFtueFlags");
      if (userFlags) {
        Logger.log("[disableTutorial] Hooking UserFtueFlags (IsSkipTutorialFlagSet & IsFlagSet)...");

        const skipMethod = userFlags.method("IsSkipTutorialFlagSet");
        if (skipMethod) {
          skipMethod.implementation = function () {
            return true;
          };
        }

        // Only these specific FTUE flag IDs should be forced true (from reference repo)
        const tutorialFlagIds = [1, 2, 3, 4, 16, 55, 87, 89];

        const isFlagSetMethod = userFlags.method("IsFlagSet");
        if (isFlagSetMethod) {
          isFlagSetMethod.implementation = function (flag: any) {
            const id = flag.field("id").value;
            if (tutorialFlagIds.includes(id)) {
              return true;
            }
            return this.method("IsFlagSet").invoke(flag);
          };
        }
      }
    }
    Logger.log("[disableTutorial] Tutorial bypass hooks installed successfully");
  } catch (e: any) {
    Logger.log(`[disableTutorial] Hook error: ${e.message}`);
  }
};
