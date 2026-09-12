import Logger from "../lib/Logger.js";
import SettingsReader from "../lib/SettingsReader.js";
import Device from "../lib/Device.js";

let activeTargetFps: number = 60;
let userFpsSetting: number | "auto" = "auto";

export function getActiveFps(): number {
  return activeTargetFps;
}

export function getUserFpsSetting(): number | "auto" {
  return userFpsSetting;
}

export function applyTargetFps(setting?: number | "auto"): number {
  if (setting === undefined || setting === null) {
    setting = SettingsReader.getSetting("fps") || "auto";
  }
  userFpsSetting = setting;

  if (setting === "auto") {
    activeTargetFps = Device.getDisplayRefreshRate();
    Logger.log(`[Graphics] Auto-detected display refresh rate: ${activeTargetFps} Hz`);
  } else {
    activeTargetFps = Number(setting);
  }

  // 1. Set Unity Application.targetFrameRate
  try {
    const coreModule = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image;
    const appClass = coreModule.class("UnityEngine.Application");
    appClass.method("set_targetFrameRate").invoke(activeTargetFps);
    Logger.log(`[Graphics] Applied Application.set_targetFrameRate(${activeTargetFps})`);
  } catch (e: any) {
    Logger.log(`[Graphics] Failed to set Application.targetFrameRate: ${e.message}`);
  }

  // 2. Update SpaceApe FlamingoScalingModuleTemplate instances
  try {
    const rakshaModel = Il2Cpp.domain.assembly("RakshaModel").image;
    const fpsVal = activeTargetFps > 0 ? activeTargetFps : 120;
    Il2Cpp.gc
      .choose(rakshaModel.class("com.spaceape.config.FlamingoScalingModuleTemplate"))
      .forEach((instance: Il2Cpp.Object) => {
        instance.field("Fps").value = fpsVal;
        instance.field("MenuFps").value = fpsVal;
      });
    Logger.log(`[Graphics] Updated FlamingoScalingModuleTemplate Fps/MenuFps to ${fpsVal}`);
  } catch (e: any) {
    Logger.log(`[Graphics] Failed to update FlamingoScalingModuleTemplate: ${e.message}`);
  }

  return activeTargetFps;
}

export function hookGraphics() {
  const assembly = Il2Cpp.domain.assembly("SpaceApe.Scaling.Runtime").image;
  const setting = SettingsReader.getSetting("graphics");
  const fpsSetting = SettingsReader.getSetting("fps") || "auto";

  if (setting) {
    Logger.log("[Graphics] Setting graphics profile to android_" + setting);
    assembly
      .class("com.spaceape.scaling.ScalingConfig")
      .method("GetLevelById").implementation = function () {
      return this.method("GetLevelById").invoke(
        Il2Cpp.string("android_" + setting)
      );
    };
  }

  // Intercept any internal calls to Application.set_targetFrameRate to prevent Unity from capping FPS to 30/60
  try {
    const coreModule = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image;
    const appClass = coreModule.class("UnityEngine.Application");
    const origSetTarget = appClass.method("set_targetFrameRate");
    origSetTarget.implementation = function (val: number) {
      this.method("set_targetFrameRate").invoke(activeTargetFps);
    };
    Logger.log("[Graphics] Intercepted Application.set_targetFrameRate");
  } catch (e: any) {
    Logger.log(`[Graphics] Failed to intercept set_targetFrameRate: ${e.message}`);
  }

  // Apply initially configured FPS
  applyTargetFps(fpsSetting);
}
