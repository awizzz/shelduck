import React from "react";
import ReactDOM from "react-dom/client";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";
import App from "./App";
import { advance } from "./splash";

advance("interface", "Loading the interface");

// xterm caches glyphs as it draws them, so the terminal's own fonts must be ready before
// the first terminal renders: the icons, and every subset of the bundled typeface, since
// a letter drawn in a fallback font would stay that way. Never wait more than a moment.
const PLEX_SUBSETS = "a\u0101\u044f\u0463\u1ec7";
const fonts = Promise.all([
  document.fonts.load('16px "Nebula Symbols"', "\uf07b"),
  document.fonts.load('16px "IBM Plex Mono"', PLEX_SUBSETS),
  document.fonts.load('bold 16px "IBM Plex Mono"', PLEX_SUBSETS),
]).catch(() => undefined);
const timeout = new Promise((resolve) => setTimeout(resolve, 1500));

void Promise.race([fonts, timeout]).then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
