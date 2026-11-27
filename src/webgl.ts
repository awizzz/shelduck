import { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";

/** Bits of a cell's colors, as xterm packs them: the inverse flag of the text, the color mode of the background. */
const INVERSE = 0x4000000;
const COLOR_MODE = 0x3000000;

type Rectangles = { _updateRectangle(vertices: unknown, offset: number, fg: number, bg: number, startX: number, endX: number, y: number): void };
type Internals = { _renderer?: { _gl?: WebGL2RenderingContext; _rectangleRenderer?: { value?: Rectangles } } };

const corrected = new WeakSet<Rectangles>();

/**
 * Corrects two things xterm 6.0 gets wrong on a see-through terminal. Both are reached by
 * private names, which webgl.test.ts watches.
 *
 * It takes the dim, italic and overline flags of a cell for a background color, and paints the
 * theme's background behind such text, fully opaque: a black box. Rectangles that carry no
 * color are given no width instead.
 *
 * And it blends the alpha of its canvas like a color, which leaves the edges of the text, and
 * dim text, fainter than they are on an opaque terminal.
 */
function correctTransparency({ _renderer: renderer }: Internals) {
  const gl = renderer?._gl;
  gl?.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const drawn = renderer?._rectangleRenderer?.value;
  const rectangles: Rectangles | undefined = drawn && Object.getPrototypeOf(drawn);
  if (!rectangles || typeof rectangles._updateRectangle !== "function" || corrected.has(rectangles)) return;
  const update = rectangles._updateRectangle;
  rectangles._updateRectangle = function (vertices, offset, fg, bg, startX, endX, y) {
    const colorless = !(fg & INVERSE) && !(bg & COLOR_MODE);
    update.call(this, vertices, offset, fg, bg, startX, colorless ? startX : endX, y);
  };
  corrected.add(rectangles);
}

/** Draws `terminal` on the GPU from now on. The addon comes back to be disposed of. */
export function loadWebgl(terminal: Terminal): WebglAddon {
  const webgl = new WebglAddon();
  webgl.onContextLoss(() => webgl.dispose());
  terminal.loadAddon(webgl);
  correctTransparency(webgl as unknown as Internals);
  return webgl;
}
