import base64
import os

def generate_gadget_script():
    # 1. Read the compiled standalone offline engine (file.js)
    with open('tools/Beatstar-Script-Android/file.js', 'r', encoding='utf-8') as f:
        payload_code = f.read()

    # Direct JSON embedding (0ms load time instead of 50s XOR decryption)
    import json
    raw_payload_json = json.dumps(payload_code)
    print(f'[+] Standalone unencrypted engine payload: {len(raw_payload_json)} chars')

    # 2. Read the original Frida Gadget bootstrap script
    bootstrap_candidates = [
        'frida_gadget_script.js',
        'tools/frida_gadget_script.js',
        os.path.join(os.path.dirname(__file__), 'frida_gadget_script.js'),
        'archive/legacy_tools/frida_gadget_script.js'
    ]
    bootstrap_path = None
    for cand in bootstrap_candidates:
        if os.path.exists(cand):
            bootstrap_path = cand
            break
    if not bootstrap_path:
        raise FileNotFoundError("Frida gadget bootstrap script not found in any expected paths.")
    with open(bootstrap_path, 'r', encoding='utf-8') as f:
        bootstrap = f.read()

    # 3. Patch settings defaults to 127.0.0.1:5000 and offline=true
    old_defaults = '''    setDefaults() {
      if (this.settings.serverIp === void 0) {
        this.settings.serverIp = "beatstarmod.app";
      }
      if (this.settings.serverPort === void 0) {
        this.settings.serverPort = 3e3;
      }
      if (this.settings.serverExpressPort === void 0) {
        this.settings.serverExpressPort = 4e3;
      }
    }'''

    new_defaults = '''    setDefaults() {
      this.settings.serverIp = "127.0.0.1";
      this.settings.serverPort = 5000;
      this.settings.serverExpressPort = 5000;
      this.settings.offline = "true";
      this.settings.loadScript = "true";
    }'''

    assert old_defaults in bootstrap, 'old_defaults not found'
    bootstrap = bootstrap.replace(old_defaults, new_defaults, 1)

    # 4. Patch getLiveVersion to resolve instantly offline
    old_live = '''  var getLiveVersion = async () => {
    return new Promise(function(resolve3, reject) {
      try {
        networkRequest("/version", {
          version: getLocalVersion()
        }).then((liveVersion) => {
          resolve3(liveVersion);
        });
      } catch (e) {
        const error2 = e;
        Logger_default.log(`Got an error contacting the server: ${error2.message}`);
      }
    });
  };'''

    new_live = '''  var getLiveVersion = async () => {
    return new Promise(function(resolve3, reject) {
      Logger_default.log("[BeatClone] Offline mode active. Skipping remote version check.");
      resolve3(null);
    });
  };'''

    assert old_live in bootstrap, 'old_live not found'
    bootstrap = bootstrap.replace(old_live, new_live, 1)

    # 5. Patch checkForStoragePermissions to always return true (offline app-owned storage)
    old_perm = '''  function checkForStoragePermissions() {
    if (getJavaVersion() <= 10) {
      Logger_default.log("On Andoid 10 so can't show permissions screen.");
      return true;
    }
    const Environment = frida_java_bridge_default.use("android.os.Environment");
    if (!Environment.isExternalStorageManager()) {
      const context = frida_java_bridge_default.use("android.app.ActivityThread").currentApplication().getApplicationContext();
      const intentClass = frida_java_bridge_default.use("android.content.Intent");
      const Settings = frida_java_bridge_default.use("android.provider.Settings");
      const uri = frida_java_bridge_default.use("android.net.Uri").parse(
        `package:${context.getPackageName()}`
      );
      const intent = intentClass.$new(
        Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION.value,
        uri
      );
      intent.addFlags(268435456);
      Device_default.toast(
        "You're missing storage permissions. Add them here and restart."
      );
      context.startActivity(intent);
      return false;
    }
    return true;
  }'''

    new_perm = '''  function checkForStoragePermissions() {
    Logger_default.log("[BeatClone] Bypassing legacy external storage check; using app-owned sandbox storage.");
    return true;
  }'''

    if old_perm in bootstrap:
        bootstrap = bootstrap.replace(old_perm, new_perm, 1)
        print('[+] Patched checkForStoragePermissions to bypass external storage checks')

    # 6. Patch createDirectories in bootstrap to prevent legacy /sdcard/beatstar crashes
    old_create_dirs = '''  var createDirectories = () => {
    const file = frida_java_bridge_default.use("java.io.File");
    try {
      file.$new("sdcard/beatstar").mkdirs();
      file.$new("sdcard/beatstar/songs").mkdirs();
      file.$new("sdcard/beatstar/script").mkdirs();
    } catch (e) {
      const error2 = e;
      Logger_default.log(`Error creating directories: ${error2.message}`);
    }
  };'''

    new_create_dirs = '''  var createDirectories = () => {
    // Handled in app-owned sandbox by StorageManager
  };'''

    if old_create_dirs in bootstrap:
        bootstrap = bootstrap.replace(old_create_dirs, new_create_dirs, 1)
        print('[+] Patched bootstrap createDirectories')

    # 7. Patch executeScript to embed and evaluate the complete offline backend
    old_execute = '''  var executeScript = async () => {
    const path = done === "EXECUTE" ? "sdcard/beatstar/script/script.js" : "sdcard/beatstar/script/override.js";
    const script = dist_default.readFileSync(path);
    const code2 = Buffer2.from(script.toString(), "base64").toString();
    const decrypted = decrypt(code2);
    try {
      Script.evaluate("script", decrypted);
    } catch (e) {
      const error2 = e;
      Logger_default.log(`Error running script: ${error2.message}`);
    }
  };'''

    new_execute = f'''  const EMBEDDED_OFFLINE_PAYLOAD = {raw_payload_json};
  var executeScript = async () => {{
    let rawScript = "";
    const path = done === "EXECUTE" ? "sdcard/beatstar/script/script.js" : "sdcard/beatstar/script/override.js";
    try {{
      rawScript = dist_default.readFileSync(path).toString();
    }} catch (e) {{
      Logger_default.log("[BeatClone] Booting embedded offline engine instantly (no XOR)...");
      rawScript = EMBEDDED_OFFLINE_PAYLOAD;
    }}
    
    try {{
      Script.evaluate("script", rawScript);
      Logger_default.log("[BeatClone] Standalone offline engine evaluated in 0ms.");
    }} catch (e) {{
      const error2 = e;
      Logger_default.log(`Error running script: ${{error2.message}}`);
    }}
  }};'''

    assert old_execute in bootstrap, 'old_execute not found'
    bootstrap = bootstrap.replace(old_execute, new_execute, 1)

    # 8. Save final native script file
    out_path = 'tools/Beatstar-Script-Android/libfrida-gadget.script.so'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(bootstrap)

    import json
    config_path = 'tools/Beatstar-Script-Android/libfrida-gadget.config.so'
    config_dict = {
        "interaction": {
            "type": "script",
            "path": "libfrida-gadget.script.so"
        }
    }
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config_dict, f, indent=2)

    print(f'[+] Successfully generated {out_path} ({len(bootstrap)} bytes) and config')

if __name__ == '__main__':
    generate_gadget_script()
