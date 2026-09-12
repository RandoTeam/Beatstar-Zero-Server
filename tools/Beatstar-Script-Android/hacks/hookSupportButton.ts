import Logger from "../lib/Logger.js";
import Device from "../lib/Device.js";
import SettingsReader from "../lib/SettingsReader.js";
import { applyTargetFps } from "./graphics.js";
import Java from "frida-java-bridge";

let ListenerClass: any = null;
let callbackHandler: ((which: number, dialog: any) => void) | null = null;
let AboutListenerClass: any = null;

function ensureJavaClasses() {
  if (!ListenerClass) {
    ListenerClass = Java.registerClass({
      name: "com.beatstar.offline.FpsSelectionListener",
      implements: [Java.use("android.content.DialogInterface$OnClickListener")],
      methods: {
        onClick(dialog: any, which: number) {
          if (callbackHandler) {
            callbackHandler(which, dialog);
          }
        }
      }
    });
  }
  if (!AboutListenerClass) {
    AboutListenerClass = Java.registerClass({
      name: "com.beatstar.offline.AboutDialogListener",
      implements: [Java.use("android.content.DialogInterface$OnClickListener")],
      methods: {
        onClick(dialog: any, which: number) {
          try {
            const UnityPlayer = Java.use("com.unity3d.player.UnityPlayer");
            const activity = UnityPlayer.currentActivity.value;
            const AlertDialogBuilder = Java.use("android.app.AlertDialog$Builder");
            const StringClass = Java.use("java.lang.String");
            const aboutDialog = AlertDialogBuilder.$new(activity);
            aboutDialog.setTitle(StringClass.$new("О проекте Beatstar-Zero-Server"));
            aboutDialog.setMessage(
              StringClass.$new(
                "Beatstar-Zero-Server v1.0.60\n\n" +
                "• Полностью автономный in-process оффлайн-движок\n" +
                "• Поддержка экранов 30 / 60 / 90 / 120 / 144 / 165 Hz\n" +
                "• Автор: RandoTeam (Solo Developer)\n" +
                "• Исходный код: github.com/RandoTeam/Beatstar-Zero-Server\n\n" +
                "Приятной игры!"
              )
            );
            aboutDialog.setPositiveButton(StringClass.$new("OK"), null);
            aboutDialog.create().show();
          } catch (e: any) {
            Logger.log(`[AboutDialog] Error: ${e.message}`);
          }
        }
      }
    });
  }
}

export function showDeviceSettingsDialog() {
  if (!Java.available) {
    Logger.log("[SettingsDialog] Java bridge not available");
    return;
  }

  Java.perform(() => {
    try {
      const UnityPlayer = Java.use("com.unity3d.player.UnityPlayer");
      const activity = UnityPlayer.currentActivity.value;
      if (!activity) {
        Logger.log("[SettingsDialog] UnityPlayer.currentActivity is null");
        return;
      }

      ensureJavaClasses();

      const detectedHz = Device.getDisplayRefreshRate();
      const currentSetting = SettingsReader.getSetting("fps") || "auto";

      Java.scheduleOnMainThread(() => {
        try {
          const AlertDialogBuilder = Java.use("android.app.AlertDialog$Builder");
          const StringClass = Java.use("java.lang.String");
          const builder = AlertDialogBuilder.$new(activity);

          builder.setTitle(StringClass.$new("Настройки устройства и FPS"));

          const labels = [
            `Авто (Герцовка экрана: ${detectedHz} Hz)`,
            "30 FPS (Максимальная экономия)",
            "60 FPS (Стандарт)",
            "90 FPS",
            "120 FPS",
            "144 FPS",
            "165 FPS",
            "Без ограничений (Uncapped)"
          ];

          const values: Array<number | "auto"> = ["auto", 30, 60, 90, 120, 144, 165, -1];

          let checkedIndex = 0;
          for (let i = 0; i < values.length; i++) {
            if (String(values[i]) === String(currentSetting)) {
              checkedIndex = i;
              break;
            }
          }

          const jLabels = labels.map((l) => StringClass.$new(l));
          let CharSequenceArray: any;
          try {
            CharSequenceArray = Java.array("java.lang.CharSequence", jLabels);
          } catch (arrErr: any) {
            Logger.log(`[SettingsDialog] Java.array fallback: ${arrErr.message}`);
            const CharSequenceClass = Java.use("java.lang.CharSequence").class;
            CharSequenceArray = Java.use("java.lang.reflect.Array").newInstance(CharSequenceClass, labels.length);
            for (let i = 0; i < labels.length; i++) {
              Java.use("java.lang.reflect.Array").set(CharSequenceArray, i, jLabels[i]);
            }
          }

          callbackHandler = (which: number, dialog: any) => {
            try {
              const selectedValue = values[which];
              const selectedLabel = labels[which];
              SettingsReader.setSetting("fps", selectedValue as any);
              const appliedFps = applyTargetFps(selectedValue);
              Device.toast(`Частота кадров: ${appliedFps > 0 ? appliedFps + " FPS" : "Uncapped"}`);
              Logger.log(`[SettingsDialog] Selected FPS preset: ${selectedValue} (${appliedFps} FPS applied)`);
              dialog.dismiss();
            } catch (err: any) {
              Logger.log(`[SettingsDialog] Selection error: ${err.message}`);
            }
          };

          const clickListener = ListenerClass.$new();
          builder.setSingleChoiceItems(CharSequenceArray, checkedIndex, clickListener);
          builder.setNegativeButton(StringClass.$new("Закрыть"), null);

          if (AboutListenerClass) {
            builder.setNeutralButton(StringClass.$new("О проекте"), AboutListenerClass.$new());
          }

          const dialog = builder.create();
          dialog.show();
        } catch (uiErr: any) {
          Logger.log(`[SettingsDialog] UI thread error: ${uiErr.message}`);
        }
      });
    } catch (e: any) {
      Logger.log(`[showDeviceSettingsDialog] Error: ${e.message}`);
    }
  });
}

export const hookSupportButton = async () => {
  const assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;

  try {
    assembly
      .class("OptionsDialog")
      .method("SupportButtonPressed").implementation = function () {
        Logger.log("[hookSupportButton] Device Settings button pressed -> opening dialog");
        showDeviceSettingsDialog();
      };
    Logger.log("[hookSupportButton] Successfully hooked OptionsDialog.SupportButtonPressed");
  } catch (e: any) {
    Logger.log(`[hookSupportButton] Failed to hook OptionsDialog: ${e.message}`);
  }
};
