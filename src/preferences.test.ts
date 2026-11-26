import { describe, expect, it } from "vitest";
import { defaultKeybindings, defaultPreferences, migrateLegacy, sanitizePreferences } from "./preferences";

describe("sanitizePreferences", () => {
  it("returns defaults for garbage", () => {
    expect(sanitizePreferences(null)).toEqual(defaultPreferences);
    expect(sanitizePreferences("theme")).toEqual(defaultPreferences);
  });

  it("clamps numbers and rejects invalid values", () => {
    const result = sanitizePreferences({
      fontSize: 400,
      lineHeight: -1,
      accent: "red",
      cursorStyle: "triangle",
      scrollback: 12.5,
      backgroundImage: "javascript:alert(1)",
    });
    expect(result.fontSize).toBe(32);
    expect(result.lineHeight).toBe(1);
    expect(result.accent).toBe(defaultPreferences.accent);
    expect(result.cursorStyle).toBe(defaultPreferences.cursorStyle);
    expect(result.scrollback).toBe(1_000);
    expect(result.backgroundImage).toBeUndefined();
  });

  it("maps retired theme ids", () => {
    expect(sanitizePreferences({ themeId: "paper" }).themeId).toBe("shelduck");
    expect(sanitizePreferences({ themeId: "unknown" }).themeId).toBe("shelduck");
  });

  it("moves settings left on the Nebula themes to the Shelduck ones", () => {
    const dark = sanitizePreferences({ themeId: "nebula", accent: "#E8A33D", darkThemeId: "nebula", lightThemeId: "nebula-light" });
    expect([dark.themeId, dark.accent, dark.darkThemeId, dark.lightThemeId]).toEqual(["shelduck-night", "#d07a45", "shelduck-night", "shelduck"]);
    const light = sanitizePreferences({ themeId: "nebula-light", accent: "#b86e0e" });
    expect([light.themeId, light.accent]).toEqual(["shelduck", "#9a4a22"]);
  });

  it("keeps an accent and a font picked by hand", () => {
    expect(sanitizePreferences({ themeId: "nebula", accent: "#4c8df6" }).accent).toBe("#4c8df6");
    expect(sanitizePreferences({ themeId: "dracula", accent: "#e8a33d" }).accent).toBe("#e8a33d");
    expect(sanitizePreferences({ fontFamily: "Fira Code" }).fontFamily).toBe("Fira Code");
  });

  it("swaps the former default font for the bundled one", () => {
    const former = '"Cascadia Mono", "Cascadia Code", Consolas, "JetBrains Mono", "Ubuntu Mono", "DejaVu Sans Mono", "Noto Sans Mono", "Liberation Mono", monospace';
    expect(sanitizePreferences({ fontFamily: former }).fontFamily).toBe(defaultPreferences.fontFamily);
    expect(defaultPreferences.fontFamily.startsWith('"IBM Plex Mono"')).toBe(true);
  });

  it("fills in shortcuts added after the settings were saved", () => {
    const result = sanitizePreferences({ keybindings: { newTab: "Ctrl+T" } });
    expect(result.keybindings.newTab).toBe("Ctrl+T");
    expect(result.keybindings.zoomIn).toBe(defaultKeybindings.zoomIn);
  });

  it("restores the default font when the field is emptied", () => {
    expect(sanitizePreferences({ fontFamily: "   " }).fontFamily).toBe(defaultPreferences.fontFamily);
  });
});

describe("starting folder", () => {
  it("keeps a folder typed before 1.2 and defaults to the user folder otherwise", () => {
    expect(sanitizePreferences({ workingDirectory: "D:\\work" }).startingFolder).toBe("custom");
    expect(sanitizePreferences({ workingDirectory: "  " }).startingFolder).toBe("home");
    expect(sanitizePreferences({}).startingFolder).toBe("home");
    expect(sanitizePreferences({ startingFolder: "desktop", workingDirectory: "D:\\work" }).startingFolder).toBe("desktop");
    expect(sanitizePreferences({ startingFolder: "downloads" }).startingFolder).toBe("home");
  });
});

describe("migrateLegacy", () => {
  it("moves Find off Ctrl+F and drops the Nebula Shell profile", () => {
    const result = sanitizePreferences(migrateLegacy({ defaultProfileId: "nebula", keybindings: { find: "Ctrl+F" } }));
    expect(result.keybindings.find).toBe("Ctrl+Shift+F");
    expect(result.defaultProfileId).toBe("");
  });

  it("keeps a custom Find shortcut", () => {
    const result = sanitizePreferences(migrateLegacy({ keybindings: { find: "Alt+F" } }));
    expect(result.keybindings.find).toBe("Alt+F");
  });

  it("only resets layout values that were old defaults", () => {
    expect(sanitizePreferences(migrateLegacy({ terminalOpacity: 0.96, terminalPadding: 14 }))).toMatchObject({ terminalOpacity: 1, terminalPadding: 12 });
    expect(sanitizePreferences(migrateLegacy({ terminalOpacity: 0.8, terminalPadding: 20 }))).toMatchObject({ terminalOpacity: 0.8, terminalPadding: 20 });
  });
});
