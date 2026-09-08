import http from "@frida/http";
import Logger from "../lib/Logger.js";
import Java from "frida-java-bridge";
import { StorageManager } from "./StorageManager.js";
import { DeviceFs } from "./DeviceFs.js";

export const readFileOnDevice = (
  fileName: string,
  root: boolean = false
): any => {
  try {
    const storageDir = StorageManager.getStorageDir();
    const target = root ? fileName : `${storageDir}/${fileName}`;
    if (DeviceFs.exists(target)) {
      return DeviceFs.readTextFileSync(target);
    }
  } catch (e) {}
  return "";
};

export const writeFileToDevice = (fileName: string, data: string) => {
  try {
    const storageDir = StorageManager.getStorageDir();
    const target = `${storageDir}/${fileName}`;
    DeviceFs.writeFileSync(target, data);
  } catch (e) {
    Logger.log("Failed to write file to device: " + e);
  }
};

export const customServerNetworkRequest = (
  path: string,
  body: any = {}
): Promise<string> => {
  return new Promise(function (resolve) {
    const targetUrl = "http://127.0.0.1:5000" + path;
    const bodyStr = JSON.stringify(body);

    if (!Java.available) {
      resolve("{}");
      return;
    }

    Java.perform(function () {
      try {
        var HttpURLConnection = Java.use("java.net.HttpURLConnection");
        var URL = Java.use("java.net.URL");
        var BufferedReader = Java.use("java.io.BufferedReader");
        var BufferedWriter = Java.use("java.io.BufferedWriter");
        var BufferedOutputStream = Java.use("java.io.BufferedOutputStream");
        var OutputStreamWriter = Java.use("java.io.OutputStreamWriter");
        var StringBuilder = Java.use("java.lang.StringBuilder");
        var InputStreamReader = Java.use("java.io.InputStreamReader");

        var url = URL.$new(Java.use("java.lang.String").$new(targetUrl));
        var conn = url.openConnection();
        conn = Java.cast(conn, HttpURLConnection);
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(3000);
        conn.setReadTimeout(3000);
        conn.setDoInput(true);
        conn.setDoOutput(true);
        conn.setChunkedStreamingMode(0);

        let os = conn.getOutputStream();
        const out = BufferedOutputStream.$new(os);
        const osw = OutputStreamWriter.$new(
          out,
          Java.use("java.lang.String").$new("UTF-8")
        );
        var writer = BufferedWriter.$new(osw);
        writer.$super.write(Java.use("java.lang.String").$new(bodyStr));
        writer.flush();
        writer.close();
        os.close();

        conn.connect();
        var code = conn.getResponseCode();
        var ret: string = "{}";
        if (code == 200) {
          var inputStream = conn.getInputStream();
          var buffer = BufferedReader.$new(InputStreamReader.$new(inputStream));
          var sb = StringBuilder.$new();
          var line = null;
          while ((line = buffer.readLine()) != null) {
            sb.append(line);
          }
          ret = sb.toString();
        }
        conn.disconnect();
        resolve(ret);
      } catch (err) {
        resolve("{}");
      }
    });
  });
};

export const scoreToMedal = (score: number, difficulty: number) => {
  const normal = {
    star_1: 0,
    star_2: 10000,
    star_3: 17500,
    star_4: 35000,
    star_5: 47500,
    medal_gold: 48500,
    medal_platinum: 49000,
    medal_diamond: 49500,
  };
  const hard = {
    star_1: 0,
    star_2: 15000,
    star_3: 37500,
    star_4: 60000,
    star_5: 71250,
    medal_gold: 72750,
    medal_platinum: 73500,
    medal_diamond: 74250,
  };
  const extreme = {
    star_1: 0,
    star_2: 20000,
    star_3: 50000,
    star_4: 80000,
    star_5: 95000,
    medal_gold: 97000,
    medal_platinum: 98000,
    medal_diamond: 99000,
  };
  switch (difficulty) {
    case 1:
      return Object.entries(extreme)
        .reverse()
        .find((el) => el[1] <= score)![0];
    case 3:
      return Object.entries(hard)
        .reverse()
        .find((el) => el[1] <= score)![0];
    default:
      return Object.entries(normal)
        .reverse()
        .find((el) => el[1] <= score)![0];
  }
};

export const createDirectories = () => {
  try {
    const appFilesDir = StorageManager.getAppFilesDir();
    const storageDir = StorageManager.getStorageDir();
    DeviceFs.mkdirs(appFilesDir + "/UnityCache/Shared");
    DeviceFs.mkdirs(appFilesDir + "/streamedimages");
    DeviceFs.mkdirs(appFilesDir + "/streamableemojis");
    const subdirs = ["", "/songs", "/script", "/customs", "/cms", "/covers", "/bundles"];
    for (const sub of subdirs) {
      DeviceFs.mkdirs(storageDir + sub);
    }
  } catch (e) {}
};

export const getJavaVersion = () => parseInt(Java.androidVersion);
