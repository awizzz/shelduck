import { describe, expect, it } from "vitest";
import { themes } from "./themes";
import gallery from "./assets/color-schemes.json";
import { galleryThemes, type GalleryEntry } from "./themeImport";
import { FEATURED_THEMES, editableCopy, featuredFirst, isChromatic, lowContrast, matchesQuery, withColor } from "./themeEdit";

const shelduck = themes[0]!;

describe("editableCopy", () => {
  it("names copies after the theme and never reuses a name or an id", () => {
    const first = editableCopy(shelduck, themes);
    expect(first).toMatchObject({ id: "custom-shelduck-custom", name: "Shelduck custom", background: shelduck.background });
    const second = editableCopy(shelduck, [...themes, first]);
    expect(second).toMatchObject({ id: "custom-shelduck-custom-2", name: "Shelduck custom 2" });
    // A copy of a copy doesn't pile up "custom custom".
    expect(editableCopy(second, [...themes, first, second]).name).toBe("Shelduck custom 3");
  });

  it("copies the colors instead of sharing them", () => {
    const copy = editableCopy(shelduck, themes);
    copy.ansi[1] = "#000000";
    expect(shelduck.ansi[1]).not.toBe("#000000");
  });
});

describe("withColor", () => {
  it("changes one color, and the scheme when the background changes side", () => {
    const dark = withColor(shelduck, "background", "#101010");
    expect(dark).toMatchObject({ background: "#101010", scheme: "dark" });
    expect(withColor(shelduck, 4, "#ABC").ansi[4]).toBe("#aabbcc");
    expect(withColor(shelduck, "accent", "not a color")).toBe(shelduck);
  });
});

describe("lowContrast", () => {
  it("flags text and colored output that are hard to read", () => {
    expect(lowContrast(shelduck)).toEqual([]);
    const muddy = withColor(withColor(shelduck, "foreground", "#cccccc"), 1, shelduck.background);
    expect(lowContrast(muddy)).toEqual(["foreground", 1]);
    // Black and white are meant to sit close to the background.
    expect(isChromatic(0)).toBe(false);
    expect(isChromatic(15)).toBe(false);
    expect(lowContrast(withColor(shelduck, 0, shelduck.background))).toEqual([]);
  });
});

describe("matchesQuery", () => {
  it("finds a theme from words of its name in any order", () => {
    const theme = { ...shelduck, name: "Tokyo Night Storm" };
    expect(matchesQuery(theme, "storm tokyo")).toBe(true);
    expect(matchesQuery(theme, "  ")).toBe(true);
    expect(matchesQuery(theme, "day")).toBe(false);
  });
});

describe("featuredFirst", () => {
  it("puts every featured scheme first, in its order, and keeps the rest", () => {
    const all = galleryThemes(gallery.schemes as GalleryEntry[], themes);
    const sorted = featuredFirst(all);
    expect(sorted.slice(0, FEATURED_THEMES.length).map((theme) => theme.name)).toEqual(FEATURED_THEMES);
    expect(sorted).toHaveLength(all.length);
  });
});
