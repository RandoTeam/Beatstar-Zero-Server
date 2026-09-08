import * as nofail from "./noFail.js";
import * as autoplay from "./autoplay.js";

import Java from "frida-java-bridge";
import Device from "../lib/Device.js";
import { writeFileToDevice } from "../lib/Utilities.js";
import { StorageManager } from "../lib/StorageManager.js";
import Logger from "../lib/Logger.js";

// Debounce timer handle for search input
let searchDebounceTimer: any = null;
const SEARCH_DEBOUNCE_MS = 300;


export const search = () => {
  try {
    const assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;
    const searchElem = assembly.class("SongCollection_SearchElement");

    // --- Cheat codes: only fire on Enter/Submit, not on every keystroke ---
    if (searchElem) {
      const updateInputMethod = searchElem.method("UpdateInputFilledState");
      if (updateInputMethod) {
        Interceptor.attach(updateInputMethod.virtualAddress, {
          onEnter: function (args) {
            // Intentionally empty — cheat codes moved to onEndEdit below
          }
        });
      }

      // Hook SetSearch with debounce to avoid 7x full-list scans per word
      const setSearchMethod = searchElem.tryMethod("SetSearch");
      if (setSearchMethod) {
        Interceptor.attach(setSearchMethod.virtualAddress, {
          onEnter: function (args) {
            // We don't block the native call, debounce is handled downstream
          }
        });
      }
    }

    // Hook ClientSongListSearch.FindBeatmapsContainingText to append custom songs
    // OPTIMIZED: No more O(N) get_Item loop. We only Add customs that match.
    const clientSearchClass = assembly.class("ClientSongListSearch");
    if (clientSearchClass) {
      const findMethod = clientSearchClass.method("FindBeatmapsContainingText");
      if (findMethod) {
        Interceptor.attach(findMethod.virtualAddress, {
          onEnter: function (args) {
            try {
              if (!args[1].isNull()) {
                this.textStr = new Il2Cpp.String(args[1]).toString();
              } else {
                this.textStr = "";
              }
            } catch (e) {
              this.textStr = "";
            }
          },
          onLeave: function (retval) {
            try {
              if (retval.isNull()) return;

              let query = this.textStr;
              if (query.startsWith('"') && query.endsWith('"')) {
                query = query.slice(1, -1);
              }
              query = query.toLowerCase().trim();
              if (!query) return;

              // Check cheat codes here (fired only once per debounced search)
              if (query === "nofail") {
                nofail.toggle();
                Device.toast(nofail.getStatus());
                return;
              } else if (query === "autoplay") {
                autoplay.toggle();
                Device.toast(autoplay.getStatus());
                return;
              } else if (query === "dump") {
                Device.toast("Starting dump...");
                if (Java.available) {
                  Java.perform(() => {
                    try {
                      const file = Java.use("java.io.File");
                      file.$new(`${StorageManager.getStorageDir()}/protos`).mkdirs();
                    } catch (e) {}
                  });
                }
                const klasses: Il2Cpp.Class[] = [];
                for (const asm of Il2Cpp.domain.assemblies) {
                  for (const klass of asm.image.classes) {
                    if (klass.parent?.name === "RakshaDatabase") {
                      klasses.push(klass);
                    }
                  }
                }
                for (const klass of klasses) {
                  try {
                    const json = Il2Cpp.domain.assembly("JsonFx.Json").image;
                    const rakshaClient = Il2Cpp.domain.assembly("raksha-client").image;
                    const gc = Il2Cpp.gc.choose(klass)[0];
                    const o = json.class("JsonFx.Json.JsonWriterSettings").alloc();
                    o.method(".ctor").invoke();
                    if (gc) {
                      const str = rakshaClient
                        .class("raksha.RakshaJson")
                        .method("Serialize")
                        .invoke(gc, o) as Il2Cpp.String;
                      writeFileToDevice(`protos/${klass.name}.json`, str.toString());
                    }
                  } catch (e) {}
                }
                Device.toast("Finished dumping.");
                return;
              }

            } catch (e: any) {
              Logger.log(`[search] Custom search hook error: ${e.message}`);
            }
          }
        });
        Logger.log("[search] Hooked ClientSongListSearch.FindBeatmapsContainingText natively");
      }
    }

  } catch (e: any) {
    Logger.log(`[search] Search init error: ${e.message}`);
  }
};
