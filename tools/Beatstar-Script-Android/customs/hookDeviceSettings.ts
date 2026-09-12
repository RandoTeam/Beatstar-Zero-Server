import ClassResolver from "../lib/ClassResolver.js";
import Logger from "../lib/Logger.js";

export function hookDeviceSettings(): void {
  try {
    // 1. Force EnvironmentPrefs to production
    const EnvironmentPrefs = ClassResolver.findClass("EnvironmentPrefs", "Assembly-CSharp")
      || ClassResolver.findClass("EnvironmentPrefs");
    if (EnvironmentPrefs) {
      const getEnv = ClassResolver.tryMethod(EnvironmentPrefs, "get_environment", 0);
      if (getEnv) {
        getEnv.implementation = function () {
          return Il2Cpp.string("prod");
        };
      }
      Logger.log("[hookDeviceSettings] EnvironmentPrefs forced to 'prod'");
    }

    // 2. Disable DanceText localization debug overrides (stops "Really long song name..." replacement)
    const DanceText = ClassResolver.findClass("DanceText", "Assembly-CSharp")
      || ClassResolver.findClass("DanceText");
    if (DanceText) {
      const getLocDebug = ClassResolver.tryMethod(DanceText, "get_LocalisationDebugEnabled", 0);
      if (getLocDebug) {
        getLocDebug.implementation = function () {
          return false;
        };
      }

      const getDebugManip = ClassResolver.tryMethod(DanceText, "get_DebugTextManipulationEnabled", 0);
      if (getDebugManip) {
        getDebugManip.implementation = function () {
          return false;
        };
      }

      const getDebugOverrideText = ClassResolver.tryMethod(DanceText, "GetDebugOverriddenText", 1);
      if (getDebugOverrideText) {
        getDebugOverrideText.implementation = function (str: any) {
          return str;
        };
      }
      Logger.log("[hookDeviceSettings] DanceText debug overrides disabled");
    }

    // 3. Disable DanceText3D debug overrides
    const DanceText3D = ClassResolver.findClass("DanceText3D", "Assembly-CSharp")
      || ClassResolver.findClass("DanceText3D");
    if (DanceText3D) {
      const getLocDebug3D = ClassResolver.tryMethod(DanceText3D, "get_LocalisationDebugEnabled", 0);
      if (getLocDebug3D) {
        getLocDebug3D.implementation = function () {
          return false;
        };
      }

      const getDebugManip3D = ClassResolver.tryMethod(DanceText3D, "get_DebugTextManipulationEnabled", 0);
      if (getDebugManip3D) {
        getDebugManip3D.implementation = function () {
          return false;
        };
      }
    }

    // 4. Disable DanceTextInputField debug overrides
    const DanceTextInputField = ClassResolver.findClass("DanceTextInputField", "Assembly-CSharp")
      || ClassResolver.findClass("DanceTextInputField");
    if (DanceTextInputField) {
      const getLocDebugInput = ClassResolver.tryMethod(DanceTextInputField, "get_LocalisationDebugEnabled", 0);
      if (getLocDebugInput) {
        getLocDebugInput.implementation = function () {
          return false;
        };
      }

      const getDebugManipInput = ClassResolver.tryMethod(DanceTextInputField, "get_DebugTextManipulationEnabled", 0);
      if (getDebugManipInput) {
        getDebugManipInput.implementation = function () {
          return false;
        };
      }
    }

    // 5. Disable FieldLabelDebugHandler (stops colored background boxes and text outlines)
    const FieldLabelDebugHandler = ClassResolver.findClass("FieldLabelDebugHandler", "Assembly-CSharp")
      || ClassResolver.findClass("FieldLabelDebugHandler");
    if (FieldLabelDebugHandler) {
      const getLocDebugHandler = ClassResolver.tryMethod(FieldLabelDebugHandler, "get_LocalisationDebugEnabled", 0);
      if (getLocDebugHandler) {
        getLocDebugHandler.implementation = function () {
          return false;
        };
      }

      const getDebugManipHandler = ClassResolver.tryMethod(FieldLabelDebugHandler, "get_DebugTextManipulationEnabled", 0);
      if (getDebugManipHandler) {
        getDebugManipHandler.implementation = function () {
          return false;
        };
      }

      const getOverrideType = ClassResolver.tryMethod(FieldLabelDebugHandler, "get_OverrideType", 0);
      if (getOverrideType) {
        getOverrideType.implementation = function () {
          return 0; // TextOverrideType.None
        };
      }

      const getColourUnloc = ClassResolver.tryMethod(FieldLabelDebugHandler, "get_ColourUnlocalisedFields", 0);
      if (getColourUnloc) {
        getColourUnloc.implementation = function () {
          return false;
        };
      }

      const getColourLoc = ClassResolver.tryMethod(FieldLabelDebugHandler, "get_ColourLocalisedFields", 0);
      if (getColourLoc) {
        getColourLoc.implementation = function () {
          return false;
        };
      }
      Logger.log("[hookDeviceSettings] FieldLabelDebugHandler overrides disabled");
    }

    // 6. Disable DanceTextDebugOutlineComponent
    const DanceTextDebugOutlineComponent = ClassResolver.findClass("DanceTextDebugOutlineComponent", "Assembly-CSharp")
      || ClassResolver.findClass("DanceTextDebugOutlineComponent");
    if (DanceTextDebugOutlineComponent) {
      const showMethod = ClassResolver.tryMethod(DanceTextDebugOutlineComponent, "Show", 1);
      if (showMethod) {
        showMethod.implementation = function (show: boolean) {
          // Suppress outline boxes
          return;
        };
      }
    }

    // 7. Reset DeviceSettings PlayerPrefKeyItem values on RefreshCaches
    const DeviceSettingsClass = ClassResolver.findClass("DeviceSettings", "Assembly-CSharp")
      || ClassResolver.findClass("DeviceSettings");
    if (DeviceSettingsClass) {
      const refreshCaches = ClassResolver.tryMethod(DeviceSettingsClass, "RefreshCaches", 0);
      if (refreshCaches) {
        refreshCaches.implementation = function () {
          try {
            refreshCaches.invoke(this);

            const locOverride = this.field("DebugSettings_LocOverride")?.value;
            if (locOverride && !locOverride.isNull()) {
              try { locOverride.field("cachedValue").value = 0; } catch (e) {}
            }

            const highlightUnloc = this.field("DebugSettings_HighlightUnlocalisedText")?.value;
            if (highlightUnloc && !highlightUnloc.isNull()) {
              try { highlightUnloc.field("cachedValue").value = false; } catch (e) {}
            }

            const locBoxes = this.field("DebugSettings_LocShowTextBoxes")?.value;
            if (locBoxes && !locBoxes.isNull()) {
              try { locBoxes.field("cachedValue").value = 0; } catch (e) {}
            }

            const rawScores = this.field("DebugSettings_ShowRawScoreValues")?.value;
            if (rawScores && !rawScores.isNull()) {
              try { rawScores.field("cachedValue").value = false; } catch (e) {}
            }

            const nextLang = this.field("NextLanguageAfterRestart")?.value;
            if (nextLang && !nextLang.isNull()) {
              try {
                const cachedVal = nextLang.field("cachedValue")?.value;
                const str = cachedVal ? cachedVal.toString() : "";
                if (str === "ru" || str.toLowerCase().indexOf("ru") !== -1) {
                  Logger.log(`[hookDeviceSettings] Resetting NextLanguageAfterRestart from '${str}' to 'en'`);
                  nextLang.field("cachedValue").value = Il2Cpp.string("en");
                }
              } catch (e) {}
            }
          } catch (e: any) {
            Logger.log(`[hookDeviceSettings] RefreshCaches cleanup error: ${e.message}`);
          }
        };
      }
      Logger.log("[hookDeviceSettings] DeviceSettings reset hook installed");
    }
  } catch (e: any) {
    Logger.log(`[hookDeviceSettings] Fatal hook error: ${e.message}`);
  }
}
