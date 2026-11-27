import { expect, it } from "vitest";
import addon from "../node_modules/@xterm/addon-webgl/lib/addon-webgl.mjs?raw";

// webgl.ts reaches into the renderer by these names. Should an update rename one, text on a
// see-through terminal would get its black boxes back without a word.
it("still finds what it corrects in the WebGL renderer", () => {
  expect(addon).toContain("this._renderer=");
  expect(addon).toContain("this._rectangleRenderer.value=");
  expect(addon).toContain('this._gl=this._canvas.getContext("webgl2"');
  expect(addon).toMatch(/this\._updateRectangle\((\w+,){6}\w+\)/);
});
