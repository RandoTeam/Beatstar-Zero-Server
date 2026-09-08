import { StorageManager } from "./StorageManager.js";

// Native C bindings for zero-JNI, zero-GC logging
let nativeLogWrite: ((prio: number, tag: NativePointer, text: NativePointer) => number) | null = null;
let tagPtr: NativePointer | null = null;

let nativeOpen: ((path: NativePointer, flags: number, mode: number) => number) | null = null;
let nativeWrite: ((fd: number, buf: NativePointer, count: number) => number) | null = null;
let nativeClose: ((fd: number) => number) | null = null;
let nativeStrlen: ((buf: NativePointer) => number) | null = null;

try {
  const liblog = Process.findModuleByName("liblog.so") || Process.getModuleByName("liblog.so");
  if (liblog) {
    const logWriteAddr = liblog.findExportByName("__android_log_write");
    if (logWriteAddr) {
      nativeLogWrite = new NativeFunction(logWriteAddr, "int", ["int", "pointer", "pointer"]) as any;
      tagPtr = Memory.allocUtf8String("beatstar");
    }
  }
} catch (e) {}

try {
  const libc = Process.findModuleByName("libc.so") || Process.getModuleByName("libc.so");
  if (libc) {
    const openAddr = libc.findExportByName("open");
    const writeAddr = libc.findExportByName("write");
    const closeAddr = libc.findExportByName("close");
    const strlenAddr = libc.findExportByName("strlen");
    if (openAddr && writeAddr && closeAddr && strlenAddr) {
      nativeOpen = new NativeFunction(openAddr, "int", ["pointer", "int", "int"]) as any;
      nativeWrite = new NativeFunction(writeAddr, "int", ["int", "pointer", "int"]) as any;
      nativeClose = new NativeFunction(closeAddr, "int", ["int"]) as any;
      nativeStrlen = new NativeFunction(strlenAddr, "int", ["pointer"]) as any;
    }
  }
} catch (e) {}

class Logger {
  log(str: string) {
    console.log(`[BeatstarOffline] ${str}`);

    // Direct native logcat output via liblog.so without touching JNI / ART
    if (nativeLogWrite && tagPtr) {
      try {
        const textPtr = Memory.allocUtf8String(str);
        nativeLogWrite(2, tagPtr, textPtr); // ANDROID_LOG_VERBOSE
      } catch (e) {}
    }

    // Direct native POSIX file append via libc.so without touching JNI / ART
    try {
      const storageDir = StorageManager.getStorageDir();
      if (storageDir && nativeOpen && nativeWrite && nativeClose && nativeStrlen) {
        const logPath = `${storageDir}/log.txt`;
        const timeStamp = new Date().toISOString();
        const line = `[${timeStamp}] ${str}\n`;
        const pathPtr = Memory.allocUtf8String(logPath);
        // O_WRONLY (1) | O_CREAT (64) | O_APPEND (1024) = 1089, mode 0666 (438)
        const fd = nativeOpen(pathPtr, 1089, 438);
        if (fd >= 0) {
          const bufPtr = Memory.allocUtf8String(line);
          const len = nativeStrlen(bufPtr);
          nativeWrite(fd, bufPtr, len);
          nativeClose(fd);
        }
      }
    } catch (e) {}
  }
}

export default new Logger();
