import fs from "frida-fs";
import Java from "frida-java-bridge";
import Logger from "./Logger.js";

// Native POSIX C bindings for fast, zero-JNI filesystem operations
let nativeAccess: ((path: NativePointer, mode: number) => number) | null = null;
let nativeOpen: ((path: NativePointer, flags: number, mode: number) => number) | null = null;
let nativeWrite: ((fd: number, buf: NativePointer, count: number) => number) | null = null;
let nativeClose: ((fd: number) => number) | null = null;
let nativeStrlen: ((buf: NativePointer) => number) | null = null;

try {
  const libc = Process.findModuleByName("libc.so") || Process.getModuleByName("libc.so");
  if (libc) {
    const accessAddr = libc.findExportByName("access");
    const openAddr = libc.findExportByName("open");
    const writeAddr = libc.findExportByName("write");
    const closeAddr = libc.findExportByName("close");
    const strlenAddr = libc.findExportByName("strlen");
    if (accessAddr) nativeAccess = new NativeFunction(accessAddr, "int", ["pointer", "int"]) as any;
    if (openAddr) nativeOpen = new NativeFunction(openAddr, "int", ["pointer", "int", "int"]) as any;
    if (writeAddr) nativeWrite = new NativeFunction(writeAddr, "int", ["int", "pointer", "int"]) as any;
    if (closeAddr) nativeClose = new NativeFunction(closeAddr, "int", ["int"]) as any;
    if (strlenAddr) nativeStrlen = new NativeFunction(strlenAddr, "int", ["pointer"]) as any;
  }
} catch (e) {}

export class DeviceFs {
  private static existsRaw(path: string): boolean {
    if (!path) return false;
    // 1. Direct native POSIX access(2) call (0.001 ms, zero JNI, zero GC frames)
    if (nativeAccess) {
      try {
        const pathPtr = Memory.allocUtf8String(path);
        if (nativeAccess(pathPtr, 0) === 0) {
          return true;
        }
      } catch (e) {}
    }

    // 2. Fallback to frida-fs
    try {
      fs.statSync(path);
      return true;
    } catch (e) {}

    return false;
  }

