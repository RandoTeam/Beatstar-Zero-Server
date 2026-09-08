import Logger from "./Logger.js";
import Java from "frida-java-bridge";

const callbackMap: { [key: string]: () => void } = {};
let runnableRegistered = false;
let DynamicRunnableClass: any = null;

function getDynamicRunnable(id: string, fn: () => void) {
  callbackMap[id] = fn;
  if (!runnableRegistered) {
    DynamicRunnableClass = Java.registerClass({
      name: "com.beatclone.DynamicRunnable",
      implements: [Java.use("java.lang.Runnable")],
      fields: {
        cbId: "java.lang.String",
      },
      methods: {
        run: function () {
          try {
            const idVal = this.cbId.value;
            const cb = callbackMap[idVal];
            if (cb) cb();
          } catch (e: any) {
            Logger.log(`[DynamicRunnable] Error: ${e.message}`);
          }
        },
      },
    });
    runnableRegistered = true;
  }
  const inst = DynamicRunnableClass.$new();
  inst.cbId.value = id;
  return inst;
}

export class NativeLoaderUI {
  private static activity: any = null;
  private static layout: any = null;
  private static progressBar: any = null;
  private static statusText: any = null;
  private static isShowing: boolean = false;
  private static updateHandler: any = null;
  private static waveRunnable: any = null;
  private static bars: any[] = [];
  private static tick: number = 0;

  static show() {
    if (this.isShowing) return;
    try {
      if (!Java.available) return;
      Java.performNow(() => {
        try {
          const UnityPlayer = Java.use("com.unity3d.player.UnityPlayer");
          this.activity = UnityPlayer.currentActivity.value;
        } catch (e) {}

        if (!this.activity) {
          try {
            const ActivityThread = Java.use("android.app.ActivityThread");
            const activityThread = ActivityThread.currentActivityThread();
            if (activityThread) {
              const mActivities = activityThread.mActivities.value;
              const values = mActivities.values().toArray();
              if (values.length > 0) {
                const activityRecord = values[0];
                this.activity = activityRecord.activity.value;
                Logger.log("[NativeLoaderUI] Acquired Activity via ActivityThread fallback!");
              }
            }
          } catch (e: any) {
            Logger.log(`[NativeLoaderUI] Activity fallback error: ${e.message}`);
          }
        }

        if (!this.activity) {
          Logger.log("[NativeLoaderUI] Activity is still null, cannot show overlay UI");
          return;
        }

        const uiRunnable = getDynamicRunnable("showUI", () => {
          try {
            const RelativeLayout = Java.use("android.widget.RelativeLayout");
            const LinearLayout = Java.use("android.widget.LinearLayout");
            const TextView = Java.use("android.widget.TextView");
            const Color = Java.use("android.graphics.Color");
            const View = Java.use("android.view.View");
            const Gravity = Java.use("android.view.Gravity");
            const LayoutParams = Java.use("android.widget.RelativeLayout$LayoutParams");
            const LinearLayoutParams = Java.use("android.widget.LinearLayout$LayoutParams");
            const Handler = Java.use("android.os.Handler");
            const Looper = Java.use("android.os.Looper");
            const PorterDuffMode = Java.use("android.graphics.PorterDuff$Mode");
            const WindowManagerLayoutParams = Java.use("android.view.WindowManager$LayoutParams");

            const context = NativeLoaderUI.activity;
            const JString = Java.use("java.lang.String");
            NativeLoaderUI.layout = RelativeLayout.$new(context);
            NativeLoaderUI.layout.setBackgroundColor(Color.parseColor(JString.$new("#0a0a0a")));

            const centerContainer = LinearLayout.$new(context);
            centerContainer.setOrientation(1);
            centerContainer.setGravity(Gravity.CENTER_HORIZONTAL.value);
            const centerParams = LayoutParams.$new(-1, -2);
            centerParams.addRule(13); // CENTER_IN_PARENT
            centerContainer.setLayoutParams(centerParams);

            const waveContainer = LinearLayout.$new(context);
            waveContainer.setOrientation(0);
            waveContainer.setGravity(Gravity.CENTER.value);
            const waveParams = LinearLayoutParams.$new(-2, 100);
            waveContainer.setLayoutParams(waveParams);

            NativeLoaderUI.bars = [];
            for (let i = 0; i < 5; i++) {
              const bar = View.$new(context);
              bar.setBackgroundColor(Color.WHITE.value);
              const barParams = LinearLayoutParams.$new(12, 50);
              barParams.setMargins(6, 0, 6, 0);
              bar.setLayoutParams(barParams);
              waveContainer.addView(bar);
              NativeLoaderUI.bars.push(bar);
            }

            const titleText = TextView.$new(context);
            titleText.setText(JString.$new("BEATSTAR"));
            titleText.setTextColor(Color.WHITE.value);
            titleText.setTextSize(20);
            titleText.setTypeface(null, 1);
            titleText.setLetterSpacing(0.2);
            const titleParams = LinearLayoutParams.$new(-2, -2);
            titleParams.setMargins(0, 40, 0, 0);
            titleText.setLayoutParams(titleParams);

            centerContainer.addView(waveContainer);
            centerContainer.addView(titleText);
            NativeLoaderUI.layout.addView(centerContainer);

            const bottomContainer = LinearLayout.$new(context);
            bottomContainer.setOrientation(1);
            const bottomParams = LayoutParams.$new(-1, -2);
            bottomParams.addRule(12); // ALIGN_PARENT_BOTTOM
            bottomParams.setMargins(100, 0, 100, 150);
            bottomContainer.setLayoutParams(bottomParams);

            NativeLoaderUI.statusText = TextView.$new(context);
            NativeLoaderUI.statusText.setText(JString.$new("Optimizing for first launch..."));
            NativeLoaderUI.statusText.setTextColor(Color.parseColor(JString.$new("#aaaaaa")));
            NativeLoaderUI.statusText.setTextSize(14);
            NativeLoaderUI.statusText.setGravity(Gravity.CENTER.value);

            const ProgressBar = Java.use("android.widget.ProgressBar");
            NativeLoaderUI.progressBar = ProgressBar.$new(context, null, 16842872); // horizontal
            NativeLoaderUI.progressBar.setMax(100);
            NativeLoaderUI.progressBar.setProgress(0);

            const drawable = NativeLoaderUI.progressBar.getProgressDrawable();
            if (drawable) drawable.setColorFilter(Color.WHITE.value, PorterDuffMode.SRC_IN.value);

            bottomContainer.addView(NativeLoaderUI.statusText);
            bottomContainer.addView(NativeLoaderUI.progressBar);
            NativeLoaderUI.layout.addView(bottomContainer);

            NativeLoaderUI.activity.addContentView(NativeLoaderUI.layout, WindowManagerLayoutParams.$new(-1, -1));

            NativeLoaderUI.updateHandler = Handler.$new(Looper.getMainLooper());
            NativeLoaderUI.tick = 0;
            NativeLoaderUI.waveRunnable = getDynamicRunnable("waveAnim", () => {
              try {
                NativeLoaderUI.tick++;
                for (let i = 0; i < NativeLoaderUI.bars.length; i++) {
                  const offset = i * 2;
                  const val = 0.5 + Math.abs(Math.sin((NativeLoaderUI.tick + offset) * 0.2)) * 0.7;
                  NativeLoaderUI.bars[i].setScaleY(val);
                }
                if (NativeLoaderUI.isShowing && NativeLoaderUI.updateHandler && NativeLoaderUI.waveRunnable) {
                  NativeLoaderUI.updateHandler.postDelayed(NativeLoaderUI.waveRunnable, 50);
                }
              } catch (e) {}
            });
            NativeLoaderUI.updateHandler.post(NativeLoaderUI.waveRunnable);

            NativeLoaderUI.isShowing = true;
            Logger.log("[NativeLoaderUI] Showed Sleek UI on Android Thread");
          } catch (e: any) {
            Logger.log(`[NativeLoaderUI] UI thread error: ${e.message}`);
          }
        });

        this.activity.runOnUiThread(uiRunnable);
      });
    } catch (e: any) {
      Logger.log(`[NativeLoaderUI] Failed to show UI: ${e.message}`);
    }
  }

