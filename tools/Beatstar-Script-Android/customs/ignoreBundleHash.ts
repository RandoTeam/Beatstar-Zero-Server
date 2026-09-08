/**
 * Selective bundle hash / CRC bypass for custom filesystem bundles,
 * while preserving stock Unity caching and validation for official bundles.
 */
export const ignoreBundleHash = () => {
  try {
    const assembly = Il2Cpp.domain.assembly(
      "UnityEngine.UnityWebRequestAssetBundleModule"
    )?.image;
    if (!assembly) return;

    const uwrAssetBundle = assembly.class("UnityEngine.Networking.UnityWebRequestAssetBundle");
    if (!uwrAssetBundle) return;

    const overload3 = uwrAssetBundle.method("GetAssetBundle").overload(
      "System.String",
      "UnityEngine.Hash128",
      "System.UInt32"
    );

    if (overload3) {
      overload3.implementation = function (uri: any, hash: any, crc: any) {
        if (uri && uri.toString().includes("file://")) {
          return this.method("GetAssetBundle")
            .overload("System.String")
            .invoke(uri);
        }
        return this.method("GetAssetBundle")
          .overload("System.String", "UnityEngine.Hash128", "System.UInt32")
          .invoke(uri, hash, crc);
      };
    }
  } catch (e: any) {
    // Ignore if not present
  }
};
