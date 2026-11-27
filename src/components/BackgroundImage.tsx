import { useEffect, useState } from "react";
import { backgroundLayers } from "../background";
import type { TerminalTheme } from "../themes";
import type { AppearancePreferences } from "../types";
import ThemePreview from "./ThemePreview";

type Look = Pick<AppearancePreferences, "backgroundImageOpacity" | "backgroundImageBlur" | "backgroundImageFit" | "terminalOpacity">;

/** The background image, laid out, dimmed and blurred as the settings say. It fills what it's put in. */
export default function BackgroundImage({ url, look }: { url: string; look: Look }) {
  const blur = look.backgroundImageBlur;
  return (
    <div className="background-image" data-fit={look.backgroundImageFit} aria-hidden="true">
      <div
        style={{
          backgroundImage: `url("${url}")`,
          opacity: backgroundLayers(look.backgroundImageOpacity, look.terminalOpacity).image,
          // A blurred image fades at its edges, so those are pushed out of sight.
          ...(blur > 0 && { filter: `blur(${blur}px)`, inset: -2 * blur }),
        }}
      />
    </div>
  );
}

const PREVIEW = { width: 280, height: 190 };

const windowSize = () => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * The window in small, for the settings that hide it: the image laid out as it is behind
 * them, under a few lines of a session.
 */
export function BackgroundPreview({ url, look, theme }: { url: string; look: Look; theme: TerminalTheme }) {
  const [size, setSize] = useState(windowSize);
  useEffect(() => {
    const measure = () => setSize(windowSize());
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const scale = Math.min(PREVIEW.width / size.width, PREVIEW.height / size.height);
  return (
    <div className="background-preview" style={{ width: size.width * scale, height: size.height * scale }} aria-hidden="true">
      <div className="background-preview__window" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
        <BackgroundImage url={url} look={look} />
      </div>
      <ThemePreview theme={theme} background="var(--term-surface)" />
    </div>
  );
}
