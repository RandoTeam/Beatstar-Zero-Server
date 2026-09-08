import Logger from "./Logger";

class InternalClassCache {
  langConfig: any;
  unlockSongProcess: any;
  userBeatmaps: any;
  onLangConfigReady: Array<() => void> = [];
  onUserBeatmapsReady: Array<() => void> = [];

  constructor() {
    const self = this;
    const lang = Il2Cpp.domain.assembly("SpaceApe.Lang").image;
    const metalogic = Il2Cpp.domain.assembly("MetaLogic").image;

    lang
      .class("com.spaceape.sharedlang.LangConfig")
      .method("Read").implementation = function (input) {
      Logger.log("Saved lang config instance.");
      this.method("Read").invoke(input);
      self.langConfig = this;
      const cbs = self.onLangConfigReady.splice(0);
      for (const cb of cbs) cb();
    };

    metalogic.class("UnlockSongProcess").method(".ctor").implementation =
      function () {
        Logger.log("Saved unlock song process instance.");
        this.method(".ctor").invoke();
        self.unlockSongProcess = this;
        self._fireUserBeatmapsReadyIfBothSet();
      };

    metalogic
      .class("com.spaceape.flamingo.model.UserBeatmaps")
      .method(".ctor").implementation = function (beatmaps) {
      Logger.log("Saved user beatmaps instance.");
      this.method(".ctor").invoke(beatmaps);
      self.userBeatmaps = this;
      self._fireUserBeatmapsReadyIfBothSet();
    };
  }

  _fireUserBeatmapsReadyIfBothSet() {
    if (this.userBeatmaps && this.onUserBeatmapsReady.length > 0) {
      Logger.log("[ClassCache] userBeatmaps ready, firing callbacks...");
      const cbs = this.onUserBeatmapsReady.splice(0);
      for (const cb of cbs) cb();
    }
  }
}

const ClassCache = new InternalClassCache();
export default ClassCache;
