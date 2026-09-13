import Java from "frida-java-bridge";
import ClassResolver from "../lib/ClassResolver.js";
import Logger from "../lib/Logger.js";
import { NativeLoaderUI } from "../lib/NativeLoaderUI.js";

/**
 * Hardens standalone offline operation:
 * 1. Blocks external JVM network sockets (keeps loopback intact).
 * 2. Bypasses GDPR dialog on startup.
 * 3. Suppresses modal crash popups in ErrorHandling for smooth UX.
 * 4. Silences LogstashSender disk spam to eliminate UI stutter.
 */
export const hardenOffline = () => {
  try {
    // 1. Guard against external Socket connections
    if (Java.available) {
      Java.perform(() => {
        try {
          const Socket = Java.use("java.net.Socket");
          
          Socket.connect.overload("java.net.SocketAddress", "int").implementation = function (addr: any, timeout: number) {
            try {
              const host = addr.getHostString ? addr.getHostString() : addr.toString();
              if (host && !host.includes("127.0.0.1") && !host.includes("localhost")) {
                throw Java.use("java.io.IOException").$new("Offline mode: external connection blocked");
              }
            } catch (e: any) {
              if (e.getMessage && e.getMessage().includes("Offline mode")) throw e;
            }
            return this.connect(addr, timeout);
          };
        } catch (e: any) {
          Logger.log(`[OfflineHarden] Java socket hook warning: ${e.message}`);
        }
      });
    }

    // 2. Safe IL2CPP stubs for startup, GDPR & ErrorHandling
    try {
      const assembly = Il2Cpp.domain.assembly("Assembly-CSharp")?.image;
      if (assembly) {
        // Bypass GDPR Privacy Dialog during startup
        const startupCmd = assembly.class("BeatStar.Startup.StartupApp_Command");
        if (startupCmd) {
          const needGdpr = startupCmd.method("NeedToShowGdprPrivacyDialog");
          if (needGdpr) {
            needGdpr.implementation = function (): boolean {
              Logger.log("[OfflineHarden] NeedToShowGdprPrivacyDialog -> bypassed (false)");
              return false;
            };
          }

          const showGdpr = startupCmd.method("ShowGDPRPrivacyDialogIfRequired");
          if (showGdpr) {
            showGdpr.implementation = function (...args: any[]) {
              Logger.log("[OfflineHarden] ShowGDPRPrivacyDialogIfRequired -> bypassed (null)");
              return null;
            };
          }
        }

        // Suppress blocking modal error popups and restarts for seamless offline UX
        // Prevent PlaySongScreen coroutine crashes on custom songs
        const userFriendBrags = ClassResolver.findClass("UserFriendBrags");
        if (userFriendBrags) {
          const isBragStillValid = ClassResolver.tryMethod(userFriendBrags, "IsBragStillValid", 1);
          if (isBragStillValid) {
            isBragStillValid.implementation = function(beatmap: any) {
              return false; // Offline mode has no valid friend brags
            };
            Logger.log("[OfflineHarden] UserFriendBrags.IsBragStillValid hooked -> false");
          }
        }

        const errorHandling = assembly.class("ErrorHandling");
        if (errorHandling) {
          errorHandling.methods.forEach(m => {
            if (
              m.name === "ShowIncident" ||
              m.name === "JustShowErrorPopup" ||
              m.name === "HandleUnityLog" ||
              m.name === "ThrowUnityError" ||
              m.name === "Throw"
            ) {
              m.implementation = function (...args: any[]): void {
                try {
                  Logger.log(`[OfflineHarden] Suppressed ErrorHandling.${m.name}: ${args.map(a => a ? a.toString() : "null").join(", ")}`);
                } catch (e) {}
              };
            } else if (m.name === "ShowQueuedError" || m.name === "get_HasQueuedIncident") {
              m.implementation = function (): boolean {
                return false;
              };
            }
          });
          Logger.log("[OfflineHarden] ErrorHandling modal popups suppressed.");
        }

        // Guard GameAssetPreloader to prevent startup coroutine crashes on missing season bundles
        const preloaderClass = assembly.class("BeatStar.GameAssets.GameAssetPreloader");
        if (preloaderClass) {
          const queueSeason = preloaderClass.tryMethod("QueueSeasonGachaBoxPreloading", 1);
          if (queueSeason) {
            queueSeason.implementation = function (this: Il2Cpp.Object, seasonTemplate: any): void {
              try {
                queueSeason.bind(this).invoke(seasonTemplate);
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely suppressed QueueSeasonGachaBoxPreloading error: ${e.message}`);
              }
            };
          }

          const refreshSeason = preloaderClass.tryMethod("RefreshSeasonGachaBoxPreloading", 1);
          if (refreshSeason) {
            refreshSeason.implementation = function (this: Il2Cpp.Object, tryLookFuture: any): void {
              try {
                refreshSeason.bind(this).invoke(tryLookFuture);
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely suppressed RefreshSeasonGachaBoxPreloading error: ${e.message}`);
              }
            };
          }

          const queueLeaderboard = preloaderClass.tryMethod("QueueLeaderboardEventSongsPreloading", 1);
          if (queueLeaderboard) {
            queueLeaderboard.implementation = function (this: Il2Cpp.Object, ev: any): void {
              try {
                queueLeaderboard.bind(this).invoke(ev);
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely suppressed QueueLeaderboardEventSongsPreloading error: ${e.message}`);
              }
            };
          }
          Logger.log("[OfflineHarden] GameAssetPreloader methods guarded.");
        }

        // Guard MainMenu.RefreshRoostering: In offline mode, missing server network data
        // throws uncaught NullReferenceException causing the StartCustomisationsFlow coroutine
        // to abort, leaving the EventSystem permanently locked.
        const mainMenuClass = ClassResolver.findClass("MainMenu");
        if (mainMenuClass) {
          const refreshRoostering = ClassResolver.tryMethod(mainMenuClass, "RefreshRoostering", 0);
          if (refreshRoostering) {
            refreshRoostering.implementation = function (this: Il2Cpp.Object): void {
              try {
                refreshRoostering.bind(this).invoke();
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely suppressed MainMenu.RefreshRoostering error: ${e.message}`);
              }
            };
          }
          Logger.log("[OfflineHarden] MainMenu.RefreshRoostering safely guarded against crashes.");

          const mainMenuCtrlClass = ClassResolver.findClass("MainMenuController");
          if (mainMenuCtrlClass) {
            const refreshCtrl = ClassResolver.tryMethod(mainMenuCtrlClass, "RefreshRoostering", 0);
            if (refreshCtrl) {
              refreshCtrl.implementation = function (this: Il2Cpp.Object): void {
                try {
                  refreshCtrl.bind(this).invoke();
                } catch (e: any) {
                  Logger.log(`[OfflineHarden] Safely suppressed MainMenuController.RefreshRoostering error: ${e.message}`);
                }
              };
            }
            Logger.log("[OfflineHarden] MainMenuController.RefreshRoostering guarded.");
          }

          // Dismiss NativeLoaderUI when MainMenu scene is rendered
          const startMethod = ClassResolver.tryMethod(mainMenuClass, "Start", 0);
          if (startMethod) {
            startMethod.implementation = function (this: Il2Cpp.Object): void {
              try {
                startMethod.bind(this).invoke();
              } catch (e) {}
              Logger.log("[OfflineHarden] MainMenu.Start fired — dismissing NativeLoaderUI with fade-out");
              NativeLoaderUI.updateProgress(100, "Welcome to Beatstar!");
              setTimeout(() => NativeLoaderUI.hide(), 500);
            };
            Logger.log("[OfflineHarden] MainMenu.Start hooked for NativeLoaderUI handoff.");
          }
        }

        // Guard UserBeatmaps.PopulateValidationNumbers
        const userBeatmapsClass = ClassResolver.findClass("UserBeatmaps");
        if (userBeatmapsClass) {
          const popMethod = ClassResolver.tryMethod(userBeatmapsClass, "PopulateValidationNumbers", 3);
          if (popMethod) {
            popMethod.implementation = function (this: Il2Cpp.Object, numOwnedSongs: any, totalSongScore: any, lastSong: any): void {
              try {
                popMethod.bind(this).invoke(numOwnedSongs, totalSongScore, lastSong);
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely guarded UserBeatmaps.PopulateValidationNumbers: ${e.message}`);
              }
            };
            Logger.log("[OfflineHarden] UserBeatmaps.PopulateValidationNumbers guarded.");
          }
        }
        // Guard ShufflePlayController.RefreshNextBeatmaps against collection enumeration exceptions
        const shufflePlayClass = ClassResolver.findClass("ShufflePlayController");
        if (shufflePlayClass) {
          const refreshMethod = ClassResolver.tryMethod(shufflePlayClass, "RefreshNextBeatmaps", 0);
          if (refreshMethod) {
            refreshMethod.implementation = function (this: Il2Cpp.Object): void {
              try {
                refreshMethod.bind(this).invoke();
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely guarded ShufflePlayController.RefreshNextBeatmaps: ${e.message}`);
              }
            };
            Logger.log("[OfflineHarden] ShufflePlayController.RefreshNextBeatmaps guarded.");
          }
        }


        // Guard LiveOpsLeaderboardEvent against segment index out of bounds
        const leaderboardEventClass = ClassResolver.findClass("LiveOpsLeaderboardEvent");
        if (leaderboardEventClass) {
          const getSegmentNow = ClassResolver.tryMethod(leaderboardEventClass, "GetSegmentNow", 0);
          if (getSegmentNow) {
            getSegmentNow.implementation = function (this: Il2Cpp.Object): any {
              try {
                return getSegmentNow.bind(this).invoke();
              } catch (e: any) {
                try {
                  const tmpl = this.field("template")?.value as Il2Cpp.Object;
                  if (tmpl) {
                    const segments = tmpl.field("segments")?.value as Il2Cpp.Array<Il2Cpp.Object>;
                    if (segments && segments.length > 0) {
                      return segments.get(0);
                    }
                  }
                } catch (e2) {}
                return null;
              }
            };
          }

          const getSegmentIndexNow = ClassResolver.tryMethod(leaderboardEventClass, "GetSegmentIndexNow", 0);
          if (getSegmentIndexNow) {
            getSegmentIndexNow.implementation = function (this: Il2Cpp.Object): number {
              try {
                const idx = getSegmentIndexNow.bind(this).invoke() as number;
                return Math.max(0, idx);
              } catch (e) {
                return 0;
              }
            };
          }
          Logger.log("[OfflineHarden] LiveOpsLeaderboardEvent segment bounds guarded via ClassResolver.");
        }

        // Guard SongLeaderboardEvent_MainElement against state update exceptions
        const mainElementClass = ClassResolver.findClass("SongLeaderboardEvent_MainElement");
        if (mainElementClass) {
          const updateState = ClassResolver.tryMethod(mainElementClass, "UpdateState", 0);
          if (updateState) {
            updateState.implementation = function (this: Il2Cpp.Object): void {
              try {
                updateState.bind(this).invoke();
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely caught SongLeaderboardEvent_MainElement.UpdateState: ${e.message}`);
              }
            };
          }
          Logger.log("[OfflineHarden] SongLeaderboardEvent_MainElement guarded via ClassResolver.");
        }

        // Fix EventsScreen and SocialScreen (Hub) zombie overlay bug and disable unused tabs
        try {
          let cachedEventsScreen: Il2Cpp.Object | null = null;
          let cachedEventsController: Il2Cpp.Object | null = null;
          let cachedSocialScreen: Il2Cpp.Object | null = null;
          let cachedSocialController: Il2Cpp.Object | null = null;

          const ensureEventsScreenHidden = () => {
            try {
              let screen = cachedEventsScreen;
              const eventsScreenClass = ClassResolver.findClass("EventsScreen");
              if ((!screen || screen.isNull()) && eventsScreenClass) {
                const instances = Il2Cpp.gc.choose(eventsScreenClass);
                if (instances && instances.length > 0 && !instances[0].isNull()) {
                  screen = instances[0];
                  cachedEventsScreen = screen;
                }
              }

              if (screen && !screen.isNull()) {
                // 1. Stop all active animations & coroutines (e.g. PlayTransitionInFlow)
                try {
                  const stopAll = screen.class.method("StopAllCoroutines");
                  if (stopAll) stopAll.bind(screen).invoke();
                } catch (e) {}

                // 2. Suppress canvas visuals & raycasts immediately
                try {
                  const visuals = screen.field("screenVisuals")?.value as Il2Cpp.Object;
                  if (visuals && !visuals.isNull()) {
                    const setAlpha = visuals.class.method("set_alpha");
                    if (setAlpha) setAlpha.bind(visuals).invoke(0.0);
                    const setInteractable = visuals.class.method("set_interactable");
                    if (setInteractable) setInteractable.bind(visuals).invoke(false);
                    const setRaycasts = visuals.class.method("set_blocksRaycasts");
                    if (setRaycasts) setRaycasts.bind(visuals).invoke(false);
                  }
                } catch (e) {}

                // 3. Disable display canvas
                try {
                  const displayCanvas = screen.field("displayCanvas")?.value as Il2Cpp.Object;
                  if (displayCanvas && !displayCanvas.isNull()) {
                    const setEnabled = displayCanvas.class.method("set_enabled");
                    if (setEnabled) setEnabled.bind(displayCanvas).invoke(false);
                  }
                } catch (e) {}

                // 4. Disable background blur if active
                try {
                  const disableBlur = ClassResolver.tryMethod(screen.class, "DisableBackgroundBlur", 0);
                  if (disableBlur) disableBlur.bind(screen).invoke();
                } catch (e) {}

                // 5. Deactivate GameObject so it stops rendering completely
                try {
                  const getGo = screen.class.method("get_gameObject");
                  if (getGo) {
                    const go = getGo.bind(screen).invoke() as Il2Cpp.Object;
                    if (go && !go.isNull()) {
                      const setActive = go.class.method("SetActive");
                      if (setActive) setActive.bind(go).invoke(false);
                    }
                  }
                } catch (e) {}

                // 6. Reset State to Inactive (2) so UIScreen.Enter allows future re-entry
                try {
                  const setState = ClassResolver.tryMethod(screen.class, "set_State", 1);
                  if (setState) {
                    setState.bind(screen).invoke(2);
                  } else {
                    const stateField = screen.field("<State>k__BackingField");
                    if (stateField) stateField.value = 2;
                  }
                } catch (e) {
                  try {
                    const stateField = screen.field("<State>k__BackingField");
                    if (stateField) stateField.value = 2;
                  } catch (e2) {}
                }

                Logger.log("[OfflineHarden] EventsScreen safely hidden and synchronized to Inactive state.");
              }

              if (cachedEventsController && !cachedEventsController.isNull()) {
                try {
                  const activeField = cachedEventsController.field("<Active>k__BackingField");
                  if (activeField) activeField.value = false;
                } catch (e) {}
              }
            } catch (err: any) {
              Logger.log(`[OfflineHarden] ensureEventsScreenHidden error: ${err.message}`);
            }
          };

          const ensureSocialScreenHidden = () => {
            try {
              let screen = cachedSocialScreen;
              const socialScreenClass = ClassResolver.findClass("SocialScreen");
              if ((!screen || screen.isNull()) && socialScreenClass) {
                const instances = Il2Cpp.gc.choose(socialScreenClass);
                if (instances && instances.length > 0 && !instances[0].isNull()) {
                  screen = instances[0];
                  cachedSocialScreen = screen;
                }
              }

              if (screen && !screen.isNull()) {
                // 1. Stop all active animations & coroutines
                try {
                  const stopAll = screen.class.method("StopAllCoroutines");
                  if (stopAll) stopAll.bind(screen).invoke();
                } catch (e) {}

                // 2. Disable display canvas (UIScreen base)
                try {
                  const displayCanvas = screen.field("displayCanvas")?.value as Il2Cpp.Object;
                  if (displayCanvas && !displayCanvas.isNull()) {
                    const setEnabled = displayCanvas.class.method("set_enabled");
                    if (setEnabled) setEnabled.bind(displayCanvas).invoke(false);
                  }
                } catch (e) {}

                // 3. Disable background blur if active
                try {
                  const ftueTabBlur = screen.field("ftueTabBlur")?.value as Il2Cpp.Object;
                  if (ftueTabBlur && !ftueTabBlur.isNull()) {
                    const getGo = ftueTabBlur.class.method("get_gameObject");
                    if (getGo) {
                      const go = getGo.bind(ftueTabBlur).invoke() as Il2Cpp.Object;
                      if (go && !go.isNull()) {
                        const setActive = go.class.method("SetActive");
                        if (setActive) setActive.bind(go).invoke(false);
                      }
                    }
                  }
                } catch (e) {}

                // 4. Deactivate GameObject so it stops rendering completely
                try {
                  const getGo = screen.class.method("get_gameObject");
                  if (getGo) {
                    const go = getGo.bind(screen).invoke() as Il2Cpp.Object;
                    if (go && !go.isNull()) {
                      const setActive = go.class.method("SetActive");
                      if (setActive) setActive.bind(go).invoke(false);
                    }
                  }
                } catch (e) {}

                // 5. Reset State to Inactive (2)
                try {
                  const setState = ClassResolver.tryMethod(screen.class, "set_State", 1);
                  if (setState) {
                    setState.bind(screen).invoke(2);
                  } else {
                    const stateField = screen.field("<State>k__BackingField");
                    if (stateField) stateField.value = 2;
                  }
                } catch (e) {
                  try {
                    const stateField = screen.field("<State>k__BackingField");
                    if (stateField) stateField.value = 2;
                  } catch (e2) {}
                }

                Logger.log("[OfflineHarden] SocialScreen safely hidden and synchronized to Inactive state.");
              }

              if (cachedSocialController && !cachedSocialController.isNull()) {
                try {
                  const activeField = cachedSocialController.field("<Active>k__BackingField");
                  if (activeField) activeField.value = false;
                } catch (e) {}
              }
            } catch (err: any) {
              Logger.log(`[OfflineHarden] ensureSocialScreenHidden error: ${err.message}`);
            }
          };

          // Cache EventsScreen instance when loaded / started / transitioned in
          const eventsScreenClass = ClassResolver.findClass("EventsScreen");
          if (eventsScreenClass) {
            const startMethod = ClassResolver.tryMethod(eventsScreenClass, "Start", 0);
            if (startMethod) {
              startMethod.implementation = function (this: Il2Cpp.Object): void {
                cachedEventsScreen = this;
                try {
                  startMethod.bind(this).invoke();
                } catch (e) {}
              };
            }

            const transitionInMethod = ClassResolver.tryMethod(eventsScreenClass, "TransitionIn", 0);
            if (transitionInMethod) {
              transitionInMethod.implementation = function (this: Il2Cpp.Object): any {
                cachedEventsScreen = this;
                try {
                  return transitionInMethod.bind(this).invoke();
                } catch (e) {
                  return null;
                }
              };
            }
          }

          // Cache SocialScreen instance and ensure it stays suppressed and inactive
          const socialScreenClass = ClassResolver.findClass("SocialScreen");
          if (socialScreenClass) {
            const startMethod = ClassResolver.tryMethod(socialScreenClass, "Start", 0);
            if (startMethod) {
              startMethod.implementation = function (this: Il2Cpp.Object): void {
                cachedSocialScreen = this;
                ensureSocialScreenHidden();
              };
            }

            const transitionInMethod = ClassResolver.tryMethod(socialScreenClass, "TransitionIn", 0);
            if (transitionInMethod) {
              transitionInMethod.implementation = function (this: Il2Cpp.Object): any {
                cachedSocialScreen = this;
                ensureSocialScreenHidden();
                try {
                  return transitionInMethod.bind(this).invoke();
                } catch (e) {
                  return null;
                }
              };
            }
          }

          // Disable LiveopsNewsFeedFlowListFiller from refreshing or loading
          const newsFillerClass = ClassResolver.findClass("LiveopsNewsFeedFlowListFiller");
          if (newsFillerClass) {
            const canRefreshMethod = ClassResolver.tryMethod(newsFillerClass, "get_CanRefresh", 0);
            if (canRefreshMethod) {
              canRefreshMethod.implementation = function (): boolean {
                return false;
              };
              Logger.log("[OfflineHarden] LiveopsNewsFeedFlowListFiller.get_CanRefresh hooked (always false).");
            }
          }

          // Suppress notification badges ("roosters") on Shop tab and Hub tab
          const socialRoosterClass = ClassResolver.findClass("SocialNewRequestsRooster");
          if (socialRoosterClass) {
            const getRoosterCountMethod = ClassResolver.tryMethod(socialRoosterClass, "GetRoosterCount", 0);
            if (getRoosterCountMethod) {
              getRoosterCountMethod.implementation = function (): number {
                return 0;
              };
              Logger.log("[OfflineHarden] SocialNewRequestsRooster.GetRoosterCount hooked (always 0).");
            }
          }

          const shopRoostersClass = ClassResolver.findClass("ShopScreenRoosters");
          if (shopRoostersClass) {
            const getShopCountMethod = ClassResolver.tryMethod(shopRoostersClass, "GetShopTabRoosterCounter", 0);
            if (getShopCountMethod) {
              getShopCountMethod.implementation = function (): number {
                return 0;
              };
              Logger.log("[OfflineHarden] ShopScreenRoosters.GetShopTabRoosterCounter hooked (always 0).");
            }

            const getFreeGemsMethod = ClassResolver.tryMethod(shopRoostersClass, "GetShopTabFreeGemsRoosterCount", 0);
            if (getFreeGemsMethod) {
              getFreeGemsMethod.implementation = function (): number {
                return 0;
              };
              Logger.log("[OfflineHarden] ShopScreenRoosters.GetShopTabFreeGemsRoosterCount hooked (always 0).");
            }
          }

          // Cache controller & ensure cleanup on End()
          const eventsCtrlClass = ClassResolver.findClass("EventsScreenController");
          if (eventsCtrlClass) {
            const endMethod = ClassResolver.tryMethod(eventsCtrlClass, "End", 0);
            if (endMethod) {
              endMethod.implementation = function (this: Il2Cpp.Object): void {
                cachedEventsController = this;
                try {
                  endMethod.bind(this).invoke();
                } catch (e: any) {
                  Logger.log(`[OfflineHarden] EventsScreenController.End invoke warning: ${e.message}`);
                }
                ensureEventsScreenHidden();
              };
            }
          }

          const socialCtrlClass = ClassResolver.findClass("SocialScreenController");
          if (socialCtrlClass) {
            const endMethod = ClassResolver.tryMethod(socialCtrlClass, "End", 0);
            if (endMethod) {
              endMethod.implementation = function (this: Il2Cpp.Object): void {
                cachedSocialController = this;
                try {
                  endMethod.bind(this).invoke();
                } catch (e: any) {
                  Logger.log(`[OfflineHarden] SocialScreenController.End invoke warning: ${e.message}`);
                }
                ensureSocialScreenHidden();
              };
            }
          }

          // Hook MainMenuModel.set_ActiveTab to safely switch tabs and keep unused tabs clean
          const mainMenuModelClass = ClassResolver.findClass("MainMenuModel");
          if (mainMenuModelClass) {
            const setActiveTabMethod = ClassResolver.tryMethod(mainMenuModelClass, "set_ActiveTab", 1);
            if (setActiveTabMethod) {
              setActiveTabMethod.implementation = function (this: Il2Cpp.Object, tab: any): void {
                try {
                  setActiveTabMethod.bind(this).invoke(tab);
                } catch (e: any) {
                  Logger.log(`[OfflineHarden] MainMenuModel.set_ActiveTab invoke warning: ${e.message}`);
                }
                let tabVal: number = -1;
                try {
                  if (typeof tab === "number") {
                    tabVal = tab;
                  } else if (tab && typeof tab === "object") {
                    if ("field" in tab && typeof (tab as any).field === "function") {
                      tabVal = Number((tab as any).field("value__").value);
                    } else if ("value" in tab) {
                      tabVal = Number((tab as any).value);
                    }
                  }
                } catch (e) {}

                // Tab 4 is Events (MainMenuModel.Tab.Events = 4).
                if (tabVal !== 4) {
                  ensureEventsScreenHidden();
                }
                // Tab 5 is Social / Hub (MainMenuModel.Tab.Social = 5).
                // Always ensure SocialScreen is hidden and inert (both inside Hub and when on any other tab)
                ensureSocialScreenHidden();
              };
            }
          }
          Logger.log("[OfflineHarden] EventsScreen and SocialScreen lifecycle hooks registered.");
        } catch (e: any) {
          Logger.log(`[OfflineHarden] EventsScreen / SocialScreen hook setup error: ${e.message}`);
        }

        // Suppress Tour Pass point awards, hide homescreen Tour Pass widget, and hide homescreen event banners
        try {
          // 1. Make Season_SeasonCmds.SongEnded a NO-OP so gameplay never awards Tour Points or advances Tour Pass
          const seasonCmdsClass = ClassResolver.findClass("Season_SeasonCmds");
          if (seasonCmdsClass) {
            const songEndedMethod = ClassResolver.tryMethod(seasonCmdsClass, "SongEnded", 2);
            if (songEndedMethod) {
              songEndedMethod.implementation = function (): void {
                // Silenced: do not award Tour Points or advance Tour Pass
              };
              Logger.log("[OfflineHarden] Season_SeasonCmds.SongEnded silenced (no Tour Points awarded).");
            }
          }

          // Helper to deactivate GameObject
          const hideGameObject = (instance: Il2Cpp.Object) => {
            try {
              const getGo = instance.class.method("get_gameObject");
              if (getGo) {
                const go = getGo.bind(instance).invoke() as Il2Cpp.Object;
                if (go && !go.isNull()) {
                  const setActive = go.class.method("SetActive");
                  if (setActive) setActive.bind(go).invoke(false);
                }
              }
            } catch (e) {}
          };

          // 2. Hide the homescreen "TOUR PASS 0 / 5" widget (SeasonHomeScreenElement)
          const seasonHomeClass = ClassResolver.findClass("SeasonHomeScreenElement");
          if (seasonHomeClass) {
            const startMethod = ClassResolver.tryMethod(seasonHomeClass, "Start", 0);
            if (startMethod) {
              startMethod.implementation = function (this: Il2Cpp.Object): void {
                try {
                  startMethod.bind(this).invoke();
                } catch (e) {}
                hideGameObject(this);
              };
            }

            const tryRefresh = ClassResolver.tryMethod(seasonHomeClass, "TryRefresh", 0);
            if (tryRefresh) {
              tryRefresh.implementation = function (this: Il2Cpp.Object): void {
                hideGameObject(this);
              };
            }
            Logger.log("[OfflineHarden] SeasonHomeScreenElement hidden on homescreen.");
          }

          // 3. Hide the homescreen "EVENT STARTED" banner (SongLeaderboardEvent_PlaySongScreenWidget / PlaySongScreenEventsWidgetAddon)
          const eventsWidgetAddonClass = ClassResolver.findClass("PlaySongScreenEventsWidgetAddon");
          if (eventsWidgetAddonClass) {
            const findEventWidgetMethod = ClassResolver.tryMethod(eventsWidgetAddonClass, "FindEventWidget", 0);
            if (findEventWidgetMethod) {
              findEventWidgetMethod.implementation = function (): any {
                return null;
              };
              Logger.log("[OfflineHarden] PlaySongScreenEventsWidgetAddon.FindEventWidget suppressed (returns null).");
            }
          }

          const eventWidgetClass = ClassResolver.findClass("SongLeaderboardEvent_PlaySongScreenWidget");
          if (eventWidgetClass) {
            const transitionInMethod = ClassResolver.tryMethod(eventWidgetClass, "TransitionIn", 0);
            if (transitionInMethod) {
              transitionInMethod.implementation = function (this: Il2Cpp.Object): void {
                hideGameObject(this);
              };
            }
            Logger.log("[OfflineHarden] SongLeaderboardEvent_PlaySongScreenWidget hidden on homescreen.");
          }

          const totaliserWidgetClass = ClassResolver.findClass("TotaliserEvent_PlaySongScreenWidget");
          if (totaliserWidgetClass) {
            const transitionInMethod = ClassResolver.tryMethod(totaliserWidgetClass, "TransitionIn", 0);
            if (transitionInMethod) {
              transitionInMethod.implementation = function (this: Il2Cpp.Object): void {
                hideGameObject(this);
              };
            }
            Logger.log("[OfflineHarden] TotaliserEvent_PlaySongScreenWidget hidden on homescreen.");
          }
        } catch (e: any) {
          Logger.log(`[OfflineHarden] Tour Pass / Event Widget suppression error: ${e.message}`);
        }

        // Guard CustomisationsScreen & ProfileScreenTrackSkinsUI against offline NPE in sorting/populating
        const displayClass26 = ClassResolver.findClass("ProfileScreenTrackSkinsUI/<>c__DisplayClass26_0")
                            || ClassResolver.findClass("ProfileScreenTrackSkinsUI.<>c__DisplayClass26_0");
        if (displayClass26) {
          const sortFunc = ClassResolver.tryMethod(displayClass26, "<AddTrackSkinsAndHeader>b__0", 1);
          if (sortFunc) {
            sortFunc.implementation = function (this: Il2Cpp.Object, a: any): number {
              try {
                if (!a || a.isNull()) return 0;
                const res = sortFunc.bind(this).invoke(a);
                return Number(res || 0);
              } catch (e: any) {
                try {
                  if (a && !a.isNull()) {
                    return Number(a.field("id")?.value || 0);
                  }
                } catch (e2) {}
                return 0;
              }
            };
            Logger.log("[OfflineHarden] ProfileScreenTrackSkinsUI.<AddTrackSkinsAndHeader>b__0 guarded.");
          }
        }

        const trackSkinsUiClass = ClassResolver.findClass("ProfileScreenTrackSkinsUI");
        if (trackSkinsUiClass) {
          const populateMethod = ClassResolver.tryMethod(trackSkinsUiClass, "Populate", 0);
          if (populateMethod) {
            populateMethod.implementation = function (this: Il2Cpp.Object): void {
              try {
                populateMethod.bind(this).invoke();
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely caught ProfileScreenTrackSkinsUI.Populate error: ${e.message}`);
              }
            };
            Logger.log("[OfflineHarden] ProfileScreenTrackSkinsUI.Populate guarded.");
          }
        }

        const customScreenClass = ClassResolver.findClass("CustomisationsScreen");
        if (customScreenClass) {
          const handleTabChange = ClassResolver.tryMethod(customScreenClass, "HandleTabChangeInternal", 1);
          if (handleTabChange) {
            handleTabChange.implementation = function (this: Il2Cpp.Object, doTransitionOut: boolean): void {
              try {
                handleTabChange.bind(this).invoke(doTransitionOut);
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely caught CustomisationsScreen.HandleTabChangeInternal: ${e.message}`);
              }
            };
            Logger.log("[OfflineHarden] CustomisationsScreen.HandleTabChangeInternal guarded.");
          }
          const refreshRoosters = ClassResolver.tryMethod(customScreenClass, "RefreshRoosters", 0);
          if (refreshRoosters) {
            refreshRoosters.implementation = function (this: Il2Cpp.Object): void {
              try {
                refreshRoosters.bind(this).invoke();
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely caught CustomisationsScreen.RefreshRoosters: ${e.message}`);
              }
            };
            Logger.log("[OfflineHarden] CustomisationsScreen.RefreshRoosters guarded.");
          }
        }

        // Guard TrackAccuracyTargetView.SetupSprites to prevent track generation abort
        const accuracyViewClass = ClassResolver.findClass("BeatStar.RhythmGame.Track.TrackAccuracyTargetView", "Assembly-CSharp")
                               || ClassResolver.findClass("TrackAccuracyTargetView");
        if (accuracyViewClass) {
          const setupSprites = ClassResolver.tryMethod(accuracyViewClass, "SetupSprites", 0);
          if (setupSprites) {
            setupSprites.implementation = function (this: Il2Cpp.Object): void {
              try {
                setupSprites.bind(this).invoke();
              } catch (e: any) {
                Logger.log(`[OfflineHarden] Safely caught TrackAccuracyTargetView.SetupSprites error: ${e.message}`);
              }
            };
            Logger.log("[OfflineHarden] TrackAccuracyTargetView.SetupSprites guarded.");
          }
        }

        // Guard InteractionLocker to ensure UI touch input is never permanently blocked
        const lockerClass = ClassResolver.findClass("InteractionLocker");
        if (lockerClass) {
          const getLocked = ClassResolver.tryMethod(lockerClass, "get_Locked", 0);
          if (getLocked) {
            getLocked.implementation = function (this: Il2Cpp.Object): boolean {
              return false;
            };
          }

          // In offline mode, never allow Lock() to disable EventSystem
          const lockMethod = ClassResolver.tryMethod(lockerClass, "Lock", 0);
          if (lockMethod) {
            lockMethod.implementation = function (this: Il2Cpp.Object): void {
              try {
                const counterField = this.field("lockCounter");
                if (counterField) {
                  const cur = (counterField.value as number) || 0;
                  counterField.value = cur + 1;
                }
              } catch (e) {}
            };
          }

          // Safety watchdog on BeginLock: auto-call ForceUnlock if a coroutine hangs
          const beginLockMethod = ClassResolver.tryMethod(lockerClass, "BeginLock", 1);
          if (beginLockMethod) {
            beginLockMethod.implementation = function (this: Il2Cpp.Object, id: any): void {
              try {
                beginLockMethod.bind(this).invoke(id);
              } catch (e) {}
              setTimeout(() => {
                try {
                  const forceUnlock = ClassResolver.tryMethod(lockerClass, "ForceUnlock", 0);
                  if (forceUnlock) forceUnlock.bind(this).invoke();
                } catch (e) {}
              }, 1200);
            };
          }
          Logger.log("[OfflineHarden] InteractionLocker guarded: EventSystem preserved, watchdog active.");
        }

        // Guard LiveOpsEventsFrontEnd against event claim soft-locks
        const liveOpsFEClass = ClassResolver.findClass("LiveOpsEventsFrontEnd");
        if (liveOpsFEClass) {
          const postInject = ClassResolver.tryMethod(liveOpsFEClass, "PostInjectInitialise", 1);
          if (postInject) {
            postInject.implementation = function (this: Il2Cpp.Object, disposer: any): void {
              try {
                postInject.bind(this).invoke(disposer);
              } catch (e) {}
              try {
                const canEndField = this.field("canEndEvents");
                if (canEndField) canEndField.value = false;
              } catch (e) {}
            };
          }

          const showEnded = ClassResolver.tryMethod(liveOpsFEClass, "ShowEventEndedScreenAndClaimRewards", 1);
          if (showEnded) {
            showEnded.implementation = function (this: Il2Cpp.Object, totaliser: any): any {
              Logger.log("[OfflineHarden] Safely bypassed ShowEventEndedScreenAndClaimRewards");
              return null;
            };
          }

          const claimAll = ClassResolver.tryMethod(liveOpsFEClass, "ClaimAllRewardsTask", 1);
          if (claimAll) {
            claimAll.implementation = function (this: Il2Cpp.Object, ev: any): any {
              Logger.log("[OfflineHarden] Safely bypassed ClaimAllRewardsTask");
              return null;
            };
          }

          const claimReward = ClassResolver.tryMethod(liveOpsFEClass, "ClaimRewardAndWait", 2);
          if (claimReward) {
            claimReward.implementation = function (this: Il2Cpp.Object, ev: any, idx: any): any {
              Logger.log("[OfflineHarden] Safely bypassed ClaimRewardAndWait");
              return null;
            };
          }
          Logger.log("[OfflineHarden] LiveOpsEventsFrontEnd guarded against offline claim lockups.");
        }

        // Guard PlaySongScreen against startup popups & season reward modal lock
        const playSongScreenClass = ClassResolver.findClass("PlaySongScreen");
        if (playSongScreenClass) {
          const showSeasonReward = ClassResolver.tryMethod(playSongScreenClass, "ShowSeasonPremiumPassUnlockReward", 0);
          if (showSeasonReward) {
            showSeasonReward.implementation = function (this: Il2Cpp.Object): boolean {
              // Season is already 100% unlocked in offline profile; skip modal hijack
              return false;
            };
          }

          const showNewsFeedStory = ClassResolver.tryMethod(playSongScreenClass, "ShowNewsFeedStoryItem", 1);
          if (showNewsFeedStory) {
            showNewsFeedStory.implementation = function (this: Il2Cpp.Object, storyInfo: any): void {
              try {
                const finishPopups = ClassResolver.tryMethod(playSongScreenClass, "FinishedPostTransitionPopups", 0);
                if (finishPopups) finishPopups.bind(this).invoke();
              } catch (e) {}
            };
          }
          Logger.log("[OfflineHarden] PlaySongScreen guarded: startup modal lockups bypassed.");
        }

        // Filter out spammy Unity debug logs directly at the source
        const debugClass = ClassResolver.findClass("UnityEngine.Debug", "UnityEngine.CoreModule");
        if (debugClass) {
          const logObj = ClassResolver.tryMethod(debugClass, "Log", 1);
          if (logObj) {
            logObj.implementation = function (message: any): void {
              try {
                if (message) {
                  const str = message.toString();
                  if (str.includes("StopCaringAboutUnityAssetDownload") ||
                      str.includes("AppAssetBundleQueue::") ||
                      str.includes("UnityAssetAssetLoader::RequestAssetDownloadUpdates") ||
                      str.includes("RetrieveAudioInfo Complete")) {
                    return; // Silence this specific spam
                  }
                }
              } catch (e) {}
              try {
                logObj.bind(this).invoke(message);
              } catch (e) {}
            };
          }
          Logger.log("[OfflineHarden] UnityEngine.Debug.Log filtered for spam.");
        }

      }
    } catch (e: any) {
      Logger.log(`[OfflineHarden] IL2CPP stub error: ${e.message}`);
    }

    // 3. Silence LogstashSender disk spam (prevents FPS drops during scroll)
    try {
      const logstashAssembly = Il2Cpp.domain.assembly("SpaceApe.Logger.Unity")?.image;
      if (logstashAssembly) {
        const logstashSender = logstashAssembly.class("com.spaceape.logger.logstash.LogstashSender");
        if (logstashSender) {
          const sendMethod = logstashSender.method("Send");
          if (sendMethod) {
            sendMethod.implementation = function (...args: any[]): void {
              // Drop remote logstash queueing in offline mode
            };
            Logger.log("[OfflineHarden] LogstashSender disk spam silenced.");
          }
        }
      }
    } catch (e: any) {
      Logger.log(`[OfflineHarden] Logstash silence skipped: ${e.message}`);
    }

    
    // AIRGAP 1: Analytics & Firebase Suppression (Zero Outbound Bytes)
    try {
      const hooks = [
        { cls: "FirebaseAnalyticsController", asm: "Assembly-CSharp", m: "get_ShouldSendAnalytics", p: 0, r: false },
        { cls: "FirebaseController", asm: "Assembly-CSharp", m: "get_AnalyticsFeatureEnabled", p: 0, r: false },
        { cls: "FlamingoAppAnalytics", asm: "Assembly-CSharp", m: "get_Enabled", p: 0, r: false },
        { cls: "FirebaseAnalytics", asm: "Firebase.Analytics", m: "LogEvent", p: 1, r: null },
        { cls: "FirebaseAnalytics", asm: "Firebase.Analytics", m: "LogEvent", p: 3, r: null },
        { cls: "ExternalAppEventDispatcher", asm: "Assembly-CSharp", m: "SendEvent", p: 4, r: null },
        { cls: "LogstashSender", asm: "SpaceApe.Logger", m: "Startup", p: 0, r: null },
        { cls: "AppsFlyer", asm: "AppsFlyer", m: "startSDK", p: 0, r: null },
        { cls: "SharplaAnalyticsAsEvents", asm: "SharplaClient", m: "get_Enabled", p: 0, r: false }
      ];

      for (const h of hooks) {
        const klass = ClassResolver.findClass(h.cls, h.asm);
        if (klass) {
          const method = ClassResolver.tryMethod(klass, h.m, h.p);
          if (method) {
            method.implementation = function (): any {
              return h.r === null ? undefined : h.r;
            };
          }
        }
      }
      Logger.log("[OfflineHarden] Analytics airgap active: Firebase/SpaceApe telemetry blocked.");
    } catch (e: any) {
      Logger.log(`[OfflineHarden] Analytics hook error: ${e.message}`);
    }

    // AIRGAP 2: Payment System (Google Play Billing) Suppression
    try {
      const flamingoPayments = ClassResolver.findClass("FlamingoPaymentsLifecycle", "Assembly-CSharp");
      if (flamingoPayments) {
        const initPayments = ClassResolver.tryMethod(flamingoPayments, "InitializePayments", 0);
        if (initPayments) {
          initPayments.implementation = function (): any {
            return null; // Return null IEnumerator to abort the coroutine safely
          };
        }
        const handleError = ClassResolver.tryMethod(flamingoPayments, "HandleError", 1);
        if (handleError) {
          handleError.implementation = function (error: any): void {
            Logger.log("[OfflineHarden] Suppressed Payment error 20005 popup.");
          };
        }
      }
      Logger.log("[OfflineHarden] Payments airgap active: Google Play Billing blocked.");
    } catch (e: any) {
      Logger.log(`[OfflineHarden] Payments hook error: ${e.message}`);
    }

    
    // Prevent InteractionLocker freezes caused by ClaimRewardsDialog NPE
    try {
      const claimDialog = ClassResolver.findClass("SongLeaderboardEvent_ClaimRewardsDialog");
      if (claimDialog) {
        const setupMethod = ClassResolver.tryMethod(claimDialog, "Setup", 3);
        if (setupMethod) {
          const originalSetup = setupMethod.implementation;
          setupMethod.implementation = function (leaderboardEvent: any, forceClaimAll: boolean, onClosed: any): void {
            try {
              if (leaderboardEvent == null || leaderboardEvent.isNull()) {
                Logger.log("[OfflineHarden] Aborted ClaimRewardsDialog.Setup due to null event! Preventing freeze.");
                if (onClosed != null && !onClosed.isNull()) {
                  onClosed.invoke(); // Close dialog immediately
                }
                return;
              }
              originalSetup.bind(this)(leaderboardEvent, forceClaimAll, onClosed);
            } catch (e: any) {
              Logger.log(`[OfflineHarden] Trapped ClaimRewardsDialog NPE: ${e.message}`);
              if (onClosed != null && !onClosed.isNull()) {
                onClosed.invoke();
              }
            }
          };
          Logger.log("[OfflineHarden] ClaimRewardsDialog.Setup guarded against InteractionLocker freeze.");
        }
      }
    } catch (e: any) {
      Logger.log(`[OfflineHarden] ClaimRewards hook error: ${e.message}`);
    }

    Logger.log("[OfflineHarden] Offline hardening active: external network blocked, safe offline UI enabled.");
  } catch (e: any) {
    Logger.log(`[OfflineHarden] Error: ${e.message}`);
  }
};