  static resolvePath(path: string): string {
    if (!path) return path;
    if (this.existsRaw(path)) return path;

    // Bridge between root sdcard/beatstar and scoped app-owned storage
    if (path.startsWith("sdcard/beatstar") || path.startsWith("/sdcard/beatstar")) {
      const sub = path.replace(/^\/?sdcard\/beatstar\/?/, "");
      const appStorage = "/storage/emulated/0/Android/data/com.spaceapegames.beatstar/files/beatstar";
      const alt = sub ? `${appStorage}/${sub}` : appStorage;
      if (this.existsRaw(alt)) return alt;
    } else if (path.includes("com.spaceapegames.beatstar/files/beatstar")) {
      const idx = path.indexOf("com.spaceapegames.beatstar/files/beatstar");
      const sub = path.substring(idx + "com.spaceapegames.beatstar/files/beatstar".length).replace(/^\//, "");
      const alt = sub ? `sdcard/beatstar/${sub}` : "sdcard/beatstar";
      if (this.existsRaw(alt)) return alt;
    }
    return path;
  }

  static exists(path: string): boolean {
    if (!path) return false;
    const resolved = this.resolvePath(path);
    return this.existsRaw(resolved);
  }

  static mkdirs(path: string): boolean {
    if (!path) return false;
    if (Java.available) {
      let res = false;
      try {
        Java.performNow(() => {
          try {
            const File = Java.use("java.io.File");
            const dir = File.$new(path);
            if (!dir.exists()) {
              res = dir.mkdirs();
            } else {
              res = true;
            }
          } catch (e) {}
        });
        return res;
      } catch (e) {}
    }
    return false;
  }

  static readFileSync(path: string): Buffer {
    const targetPath = this.resolvePath(path);
    try {
      return fs.readFileSync(targetPath) as Buffer;
    } catch (e) {
      if (Java.available) {
        let resultBuf: Buffer | null = null;
        try {
          Java.performNow(() => {
            try {
              const File = Java.use("java.io.File");
              const FileInputStream = Java.use("java.io.FileInputStream");
              const f = File.$new(targetPath);
              if (!f.exists()) return;
              const length = Number(f.length());
              const fis = FileInputStream.$new(f);
              const jBytes = Java.array("byte", new Array(length).fill(0));
              fis.read(jBytes);
              fis.close();

              const Base64 = Java.use("android.util.Base64");
              // 2 = Base64.NO_WRAP (omits newlines)
              const b64Str = Base64.encodeToString(jBytes, 2);
              resultBuf = Buffer.from(b64Str, "base64");
            } catch (err) {}
          });
        } catch (err) {}
        if (resultBuf) return resultBuf;
      }
      throw e;
    }
  }

  static readTextFileSync(path: string): string {
    const targetPath = this.resolvePath(path);
    try {
      const data = fs.readFileSync(targetPath);
      return data.toString();
    } catch (e) {}

    if (Java.available) {
      let result: string | null = null;
      try {
        Java.performNow(() => {
          try {
            const File = Java.use("java.io.File");
            const f = File.$new(targetPath);
            if (!f.exists()) return;
            const BufferedReader = Java.use("java.io.BufferedReader");
            const InputStreamReader = Java.use("java.io.InputStreamReader");
            const FileInputStream = Java.use("java.io.FileInputStream");
            const StringBuilder = Java.use("java.lang.StringBuilder");
            const fis = FileInputStream.$new(f);
            const isr = InputStreamReader.$new(fis, "UTF-8");
            const reader = BufferedReader.$new(isr);
            const sb = StringBuilder.$new();
            let line = reader.readLine();
            while (line !== null) {
              sb.append(line);
              line = reader.readLine();
              if (line !== null) sb.append("\n");
            }
            reader.close();
            result = sb.toString();
          } catch (e) {}
        });
      } catch (e) {}
      if (result !== null) return result;
    }
    return "";
  }

  static writeFileSync(path: string, data: string | Buffer | Uint8Array): void {
    try {
      if (Java.available) {
        Java.performNow(() => {
          try {
            const File = Java.use("java.io.File");
            const f = File.$new(path);
            const parent = f.getParentFile();
            if (parent && !parent.exists()) {
              parent.mkdirs();
            }
          } catch (e) {}
        });
      }
    } catch (e) {}

    try {
      fs.writeFileSync(path, data);
    } catch (e) {
      if (Java.available) {
        try {
          Java.performNow(() => {
            try {
              const File = Java.use("java.io.File");
              const FileOutputStream = Java.use("java.io.FileOutputStream");
              const f = File.$new(path);
              const fos = FileOutputStream.$new(f);
              if (typeof data === "string") {
                const jStr = Java.use("java.lang.String").$new(data);
                const jBytes = jStr.getBytes("UTF-8");
                fos.write(jBytes);
              } else {
                const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
                const jBytes = Java.array("byte", Array.from(u8));
                fos.write(jBytes);
              }
              fos.flush();
              fos.close();
            } catch (err) {}
          });
        } catch (err) {}
      }
    }
  }

  static appendFileSync(path: string, data: string | Buffer | Uint8Array): void {
    const targetPath = this.resolvePath(path);
    if (typeof data === "string" && nativeOpen && nativeWrite && nativeClose && nativeStrlen) {
      try {
        const pathPtr = Memory.allocUtf8String(targetPath);
        // O_WRONLY (1) | O_CREAT (64) | O_APPEND (1024) = 1089, mode 0666 (438)
        const fd = nativeOpen(pathPtr, 1089, 438);
        if (fd >= 0) {
          const bufPtr = Memory.allocUtf8String(data);
          const len = nativeStrlen(bufPtr);
          nativeWrite(fd, bufPtr, len);
          nativeClose(fd);
          return;
        }
      } catch (e) {}
    }

    try {
      fs.appendFileSync(targetPath, data);
      return;
    } catch (e) {}

    if (Java.available) {
      try {
        Java.performNow(() => {
          try {
            const File = Java.use("java.io.File");
            const FileOutputStream = Java.use("java.io.FileOutputStream");
            const f = File.$new(path);
            const fos = FileOutputStream.$new(f, true);
            if (typeof data === "string") {
              const jStr = Java.use("java.lang.String").$new(data);
              const jBytes = jStr.getBytes("UTF-8");
              fos.write(jBytes);
            } else {
              const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
              const jBytes = Java.array("byte", Array.from(u8));
              fos.write(jBytes);
            }
            fos.flush();
            fos.close();
          } catch (err) {}
        });
      } catch (err) {}
    }
  }

  static mkdirs(path: string): boolean {
    if (!path) return false;
    const targetPath = this.resolvePath(path);
    if (Java.available) {
      let res = false;
      try {
        Java.performNow(() => {
          try {
            const File = Java.use("java.io.File");
            const dir = File.$new(targetPath);
            if (!dir.exists()) {
              res = dir.mkdirs();
            } else {
              res = true;
            }
          } catch (e) {}
        });
        return res;
      } catch (e) {}
    }
    return false;
  }

  static readdirSync(path: string): string[] {
    const targetPath = this.resolvePath(path);
    if (Java.available) {
      let result: string[] = [];
      try {
        Java.performNow(() => {
          try {
            const File = Java.use("java.io.File");
            const f = File.$new(targetPath);
            if (f.exists() && f.isDirectory()) {
              const list = f.list();
              if (list) {
                for (let i = 0; i < list.length; i++) {
                  result.push(list[i].toString());
                }
              }
            }
          } catch (e) {}
        });
        if (result.length > 0) return result;
      } catch (e) {}
    }
    try {
      return fs.readdirSync(targetPath);
    } catch (e) {
      return [];
    }
  }
}
