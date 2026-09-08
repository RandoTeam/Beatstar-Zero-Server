import Logger from "./Logger.js";

/**
 * Universal Il2Cpp Class Resolver for Beatstar.
 * Provides indexed lookup, assembly disambiguation, nested class resolution,
 * safe method helpers, and robust error logging.
 */
class UniversalClassResolver {
  private fullNameMap: Map<string, Il2Cpp.Class[]> = new Map();
  private simpleNameMap: Map<string, Il2Cpp.Class[]> = new Map();
  private assemblyQualifiedMap: Map<string, Il2Cpp.Class> = new Map();
  private initialized: boolean = false;

  private assemblyPriority: Record<string, number> = {
    "Assembly-CSharp": 100,
    "RakshaModel": 95,
    "MetaLogic": 90,
    "SpaceApe.Lang": 85,
    "SpaceApe.UnityAssets": 85,
    "SpaceApe.Scaling.Runtime": 85,
    "SpaceApe.Network": 85,
    "SharplaModel": 80,
    "UnityEngine.CoreModule": 70,
    "UnityEngine.AudioModule": 70,
    "UnityEngine.AssetBundleModule": 70,
    "UnityEngine.UnityWebRequestModule": 70,
    "mscorlib": 60,
    "System.Private.CoreLib": 60,
    "SharplaClient": 40,
    "SharplaLegacyClient": 20,
    "Assembly-CSharp-firstpass": 10,
  };

  /**
   * Initializes or refreshes the class indexes across all loaded assemblies.
   */
  public init(): void {
    try {
      this.fullNameMap.clear();
      this.simpleNameMap.clear();
      this.assemblyQualifiedMap.clear();

      const assemblies = Il2Cpp.domain.assemblies;
      for (const asm of assemblies) {
        const asmName = asm.name;
        const img = asm.image;
        if (!img) continue;

        for (const klass of img.classes) {
          const simpleName = klass.name;
          const fullName = klass.namespace ? `${klass.namespace}.${simpleName}` : simpleName;
          const asmKey = `${asmName}::${fullName}`;

          // Assembly-qualified key
          this.assemblyQualifiedMap.set(asmKey, klass);
          this.assemblyQualifiedMap.set(`${asmName}::${simpleName}`, klass);

          // Full name key
          const fullList = this.fullNameMap.get(fullName) || [];
          fullList.push(klass);
          this.fullNameMap.set(fullName, fullList);

          // Simple name key
          const simpleList = this.simpleNameMap.get(simpleName) || [];
          simpleList.push(klass);
          this.simpleNameMap.set(simpleName, simpleList);
        }
      }

      this.initialized = true;
      Logger.log(`[ClassResolver] Indexed ${this.fullNameMap.size} classes across ${assemblies.length} assemblies.`);
    } catch (e: any) {
      Logger.log(`[ClassResolver] Index initialization error: ${e.message}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  private getAssemblyScore(asmName: string): number {
    if (this.assemblyPriority[asmName] !== undefined) {
      return this.assemblyPriority[asmName];
    }
    if (asmName.startsWith("SpaceApe.")) return 80;
    if (asmName.startsWith("UnityEngine.")) return 65;
    return 50;
  }

  private pickBestClass(classes: Il2Cpp.Class[]): Il2Cpp.Class {
    if (classes.length === 1) return classes[0];
    return classes.slice().sort((a, b) => {
      const scoreA = this.getAssemblyScore(a.image.assembly.name);
      const scoreB = this.getAssemblyScore(b.image.assembly.name);
      return scoreB - scoreA;
    })[0];
  }

  /**
   * Finds a class safely. Returns null if not found.
   * Supports:
   * - Full qualified names: "com.spaceape.flamingo.model.MyProfileTO"
   * - Simple names: "NetworkMonitor", "PlaySongScreenController"
   * - Assembly-qualified names: "Assembly-CSharp::Config" or findClass("Config", "Assembly-CSharp")
   * - Nested classes: "Outer.Inner" / "Outer/Inner" / "Outer+Inner"
   */
  public findClass(name: string, assemblyHint?: string): Il2Cpp.Class | null {
    try {
      this.ensureInitialized();

      // Tier 0: Explicit assembly hint or prefix
      if (assemblyHint) {
        const key = `${assemblyHint}::${name}`;
        const match = this.assemblyQualifiedMap.get(key);
        if (match) return match;
      }
      if (name.includes("::")) {
        const match = this.assemblyQualifiedMap.get(name);
        if (match) return match;
        name = name.split("::")[1];
      }

      // Tier 1: Exact Full Qualified Name match
      const fullMatches = this.fullNameMap.get(name);
      if (fullMatches && fullMatches.length > 0) {
        return this.pickBestClass(fullMatches);
      }

      // Tier 2: Nested class normalization (replace '.' or '+' with '/')
      if (name.includes(".") || name.includes("+")) {
        const slashAttempt = name.replace(/[.+]/g, "/");
        const slashMatches = this.fullNameMap.get(slashAttempt);
        if (slashMatches && slashMatches.length > 0) {
          return this.pickBestClass(slashMatches);
        }

        const lastDot = name.lastIndexOf(".");
        if (lastDot !== -1) {
          const nestedAttempt = name.substring(0, lastDot) + "/" + name.substring(lastDot + 1);
          const nestedMatches = this.fullNameMap.get(nestedAttempt);
          if (nestedMatches && nestedMatches.length > 0) {
            return this.pickBestClass(nestedMatches);
          }
        }
        // Dotted queries MUST NOT fall back to loose simple name matching
        return null;
      }

      // Tier 3: Simple Name Match (only for queries without dots)
      const simpleMatches = this.simpleNameMap.get(name);
      if (simpleMatches && simpleMatches.length > 0) {
        if (simpleMatches.length > 1) {
          Logger.log(`[ClassResolver] Warning: Ambiguous simple class name '${name}' matched in multiple assemblies (${simpleMatches.map(c => c.image.assembly.name).join(", ")}). Prioritizing highest ranking assembly.`);
        }
        return this.pickBestClass(simpleMatches);
      }

      return null;
    } catch (e: any) {
      Logger.log(`[ClassResolver] findClass error for '${name}': ${e.message}`);
      return null;
    }
  }

  /**
   * Mandatory class accessor. Throws a clear error if the class is not found.
   */
  public getClass(name: string, assemblyHint?: string): Il2Cpp.Class {
    const cls = this.findClass(name, assemblyHint);
    if (!cls) {
      throw new Error(`[ClassResolver] Mandatory class '${name}' not found in any loaded assembly.`);
    }
    return cls;
  }

  /**
   * Safely retrieves a method from a class without throwing on overloads or missing methods.
   */
  public tryMethod(
    klass: Il2Cpp.Class | null | undefined,
    methodName: string,
    paramCount?: number
  ): Il2Cpp.Method | null {
    if (!klass) return null;
    try {
      const matching = klass.methods.filter(m => m.name === methodName);
      if (matching.length === 0) return null;
      if (paramCount !== undefined) {
        return matching.find(m => m.parameters.length === paramCount) || null;
      }
      return matching[0];
    } catch (e: any) {
      Logger.log(`[ClassResolver] tryMethod error for ${klass.name}.${methodName}: ${e.message}`);
      return null;
    }
  }
}

const ClassResolver = new UniversalClassResolver();
export default ClassResolver;
export { UniversalClassResolver };
