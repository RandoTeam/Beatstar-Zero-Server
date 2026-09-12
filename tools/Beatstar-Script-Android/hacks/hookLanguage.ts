import ClassResolver from "../lib/ClassResolver.js";
import Logger from "../lib/Logger.js";
import Device from "../lib/Device.js";

/**
 * Language Guard Hook:
 * 1. PlayerPrefs sanitization (forces 'en' if 'ru' is saved to avoid loading screen hang).
 * 2. Removes Russian option from LanguageSelectDialog & MarketingLanguageSelectDialog.
 * 3. Blocks runtime language switch to 'ru' in LocalisationSystem.SetNewLanguage with a toast.
 * 4. Clears font asset requirements in LocalisedFonts.GetFontAssetsRequiredForLanguage for 'ru'
 *    to prevent the loadingCount > 0 coroutine deadlock if 'ru' is ever requested.
 */
export function hookLanguage(): void {
  try {
    Logger.log("[hookLanguage] Initializing language guards...");

    // 1. Hook PlayerPrefs to prevent 'ru' from being returned or persisted
    const PlayerPrefs =
      ClassResolver.findClass("UnityEngine.PlayerPrefs", "UnityEngine.CoreModule") ||
      ClassResolver.findClass("UnityEngine.PlayerPrefs") ||
      ClassResolver.findClass("PlayerPrefs");

    if (PlayerPrefs) {
      const getString2 = ClassResolver.tryMethod(PlayerPrefs, "GetString", 2);
      if (getString2) {
        getString2.implementation = function (key: any, defaultVal: any) {
          const res = getString2.invoke(key, defaultVal);
          try {
            const k = key ? key.toString() : "";
            if (k === "NextLanguageAfterRestart" || k.indexOf("Language") !== -1) {
              const v = res ? res.toString() : "";
              if (v === "ru" || v.toLowerCase().indexOf("ru") !== -1) {
                Logger.log(`[hookLanguage] PlayerPrefs.GetString('${k}') was '${v}' -> forcing 'en'`);
                return Il2Cpp.string("en");
              }
            }
          } catch (e: any) {}
          return res;
        };
      }

      const getString1 = ClassResolver.tryMethod(PlayerPrefs, "GetString", 1);
      if (getString1) {
        getString1.implementation = function (key: any) {
          const res = getString1.invoke(key);
          try {
            const k = key ? key.toString() : "";
            if (k === "NextLanguageAfterRestart" || k.indexOf("Language") !== -1) {
              const v = res ? res.toString() : "";
              if (v === "ru" || v.toLowerCase().indexOf("ru") !== -1) {
                Logger.log(`[hookLanguage] PlayerPrefs.GetString('${k}') was '${v}' -> forcing 'en'`);
                return Il2Cpp.string("en");
              }
            }
          } catch (e: any) {}
          return res;
        };
      }

      const setString = ClassResolver.tryMethod(PlayerPrefs, "SetString", 2);
      if (setString) {
        setString.implementation = function (key: any, val: any) {
          try {
            const k = key ? key.toString() : "";
            const v = val ? val.toString() : "";
            if (
              (k === "NextLanguageAfterRestart" || k.indexOf("Language") !== -1) &&
              (v === "ru" || v.toLowerCase().indexOf("ru") !== -1)
            ) {
              Logger.log(
                `[hookLanguage] PlayerPrefs.SetString('${k}', '${v}') blocked -> saving 'en'`
              );
              return setString.invoke(key, Il2Cpp.string("en"));
            }
          } catch (e: any) {}
          return setString.invoke(key, val);
        };
      }
      Logger.log("[hookLanguage] PlayerPrefs language sanitization installed");
    }

    // 2. Hide Russian from in-game LanguageSelectDialog
    const LanguageSelectDialog =
      ClassResolver.findClass("LanguageSelectDialog", "Assembly-CSharp") ||
      ClassResolver.findClass("LanguageSelectDialog");

    if (LanguageSelectDialog) {
      const addSetting = ClassResolver.tryMethod(LanguageSelectDialog, "AddSetting", 1);
      if (addSetting) {
        addSetting.implementation = function (langConfig: any) {
          if (langConfig && !langConfig.isNull()) {
            try {
              const idField = langConfig.field("id")?.value;
              const id = idField ? idField.toString() : "";
              if (id === "ru" || id.toLowerCase().indexOf("ru") !== -1) {
                Logger.log(
                  `[hookLanguage] LanguageSelectDialog: Hiding unsupported language '${id}'`
                );
                return;
              }
            } catch (e: any) {}
          }
          return addSetting.bind(this).invoke(langConfig);
        };
        Logger.log("[hookLanguage] LanguageSelectDialog filter installed");
      }
    }

    // 3. Hide Russian from MarketingLanguageSelectDialog
    const MarketingLanguageSelectDialog =
      ClassResolver.findClass("MarketingLanguageSelectDialog", "Assembly-CSharp") ||
      ClassResolver.findClass("MarketingLanguageSelectDialog");

    if (MarketingLanguageSelectDialog) {
      const addSettingMkt = ClassResolver.tryMethod(
        MarketingLanguageSelectDialog,
        "AddSetting",
        1
      );
      if (addSettingMkt) {
        addSettingMkt.implementation = function (langConfig: any) {
          if (langConfig && !langConfig.isNull()) {
            try {
              const idField = langConfig.field("id")?.value;
              const id = idField ? idField.toString() : "";
              if (id === "ru" || id.toLowerCase().indexOf("ru") !== -1) {
                Logger.log(
                  `[hookLanguage] MarketingLanguageSelectDialog: Hiding unsupported language '${id}'`
                );
                return;
              }
            } catch (e: any) {}
          }
          return addSettingMkt.bind(this).invoke(langConfig);
        };
        Logger.log("[hookLanguage] MarketingLanguageSelectDialog filter installed");
      }
    }

    // 4. Guard LocalisationSystem.SetNewLanguage
    const LocalisationSystem =
      ClassResolver.findClass("LocalisationSystem", "Assembly-CSharp") ||
      ClassResolver.findClass("LocalisationSystem");

    if (LocalisationSystem) {
      const setNewLang = ClassResolver.tryMethod(LocalisationSystem, "SetNewLanguage", 2);
      if (setNewLang) {
        setNewLang.implementation = function (langIdStr: any, showLoading: any) {
          try {
            const lang = langIdStr ? langIdStr.toString() : "";
            if (lang === "ru" || lang.toLowerCase().indexOf("ru") !== -1) {
              Logger.log(
                `[hookLanguage] Blocked SetNewLanguage('${lang}') to prevent font deadlock`
              );
              Device.toast("Русский язык временно недоступен в офлайн-версии");
              return;
            }
          } catch (e: any) {}
          return setNewLang.bind(this).invoke(langIdStr, showLoading);
        };
        Logger.log("[hookLanguage] LocalisationSystem.SetNewLanguage guard installed");
      }
    }

    // 5. Guard LocalisedFonts.GetFontAssetsRequiredForLanguage
    const LocalisedFonts =
      ClassResolver.findClass("LocalisedFonts", "Assembly-CSharp") ||
      ClassResolver.findClass("LocalisedFonts");

    if (LocalisedFonts) {
      const getFontAssets = ClassResolver.tryMethod(
        LocalisedFonts,
        "GetFontAssetsRequiredForLanguage",
        1
      );
      if (getFontAssets) {
        getFontAssets.implementation = function (langStr: any) {
          try {
            const lang = langStr ? langStr.toString() : "";
            if (lang === "ru" || lang.toLowerCase().indexOf("ru") !== -1) {
              Logger.log(
                `[hookLanguage] LocalisedFonts.GetFontAssetsRequiredForLanguage('${lang}') intercepted -> clearing assets`
              );
              const list = getFontAssets.bind(this).invoke(langStr) as Il2Cpp.Object;
              if (list && !list.isNull()) {
                const clearMethod = list.class.method("Clear");
                if (clearMethod) {
                  clearMethod.bind(list).invoke();
                }
              }
              return list;
            }
          } catch (e: any) {
            Logger.log(`[hookLanguage] GetFontAssetsRequiredForLanguage error: ${e.message}`);
          }
          return getFontAssets.bind(this).invoke(langStr);
        };
        Logger.log("[hookLanguage] LocalisedFonts deadlock prevention installed");
      }
    }
  } catch (e: any) {
    Logger.log(`[hookLanguage] Fatal error initializing hook: ${e.message}`);
  }
}
