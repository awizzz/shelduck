import { describe, expect, it } from "vitest";
import { backgroundLayers, isBackgroundImage } from "./background";

describe("the background image", () => {
  it("shows behind the text as much as the setting says", () => {
    for (const visibility of [0.05, 0.28, 0.6, 1]) {
      const { image, surface } = backgroundLayers(visibility, 1);
      expect(image * (1 - surface)).toBeCloseTo(visibility);
    }
  });

  it("shows more around the terminal than behind it", () => {
    const { image, surface } = backgroundLayers(0.28, 1);
    expect(image).toBeGreaterThan(0.28);
    expect(surface).toBeGreaterThan(0);
    expect(backgroundLayers(1, 1)).toEqual({ image: 1, surface: 0 });
  });

  it("gets less of the theme's background over it on a see-through terminal", () => {
    expect(backgroundLayers(0.28, 0.5).surface).toBeCloseTo(backgroundLayers(0.28, 1).surface / 2);
  });

  it("is a key of the store, or the picture older builds kept in the settings", () => {
    expect(isBackgroundImage("image:3f2b8c1e-5d4a-4b7c-9e2f-0a1b2c3d4e5f")).toBe(true);
    expect(isBackgroundImage("data:image/gif;base64,R0lGOD")).toBe(true);
    expect(isBackgroundImage(`data:image/png;base64,${"A".repeat(3_500_000)}`)).toBe(false);
    expect(isBackgroundImage("image:1")).toBe(false);
    expect(isBackgroundImage("data:text/html,<script>")).toBe(false);
    expect(isBackgroundImage(undefined)).toBe(false);
  });
});
