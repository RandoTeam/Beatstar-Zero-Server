import Logger from "../lib/Logger.js";

export const hookSupportButton = async () => {
  const assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;

  assembly
    .class("OptionsDialog")
    .method("SupportButtonPressed").implementation = async function () {
    Logger.log("[hookSupportButton] Support button pressed (no-op in offline mode)");
  };
};
