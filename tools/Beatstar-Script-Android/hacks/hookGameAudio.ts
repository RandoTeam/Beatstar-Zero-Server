import Logger from "../lib/Logger.js";
import { StorageManager } from "../lib/StorageManager.js";

let nativeAudioSource: any = null;
let currentUwr: any = null;
let isAudioLoaded = false;
let isAudioPlaying = false;
let selectedSongId = "1695";

export const hookGameAudio = () => {
  try {
    const assembly = Il2Cpp.domain.assembly("Assembly-CSharp").image;
    const appMusicSelector = assembly.class("BeatStar.Music.AppMusicSelector");
    const gameController = assembly.class("BeatStar.RhythmGame.GameController");
    
    // Look for common classes
    const wwiseAudioClasses = assembly.classes.filter(c => c.name.includes("MusicPlayer"));
    let musicPlayer = null;
    let playbackTime = null;

    for (const c of wwiseAudioClasses) {
        if (c.name === "MusicPlayer") musicPlayer = c;
        if (c.name === "MusicPlayerPlaybackTime") playbackTime = c;
    }

    if (!musicPlayer) {
        try { musicPlayer = assembly.class("BeatStar.WwiseApeAudio.MusicPlayer"); } catch(e) {}
    }
    
    if (!playbackTime) {
        try { playbackTime = assembly.class("BeatStar.WwiseApeAudio.MusicPlayerPlaybackTime"); } catch(e) {}
    }

    const goClass = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image.class("UnityEngine.GameObject");
    const objectClass = Il2Cpp.domain.assembly("UnityEngine.CoreModule").image.class("UnityEngine.Object");
    const audioSourceClass = Il2Cpp.domain.assembly("UnityEngine.AudioModule").image.class("UnityEngine.AudioSource");
    const fileClass = Il2Cpp.domain.assembly("mscorlib").image.class("System.IO.File");

    let isCustomSong = false;

    if (appMusicSelector) {
      appMusicSelector.methods.forEach(m => {
        if (m.name === "SelectMusic") {
          const originalParams = m.parameters.map((p: any) => p.type.name);
          m.implementation = function (songTemplate: any, ...args: any[]) {
            try {
              if (songTemplate) {
                try { selectedSongId = songTemplate.method("get_id").invoke().toString(); } 
                catch(e) { selectedSongId = songTemplate.field("id").value.toString(); }
                
                try {
                  const idLabel = songTemplate.field("idLabel").value.toString();
                  isCustomSong = idLabel.includes("file://");
                } catch(e) {}
              }
            } catch (e) {}
            // Call original so Wwise/ApeAudio plays lobby & preview music
            return this.method("SelectMusic").overload(...originalParams).invoke(songTemplate, ...args);
          };
        }
      });
    }

    // Hook PrepareNextMusic across the assembly
    assembly.classes.forEach(c => {
      c.methods.forEach(m => {
        if (m.name === "PrepareNextMusic") {
          m.implementation = function (...args: any[]) {
            try {
               const template = args[0];
               if (template) {
                  try { selectedSongId = template.method("get_id").invoke().toString(); } catch(e) {}
                  try {
                    const idLabel = template.field("idLabel").value.toString();
                    isCustomSong = idLabel.includes("file://");
                  } catch(e) {}
               }
            } catch(e) {}

            const params = m.parameters.map(p => p.type.name);

            // If it's an official song, do NOT hook AudioSource, let Wwise handle it!
            if (!isCustomSong) {
              return this.method(m.name).overload(...params).invoke(...args);
            }

            try {
              if (!nativeAudioSource) {
                const go = goClass.new();
                go.method(".ctor").overload("System.String").invoke(Il2Cpp.string("BeatCloneAudio"));
                objectClass.method("DontDestroyOnLoad").invoke(go);
                nativeAudioSource = go.method("AddComponent").overload("System.Type").invoke(audioSourceClass.type.object);
              }

              if (nativeAudioSource) {
                 nativeAudioSource.method("Stop").invoke();
              }
              isAudioLoaded = false;
              isAudioPlaying = false;
              currentUwr = null;

              const storageDir = StorageManager.getStorageDir();
              const basePath = `${storageDir}/songs/${selectedSongId}`;
              let ext = "wav";
              if (fileClass.method("Exists").invoke(Il2Cpp.string(`${basePath}/audio.ogg`))) {
                ext = "ogg";
              }

              const uri = `file://${basePath}/audio.${ext}`;
              Logger.log(`[BeatClone] Loading audio: ${uri}`);

              try {
                  const wwwClass = Il2Cpp.domain.assembly("UnityEngine.UnityWebRequestModule").image.class("UnityEngine.WWW");
                  currentUwr = wwwClass.new();
                  currentUwr.method(".ctor").overload("System.String").invoke(Il2Cpp.string(uri));
              } catch(e) {}

            } catch (e: any) {
               Logger.log(`[BeatClone] Error preparing audio: ${e.message}`);
               isAudioLoaded = true;
            }

            const params = m.parameters.map(p => p.type.name);
            return this.method(m.name).overload(...params).invoke(...args);
          };
        }

        if (m.name === "PlayNextMusic") {
          m.implementation = function (...args: any[]) {
            if (!isCustomSong) {
                const params = m.parameters.map(p => p.type.name);
                return this.method(m.name).overload(...params).invoke(...args);
            }
            isAudioPlaying = true;
            const params = m.parameters.map(p => p.type.name);
            return this.method(m.name).overload(...params).invoke(...args);
          };
        }
      });
    });

    if (gameController) {
      gameController.method("TickWaitingForStart").implementation = function () {
        if (!isCustomSong) {
            return this.method("TickWaitingForStart").invoke();
        }

        if (!isAudioLoaded && currentUwr) {
           try {
             const isDone = currentUwr.method("get_isDone").invoke();
             if (isDone) {
               Logger.log(`[BeatClone] Audio loaded into AudioSource`);
               let clip = currentUwr.method("GetAudioClip").overload("System.Boolean").invoke(false);
               if (clip) {
                   nativeAudioSource.method("set_clip").invoke(clip);
               }
               isAudioLoaded = true;
             }
           } catch(e: any) {
             Logger.log(`[BeatClone] Error getting audio clip: ${e.message}`);
             isAudioLoaded = true;
           }
        }

        if (isAudioLoaded && isAudioPlaying) {
          try {
            nativeAudioSource.method("Play").invoke();
          } catch(e) {}
          
          this.method("StartStatePlaying").invoke();
          isAudioPlaying = false; 
          return;
        }

        this.method("TickWaitingForStart").invoke();
      };
    }

    if (playbackTime) {
      playbackTime.methods.forEach(m => {
        if (m.name === "get_musicPlaybackTimeSecs") {
          m.implementation = function () {
             if (isCustomSong && nativeAudioSource && isAudioLoaded) {
               try {
                 const t = nativeAudioSource.method("get_time").invoke();
                 if (t > 0) return t;
               } catch(e) {}
               return 0.0;
             }
             return this.method(m.name).invoke();
          };
        }
      });
    }

    Logger.log("[BeatClone] Custom AudioSource hook injected successfully!");
  } catch (e: any) {
    Logger.log(`[BeatClone] hookGameAudio error: ${e.message}`);
  }
};
