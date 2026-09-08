export default class Translation {
  id: string;
  translations: LangStrings[] = [];
  oldDoNotTranslateForBinaryCompatibility: boolean;
  translationFlags: number;
  maxCharacters: number;
  comment: string;
  context: string;

  constructor(id: string, value: string, locale = "en") {
    this.id = id;
    this.oldDoNotTranslateForBinaryCompatibility = false;
    this.translations.push(new LangStrings(locale, value));
    this.translationFlags = 0;
  }
  build() {
    const lang = Il2Cpp.domain.assembly("SpaceApe.Lang").image;
    let root: any = null;
    try {
      root = Il2Cpp.domain
        .assembly("Assembly-CSharp")
        .image.class("Config")
        .field("Root").value as Il2Cpp.Object;
    } catch (e) {}

    let translation = lang.class("com.spaceape.sharedlang.Translation").alloc();
    try {
      if (root && !root.isNull()) {
        translation.method(".ctor", 1).invoke(root);
      } else {
        translation.method(".ctor", 0).invoke();
      }
    } catch (e) {
      try {
        translation.method(".ctor", 0).invoke();
      } catch (e2) {}
    }

    translation.field("id").value = Il2Cpp.string(this.id);
    translation.field("oldDoNotTranslateForBinaryCompatibility").value =
      this.oldDoNotTranslateForBinaryCompatibility;
    translation.field("translations").value = Il2Cpp.array(
      lang.class("com.spaceape.sharedlang.LangStrings"),
      this.translations.map((el) => el.build())
    );
    translation.field("translationFlags").value = this.translationFlags;
    translation.field("maxCharacters").value = 32;
    translation.field("comment").value = Il2Cpp.string("");
    translation.field("context").value = Il2Cpp.string("");

    return translation;
  }
}

class LangStrings {
  key: string;
  value: string;

  constructor(key: string, value: string) {
    this.key = key;
    this.value = value;
  }
  build() {
    const lang = Il2Cpp.domain.assembly("SpaceApe.Lang").image;
    let root: any = null;
    try {
      root = Il2Cpp.domain
        .assembly("Assembly-CSharp")
        .image.class("Config")
        .field("Root").value as Il2Cpp.Object;
    } catch (e) {}

    let langStrings = lang.class("com.spaceape.sharedlang.LangStrings").alloc();
    try {
      if (root && !root.isNull()) {
        langStrings.method(".ctor", 1).invoke(root);
      } else {
        langStrings.method(".ctor", 0).invoke();
      }
    } catch (e) {
      try {
        langStrings.method(".ctor", 0).invoke();
      } catch (e2) {}
    }

    langStrings.field("key").value = Il2Cpp.string(this.key);
    langStrings.field("value").value = Il2Cpp.string(this.value);

    return langStrings;
  }
}
