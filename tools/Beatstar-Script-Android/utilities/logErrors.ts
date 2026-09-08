import Logger from "../lib/Logger";

/**
 * Logs various internal errors normally hidden from Logcat.
 */
export const logErrors = () => {
  try {
    const logger = Il2Cpp.domain
      .assembly("SpaceApe.Logger")
      .image.class("Logger");
    if (logger) {
      logger.method("Warn").implementation = function (message: Il2Cpp.Object) {
        Logger.log(message.toString());
      };
      logger.method("Info").implementation = function (message: Il2Cpp.Object) {
        Logger.log(message.toString());
      };
      logger.method("Log").implementation = function (message: Il2Cpp.Object) {
        Logger.log(message.toString());
      };
      logger.method("Debug").implementation = function (message: Il2Cpp.Object) {
        Logger.log(message.toString());
      };
      logger.method("Error").implementation = function (message: Il2Cpp.Object) {
        Logger.log(message.toString());
      };
    }
  } catch (e) {}

  // Native IL2CPP C# Exception Interceptor (safe direct field access, no invoke)
  try {
    const raiseEx = Module.findExportByName("libil2cpp.so", "il2cpp_raise_exception");
    if (raiseEx) {
      Interceptor.attach(raiseEx, {
        onEnter(args) {
          try {
            if (!args[0].isNull()) {
              const ex = new Il2Cpp.Object(args[0]);
              const className = ex.class ? ex.class.name : "Exception";
              let msg = "";
              try {
                const msgField = ex.field("_message")?.value || ex.field("message")?.value;
                if (msgField && !msgField.isNull()) msg = msgField.toString();
              } catch (e) {}
              Logger.log(`[IL2CPP EXCEPTION] ${className}: ${msg}`);
            }
          } catch (e: any) {}
        }
      });
      Logger.log("[logErrors] Attached safe interceptor to il2cpp_raise_exception");
    }
  } catch (e) {}
};
