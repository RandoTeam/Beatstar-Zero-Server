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

