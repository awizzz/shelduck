import { describe, expect, it } from "vitest";
import { normalizeThemeId, resolveTheme, themes, xtermTheme } from "./themes";

const hex = /^#[0-9a-f]{6}$/i;

describe("themes", () => {
  it("have unique ids and complete palettes", () => {
    expect(new Set(themes.map((theme) => theme.id)).size).toBe(themes.length);
    for (const theme of themes) {
      expect(theme.ansi).toHaveLength(16);
      for (const color of [theme.accent, theme.background, theme.foreground, ...theme.ansi]) expect(color).toMatch(hex);
    }
  });

  it("falls back to the default theme", () => {
    expect(resolveTheme("missing").id).toBe("shelduck");
    expect(normalizeThemeId(42)).toBeUndefined();
  });

  it("maps the palette onto xterm's names", () => {
    const theme = resolveTheme("campbell");
    const colors = xtermTheme(theme, "#123456");
    expect(colors.red).toBe(theme.ansi[1]);
    expect(colors.brightWhite).toBe(theme.ansi[15]);
    expect(colors.cursor).toBe("#123456");
  });

  it("gives xterm an opaque selection color", () => {
    // xterm would mix a see-through one with the terminal's background, which is clear over an image.
    for (const id of ["shelduck", "shelduck-night"]) {
      const theme = resolveTheme(id);
      const { selectionBackground } = xtermTheme(theme, "#123456");
      expect(selectionBackground).toMatch(/^#[0-9a-f]{6}$/);
      expect(selectionBackground).not.toBe(theme.background);
    }
  });

  it("keeps the red cursor of the Shelduck themes whatever the accent", () => {
    for (const id of ["shelduck", "shelduck-night"]) {
      const theme = resolveTheme(id);
      expect(xtermTheme(theme, "#123456").cursor).toBe(theme.cursor);
    }
  });

  it("stays readable in the Shelduck themes", async () => {
    const { contrastRatio } = await import("./themeImport");
    for (const id of ["shelduck", "shelduck-night"]) {
      const theme = resolveTheme(id);
      // Black on a dark theme and white on a light one sit next to the background, by convention.
      const skip = theme.scheme === "dark" ? [0] : [7, 15];
      expect(contrastRatio(theme.foreground, theme.background)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(theme.accent, theme.background)).toBeGreaterThanOrEqual(4.5);
      theme.ansi.forEach((color, index) => {
        if (!skip.includes(index)) expect(contrastRatio(color, theme.background), `${id} color ${index}`).toBeGreaterThanOrEqual(4);
      });
    }
  });
});

describe("high contrast themes", () => {
  it("keep every color at 7:1 against the background", async () => {
    const { contrastRatio } = await import("./themeImport");
    for (const id of ["high-contrast-dark", "high-contrast-light"]) {
      const theme = themes.find((candidate) => candidate.id === id)!;
      // Black on a dark theme and white on a light one are the background itself, by convention.
      const skip = theme.scheme === "dark" ? [0] : [7, 15];
      expect(contrastRatio(theme.foreground, theme.background)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(theme.accent, theme.background)).toBeGreaterThanOrEqual(7);
      theme.ansi.forEach((color, index) => {
        if (!skip.includes(index)) expect(contrastRatio(color, theme.background), `${id} color ${index}`).toBeGreaterThanOrEqual(7);
      });
    }
  });
});
