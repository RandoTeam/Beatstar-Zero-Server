import Java from "frida-java-bridge";

class Device {
  static getDeviceLanguage() {
    try {
      if (Java.available) {
        let lang = "";
        Java.perform(() => {
          try {
            lang = Java.use("android.content.res.Resources")
              .getSystem()
              .getConfiguration()
              .getLocales()
              .get(0)
              .toString();
          } catch (e) {}
        });
        return lang || "en-US";
      }
    } catch (e) {}
    return "en-US";
  }

  static getAndroidId() {
    try {
      if (Java.available) {
        let id = "";
        Java.perform(() => {
          try {
            const app = Java.use("android.app.ActivityThread").currentApplication();
            if (app) {
              const context = app.getApplicationContext().getContentResolver();
              id = Java.use("android.provider.Settings$Secure").getString(
                context,
                "android_id"
              );
            }
          } catch (e) {}
        });
        return id || "bdc2bd747bfb497788d1b93ec2906b87";
      }
    } catch (e) {}
    return "bdc2bd747bfb497788d1b93ec2906b87";
  }

  static toast(message: string) {
    try {
      if (Java.available) {
        Java.perform(() => {
          try {
            const toast = Java.use("android.widget.Toast");
            const app = Java.use("android.app.ActivityThread").currentApplication();
            if (app) {
              const context = app.getApplicationContext();
              Java.scheduleOnMainThread(function () {
                try {
                  toast.makeText(context, Java.use("java.lang.String").$new(message), 1).show();
                } catch (e) {}
              });
            }
          } catch (e) {}
        });
      }
    } catch (e) {
      console.log("Failed to show toast");
    }
  }
}

export default Device;
