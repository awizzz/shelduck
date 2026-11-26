/**
 * The loading screen of index.html: the bird gets its colors and the line under it runs
 * on as the app gets ready. Every step is a real point of the start, never a timer:
 *
 *   Starting (2 of 11, drawn by index.html) → interface → shells → session → ready (11)
 *
 * The screen goes as soon as the first shell has drawn its prompt.
 */

export type SplashStep = "interface" | "shells" | "session" | "ready";

const LIT: Record<SplashStep, number> = { interface: 4, shells: 6, session: 9, ready: 11 };
const FULL = 11;
/** Never keep the app behind the loading screen longer than this. */
const LONGEST = 8000;
const BOOT_KEY = "shelduck.boot.v1";

let lit = 2;
let leaving = false;
let resolveFinished: () => void = () => undefined;

/** Resolves once the loading screen is gone. */
export const finished = new Promise<void>((resolve) => {
  resolveFinished = resolve;
});

function splash(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.getElementById("splash");
}

function instant(): boolean {
  return location.hash === "#screenshot"
    || document.documentElement.dataset.animation === "off"
    || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs the line to `count` and paints the colors that come by then. */
function light(element: HTMLElement, count: number) {
  lit = Math.max(lit, count);
  element.style.setProperty("--lit", String(lit));
  element.querySelectorAll<SVGElement>(".splash__paint").forEach((layer) => {
    layer.classList.toggle("is-lit", lit >= Number(layer.dataset.from));
  });
  element.setAttribute("aria-valuenow", String(lit));
}

export function advance(step: SplashStep, label: string): void {
  const element = splash();
  if (!element || leaving) return;
  if (step === "ready") return finish();
  light(element, Math.max(lit, LIT[step]));
  element.setAttribute("aria-valuetext", label);
  const caption = element.querySelector(".splash__step");
  if (caption) caption.textContent = label;
}

/** Finishes the drawing and fades the screen out. The app behind is usable at once. */
export function finish(): void {
  if (leaving) return;
  leaving = true;
  const element = splash();
  if (!element || instant()) {
    element?.remove();
    resolveFinished();
    return;
  }
  light(element, FULL);
  element.style.pointerEvents = "none";
  // The fade overlaps the end of the line, so the screen doesn't linger once things are ready.
  window.setTimeout(() => {
    element.dataset.state = "done";
    window.setTimeout(() => {
      element.remove();
      resolveFinished();
    }, 360);
  }, 160);
}

if (typeof window !== "undefined") window.setTimeout(finish, LONGEST);

/**
 * Whether a chunk of shell output draws something: the console's own set-up sequences
 * (modes, clearing the screen) come first and say nothing about the shell being ready.
 */
export function drawsText(chunk: string): boolean {
  const text = chunk
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[@-_]/g, "");
  return /[^\s\x00-\x1f\x7f]/.test(text);
}

/** What the next launch's loading screen looks like, from the settings in use. */
export function rememberLook(look: { background: string; foreground: string; accent: string; scheme: "dark" | "light"; animation: string }): void {
  try {
    localStorage.setItem(BOOT_KEY, JSON.stringify(look));
  } catch {
    // Without storage the next loading screen uses the default colors.
  }
}