  static updateProgress(percent: number, status?: string) {
    if (!this.isShowing || !this.activity) return;
    try {
      Java.performNow(() => {
        const updateRunnable = getDynamicRunnable("updateProgress", () => {
          if (NativeLoaderUI.progressBar) {
            if (percent < 0) {
              // Indeterminate mode
              NativeLoaderUI.progressBar.setIndeterminate(true);
            } else {
              NativeLoaderUI.progressBar.setIndeterminate(false);
              NativeLoaderUI.progressBar.setProgress(Math.floor(percent));
            }
          }
          if (NativeLoaderUI.statusText && status) {
            const JString = Java.use("java.lang.String");
            NativeLoaderUI.statusText.setText(JString.$new(status));
          }
        });
        this.activity.runOnUiThread(updateRunnable);
      });
    } catch (e) {}
  }

  static hide() {
    if (!this.isShowing || !this.activity || !this.layout) return;
    try {
      Java.performNow(() => {
        const hideRunnable = getDynamicRunnable("hideUI", () => {
          try {
            // Fade out over 400ms for seamless transition to Unity
            NativeLoaderUI.layout.animate()
              .alpha(0.0)
              .setDuration(400)
              .withEndAction(getDynamicRunnable("fadeComplete", () => {
                try {
                  const viewGroup = NativeLoaderUI.layout.getParent();
                  if (viewGroup) {
                    const ViewGroupClass = Java.use("android.view.ViewGroup");
                    Java.cast(viewGroup, ViewGroupClass).removeView(NativeLoaderUI.layout);
                  }
                  NativeLoaderUI.isShowing = false;
                  if (NativeLoaderUI.updateHandler) {
                    NativeLoaderUI.updateHandler.removeCallbacksAndMessages(null);
                  }
                  Logger.log("[NativeLoaderUI] Faded out and hidden");
                } catch (e) {}
              }))
              .start();
          } catch (e: any) {
            // Fallback: instant remove if animate() isn't available
            try {
              const viewGroup = NativeLoaderUI.layout.getParent();
              if (viewGroup) {
                const ViewGroupClass = Java.use("android.view.ViewGroup");
                Java.cast(viewGroup, ViewGroupClass).removeView(NativeLoaderUI.layout);
              }
              NativeLoaderUI.isShowing = false;
              if (NativeLoaderUI.updateHandler) {
                NativeLoaderUI.updateHandler.removeCallbacksAndMessages(null);
              }
              Logger.log("[NativeLoaderUI] Hidden UI (instant fallback)");
            } catch (e2) {}
          }
        });
        this.activity.runOnUiThread(hideRunnable);
      });
    } catch (e) {}
  }
}

