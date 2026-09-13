import ClassResolver from "../lib/ClassResolver.js";
import Logger from "../lib/Logger.js";
import { ProfileStore } from "../server/models/ProfileStore.js";

export function hookNameChange() {
  Logger.log("[hookNameChange] Registering hooks for Name Change bypass...");

  // 1. Force PlayerNameChangeSystem to report available currency and no cooldown
  const systemClass = ClassResolver.findClass("PlayerNameChangeSystem");
  if (systemClass) {
    const hasCurrency = ClassResolver.tryMethod(systemClass, "HasNameChangeCurrency", 0);
    if (hasCurrency) hasCurrency.implementation = function () { return true; };

    const canChange = ClassResolver.tryMethod(systemClass, "CanChangeName", 0);
    if (canChange) canChange.implementation = function () { return true; };

    const inCooldown = ClassResolver.tryMethod(systemClass, "IsPlayerNameChangeInCooldown", 0);
    if (inCooldown) inCooldown.implementation = function () { return false; };
  }

  // 2. Hook ShopItemElement_PlayerNameChange.OnBuyButtonClicked to open PlayerNameChangeScreen via ScreenManager
  const shopItemClass = ClassResolver.findClass("ShopItemElement_PlayerNameChange");
  if (shopItemClass) {
    const onBuyButtonClicked = ClassResolver.tryMethod(shopItemClass, "OnBuyButtonClicked", 0);
    if (onBuyButtonClicked) {
      onBuyButtonClicked.implementation = function (this: Il2Cpp.Object) {
        Logger.log("[hookNameChange] Intercepted OnBuyButtonClicked! Opening Name Change dialog.");

        try {
          try {
            const resetButton = this.method("ResetButtonState", 0);
            if (resetButton) resetButton.invoke();
          } catch (_) {}

          let controller: Il2Cpp.Object | null = null;
          try {
            controller = this.field("playerNameChangeScreenController").value as Il2Cpp.Object;
          } catch (_) {
            const ptrVal = this.handle.add(0x178).readPointer();
            if (!ptrVal.isNull()) controller = new Il2Cpp.Object(ptrVal);
          }

          let screenManager: Il2Cpp.Object | null = null;
          if (controller && !controller.isNull()) {
            try {
              screenManager = controller.field("screenManager").value as Il2Cpp.Object;
            } catch (_) {
              const smPtr = controller.handle.add(0x18).readPointer();
              if (!smPtr.isNull()) screenManager = new Il2Cpp.Object(smPtr);
            }
          }

          const screenClass = ClassResolver.findClass("PlayerNameChangeScreen");
          if (screenManager && !screenManager.isNull() && screenClass) {
            Logger.log("[hookNameChange] Invoking ScreenManager.RequestDialog<PlayerNameChangeScreen>()...");
            const requestDialog = screenManager.class.method("RequestDialog", 0).inflate(screenClass);
            requestDialog.bind(screenManager).invoke();
            Logger.log("[hookNameChange] RequestDialog<PlayerNameChangeScreen>() invoked successfully!");
          }
        } catch (fatal: any) {
          Logger.log(`[hookNameChange] FATAL ERROR in OnBuyButtonClicked hook: ${fatal.message}`);
        }
      };
    }
  }

  // 3. Hook PlayerNameChangeScreen Continue button to directly save name and show success screen
  const screenClass = ClassResolver.findClass("PlayerNameChangeScreen");
  if (screenClass) {
    function handleScreenSubmit(screenInstance: Il2Cpp.Object) {
      Logger.log("[hookNameChange] Executing direct Name Change submission...");
      let newName = "";

      // Extract text from inputField
      try {
        const inputField = screenInstance.field("inputField").value as Il2Cpp.Object;
        if (inputField && !inputField.isNull()) {
          const textGetter = inputField.class.method("get_text", 0);
          if (textGetter) {
            const typedText = textGetter.bind(inputField).invoke() as Il2Cpp.String;
            if (typedText && typedText.content) {
              newName = typedText.content.trim();
            }
          }
        }
      } catch (eInput: any) {
        Logger.log(`[hookNameChange] Error extracting inputField: ${eInput.message}`);
      }

      if (!newName) {
        try {
          const uStr = screenInstance.field("username").value as Il2Cpp.String;
          if (uStr && uStr.content) newName = uStr.content.trim();
        } catch (_) {}
      }

      if (!newName) {
        newName = "Player";
      }

      Logger.log(`[hookNameChange] Confirmed new username: '${newName}'`);

      // 1. Direct persistence in ProfileStore and write to profile.json
      try {
        ProfileStore.load();
        ProfileStore.setUsername(newName);
        const currentDiamonds = ProfileStore.getProfile().diamonds ?? 999;
        ProfileStore.setDiamonds(Math.max(0, currentDiamonds - 1));
        ProfileStore.save();
        Logger.log(`[hookNameChange] ProfileStore updated and saved to profile.json!`);
      } catch (psErr: any) {
        Logger.log(`[hookNameChange] ProfileStore error: ${psErr.message}`);
      }

      // 2. Direct memory update of MyProfileTO
      try {
        const profileTO = screenInstance.field("profileTO").value as Il2Cpp.Object;
        if (profileTO && !profileTO.isNull()) {
          profileTO.field("name").value = new Il2Cpp.String(newName);
          Logger.log(`[hookNameChange] Live profileTO.name updated in memory to: '${newName}'`);
        }
      } catch (toErr: any) {
        Logger.log(`[hookNameChange] profileTO update error: ${toErr.message}`);
      }

      // 3. Show Success Screen or close dialog cleanly
      let successShown = false;
      try {
        const showSuccess = screenInstance.method("ShowNameChangeSuccessScreen", 1);
        if (showSuccess) {
          showSuccess.invoke(new Il2Cpp.String(newName));
          successShown = true;
          Logger.log("[hookNameChange] ShowNameChangeSuccessScreen displayed successfully!");
        }
      } catch (scErr: any) {
        Logger.log(`[hookNameChange] ShowNameChangeSuccessScreen failed: ${scErr.message}`);
      }

      if (!successShown) {
        try {
          const backBtn = screenInstance.method("BackButtonClicked", 0);
          if (backBtn) backBtn.invoke();
        } catch (_) {}
      }
    }

    const continueBtnClicked = ClassResolver.tryMethod(screenClass, "ContinueButtonClicked", 0);
    if (continueBtnClicked) {
      continueBtnClicked.implementation = function (this: Il2Cpp.Object) {
        Logger.log("[hookNameChange] ContinueButtonClicked intercepted!");
        handleScreenSubmit(this);
      };
    }

    const disabledClicked = ClassResolver.tryMethod(screenClass, "DisabledClicked", 0);
    if (disabledClicked) {
      disabledClicked.implementation = function (this: Il2Cpp.Object) {
        Logger.log("[hookNameChange] DisabledClicked intercepted!");
        handleScreenSubmit(this);
      };
    }
  }
}
