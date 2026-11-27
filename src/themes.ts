import { mix } from "./color";
import type { TabColor } from "./types";

export interface TerminalTheme {
  id: string;
  name: string;
  scheme: "dark" | "light";
  accent: string;
  background: string;
  foreground: string;
  /** The cursor, when the theme gives it a color of its own rather than the accent. */
  cursor?: string;
  /** ANSI 0–15: black, red, green, yellow, blue, magenta, cyan, white, then the bright variants. */
  ansi: [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
}

export const themes: TerminalTheme[] = [
  // The shelduck's own colors: white plumage, bottle-green head, chestnut band. Red is
  // kept for the bill: the cursor and what went wrong.
  {
    id: "shelduck",
    name: "Shelduck",
    scheme: "light",
    accent: "#9a4a22",
    background: "#f1f2ec",
    foreground: "#11231c",
    cursor: "#d4372b",
    ansi: ["#11231c", "#b92c21", "#2c6b3f", "#85620c", "#2a5d8c", "#8a3c6c", "#17706c", "#c9cdc2", "#5f6b62", "#d4372b", "#357a4a", "#9a6a10", "#346fa3", "#a5507f", "#1f7d76", "#e3e5dd"],
  },
  {
    id: "shelduck-night",
    name: "Shelduck Night",
    scheme: "dark",
    accent: "#d07a45",
    background: "#11231c",
    foreground: "#e6e8df",
    cursor: "#e2473a",
    ansi: ["#1d342b", "#ec6a5c", "#84c08f", "#d9b566", "#84add2", "#cd95b8", "#76c0b6", "#cfd4c9", "#7d8b81", "#f58b7e", "#a1d6aa", "#e9ca85", "#a3c5e4", "#e0b1cf", "#97d6cd", "#f1f2ec"],
  },
  {
    id: "campbell",
    name: "Campbell",
    scheme: "dark",
    accent: "#3b78ff",
    background: "#0c0c0c",
    foreground: "#cccccc",
    ansi: ["#0c0c0c", "#c50f1f", "#13a10e", "#c19c00", "#0037da", "#881798", "#3a96dd", "#cccccc", "#767676", "#e74856", "#16c60c", "#f9f1a5", "#3b78ff", "#b4009e", "#61d6d6", "#f2f2f2"],
  },
  {
    id: "one-half-dark",
    name: "One Half Dark",
    scheme: "dark",
    accent: "#61afef",
    background: "#282c34",
    foreground: "#dcdfe4",
    ansi: ["#282c34", "#e06c75", "#98c379", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#dcdfe4", "#5a6374", "#e06c75", "#98c379", "#e5c07b", "#61afef", "#c678dd", "#56b6c2", "#dcdfe4"],
  },
  {
    id: "one-half-light",
    name: "One Half Light",
    scheme: "light",
    accent: "#0184bc",
    background: "#fafafa",
    foreground: "#383a42",
    ansi: ["#383a42", "#e45649", "#50a14f", "#c18401", "#0184bc", "#a626a4", "#0997b3", "#d4d4d6", "#4f525d", "#df6c75", "#5bab5a", "#d19a1e", "#2196d3", "#b13cae", "#22a6c0", "#ffffff"],
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    scheme: "dark",
    accent: "#7aa2f7",
    background: "#1a1b26",
    foreground: "#c0caf5",
    ansi: ["#15161e", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#a9b1d6", "#414868", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#c0caf5"],
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    scheme: "dark",
    accent: "#cba6f7",
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    ansi: ["#45475a", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#bac2de", "#585b70", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#a6adc8"],
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    scheme: "dark",
    accent: "#fabd2f",
    background: "#282828",
    foreground: "#ebdbb2",
    ansi: ["#282828", "#cc241d", "#98971a", "#d79921", "#458588", "#b16286", "#689d6a", "#a89984", "#928374", "#fb4934", "#b8bb26", "#fabd2f", "#83a598", "#d3869b", "#8ec07c", "#ebdbb2"],
  },
  {
    id: "dracula",
    name: "Dracula",
    scheme: "dark",
    accent: "#bd93f9",
    background: "#282a36",
    foreground: "#f8f8f2",
    ansi: ["#21222c", "#ff5555", "#50fa7b", "#f1fa8c", "#bd93f9", "#ff79c6", "#8be9fd", "#f8f8f2", "#6272a4", "#ff6e6e", "#69ff94", "#ffffa5", "#d6acff", "#ff92df", "#a4ffff", "#ffffff"],
  },
  // Every color at 7:1 or more against the background (WCAG AAA), for low vision and
  // for Windows' contrast themes.
  {
    id: "high-contrast-dark",
    name: "High Contrast Dark",
    scheme: "dark",
    accent: "#ffd60a",
    background: "#000000",
    foreground: "#ffffff",
    ansi: ["#000000", "#ff7070", "#4cff4c", "#ffff3c", "#7cb8ff", "#ff7cff", "#3cffff", "#ffffff", "#b8b8b8", "#ff9a9a", "#8aff8a", "#ffff8a", "#a8d0ff", "#ffa8ff", "#8affff", "#ffffff"],
  },
  {
    id: "high-contrast-light",
    name: "High Contrast Light",
    scheme: "light",
    accent: "#0033cc",
    background: "#ffffff",
    foreground: "#000000",
    ansi: ["#000000", "#a30000", "#005c00", "#5c4a00", "#0000b8", "#850085", "#00545e", "#ffffff", "#3d3d3d", "#8c0000", "#004d00", "#4d3d00", "#00009e", "#700070", "#00454d", "#ffffff"],
  },
];

/** Older releases stored these theme ids; map them to their closest replacement. */
const legacyThemeIds: Record<string, string> = {
  carbon: "shelduck-night",
  boreal: "shelduck-night",
  ember: "shelduck-night",
  tide: "shelduck-night",
  paper: "shelduck",
  nebula: "shelduck-night",
  "nebula-light": "shelduck",
};

/** The accents of the two themes Shelduck's replaced, as they were stored when left alone. */
export const formerDefaultAccents: Record<string, string> = { nebula: "#e8a33d", "nebula-light": "#b86e0e" };

/** A theme id that exists, among the built-in themes and the imported ones. */
export function normalizeThemeId(id: unknown, custom: readonly TerminalTheme[] = []): string | undefined {
  if (typeof id !== "string") return undefined;
  if (themes.some((theme) => theme.id === id) || custom.some((theme) => theme.id === id)) return id;
  return legacyThemeIds[id];
}

export function resolveTheme(id: string, custom: readonly TerminalTheme[] = []): TerminalTheme {
  return themes.find((theme) => theme.id === id) ?? custom.find((theme) => theme.id === id) ?? themes[0]!;
}

export function xtermTheme(theme: TerminalTheme, accent: string) {
  const [black, red, green, yellow, blue, magenta, cyan, white, brightBlack, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite] = theme.ansi;
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor ?? accent,
    cursorAccent: theme.background,
    // Mixed here, and opaque: xterm would mix it with the background it's given, which is
    // clear on a terminal the window shows through.
    selectionBackground: mix(accent, theme.background, theme.scheme === "light" ? 0.25 : 0.3),
    // The scrollbar needs no line beside it, and xterm's is white.
    overviewRulerBorder: "#00000000",
    scrollbarSliderBackground: `${theme.foreground}1f`,
    scrollbarSliderHoverBackground: `${theme.foreground}33`,
    scrollbarSliderActiveBackground: `${theme.foreground}47`,
    black, red, green, yellow, blue, magenta, cyan, white,
    brightBlack, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite,
  };
}

/** Accent colors offered as one-click swatches in Settings. */
export const accentSwatches = ["#9a4a22", "#d07a45", "#e8a33d", "#e5734a", "#e05d6f", "#c879d8", "#8b8cf0", "#4c8df6", "#2fa8c9", "#3fb27f", "#9aa3ab"];

/** Tab colors. Mid-tone on purpose: they have to read on dark and light themes alike. */
export const tabColors: Array<{ id: TabColor; name: string; value: string }> = [
  { id: "red", name: "Red", value: "#e5534b" },
  { id: "orange", name: "Orange", value: "#e5793a" },
  { id: "yellow", name: "Yellow", value: "#d4a72c" },
  { id: "green", name: "Green", value: "#3fa66b" },
  { id: "teal", name: "Teal", value: "#2a9fa6" },
  { id: "blue", name: "Blue", value: "#4c8df6" },
  { id: "purple", name: "Purple", value: "#8f74e6" },
  { id: "pink", name: "Pink", value: "#d466a5" },
];

export function tabColorValue(id: TabColor | undefined): string | undefined {
  return tabColors.find((color) => color.id === id)?.value;
}

export function isTabColor(value: unknown): value is TabColor {
  return tabColors.some((color) => color.id === value);
}
