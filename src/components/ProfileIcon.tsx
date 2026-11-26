import { readableOn } from "../color";
import type { ProfileKind } from "../types";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// The app icon's bird as drawn for 16 pixels (assets/icon-small.svg).
const SHELDUCK_BAND = "M 3.63 14.38 C 3.41 14.41 3.28 14.44 3.13 14.59 C 3.03 14.66 2.81 14.81 2.66 14.91 C 2.41 15.09 1.5 15.94 1.53 16 C 1.53 16 2.81 16 4.34 16 L 7.13 16 6.94 15.81 C 6.72 15.59 6.41 15.38 6.09 15.25 C 5.94 15.19 5.66 15.03 5.47 14.91 C 5.19 14.75 5.06 14.69 4.84 14.63 C 4.69 14.56 4.44 14.5 4.31 14.44 C 4.06 14.34 3.91 14.31 3.63 14.38";
const SHELDUCK_BILL = "M 10.31 4.63 C 10.09 4.72 10 4.88 10 5.28 C 10 5.88 9.84 6.13 9.31 6.44 C 8.91 6.69 8.84 6.81 9 7 C 9.06 7.09 9.19 7.13 9.94 7.38 C 11.38 7.84 11.81 7.91 12.84 7.78 C 13.09 7.75 13.44 7.72 13.56 7.72 C 14.03 7.72 14.22 7.56 14.09 7.28 C 14 7.13 13.84 7.09 13.06 6.97 C 12.44 6.84 11.78 6.59 11.34 6.25 C 10.91 5.94 10.84 5.78 11 5.47 C 11.16 5.19 11.09 4.88 10.84 4.69 C 10.69 4.59 10.44 4.56 10.31 4.63";
const SHELDUCK_HEAD = "M 5.94 2.06 C 5.5 2.13 4.38 2.53 4 2.78 C 3.72 2.97 2.78 3.84 2.59 4.09 C 2.5 4.19 2.41 4.38 2.34 4.53 C 2.28 4.66 2.19 4.84 2.13 4.97 C 2.09 5.09 2.03 5.28 2 5.38 C 1.97 5.5 1.91 5.72 1.84 5.88 C 1.63 6.34 1.63 6.44 1.59 7.09 C 1.56 8.34 1.56 8.28 1.72 8.59 C 1.81 8.78 1.88 9.03 2 9.53 C 2.19 10.19 2.34 10.56 2.56 10.91 C 2.63 10.97 2.72 11.16 2.78 11.31 C 2.88 11.5 3 11.72 3.06 11.84 C 3.41 12.34 3.59 13.53 3.41 14 C 3.31 14.25 2.63 14.88 2.13 15.16 C 1.75 15.34 1.13 15.88 1.13 15.97 C 1.13 16 1.22 16 1.34 16 C 1.56 16 1.56 16 1.84 15.72 C 2 15.56 2.16 15.38 2.25 15.28 C 2.31 15.19 2.41 15.06 2.47 15.03 C 2.84 14.81 3 14.66 3.38 14.31 C 3.69 14 3.81 13.88 3.94 13.63 C 4.16 13.28 4.25 13.16 4.5 13.03 C 4.63 13 4.78 12.88 4.94 12.75 C 5.13 12.56 5.31 12.41 5.81 12.13 C 5.94 12.06 6.16 11.94 6.31 11.84 C 7.28 11.25 7.97 11.22 8.53 11.72 C 8.84 12.03 8.81 11.94 8.41 11.41 C 8.28 11.25 7.91 10.88 7.56 10.56 C 6.56 9.56 6.34 9.19 6.38 8.44 C 6.44 7.56 6.94 7.22 8.31 7.19 C 9.06 7.16 9.06 7.16 9 7.03 C 8.91 6.78 8.97 6.69 9.38 6.47 C 9.88 6.16 10 5.97 10.03 5.38 C 10.06 4.88 10.06 4.81 10.41 4.59 C 10.47 4.53 10.47 4.53 10.38 4.41 C 10.31 4.31 10.19 4.13 10.13 3.97 C 9.78 3.22 8.91 2.53 8.13 2.34 C 7.53 2.19 6.34 2 6.16 2.03 C 6.13 2.03 6.03 2.06 5.94 2.06 M 7.78 3.56 C 7.59 3.66 7.47 3.88 7.53 4.13 C 7.66 4.72 8.59 4.59 8.53 3.97 C 8.5 3.59 8.09 3.38 7.78 3.56 M 11 5.5 C 10.84 5.66 10.84 5.78 10.94 5.91 C 11.06 6 11.09 6 11.13 5.69 C 11.13 5.34 11.13 5.34 11 5.5 M 14.13 7.38 C 14.13 7.47 14.09 7.56 14.09 7.59 C 14.03 7.69 14.03 7.72 14.09 7.72 C 14.25 7.72 14.34 7.41 14.22 7.31 C 14.13 7.22 14.13 7.25 14.13 7.38";

/**
 * Small monochrome-friendly glyphs that identify a shell in tabs and menus. Custom
 * profiles are drawn in their own accent color.
 */
export default function ProfileIcon({ kind, accent, size = 16 }: { kind: ProfileKind; accent?: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, className: "profile-icon" } as const;

  if (kind === "custom") {
    const fill = accent && HEX_COLOR.test(accent) ? accent : "#9aa3ab";
    const ink = readableOn(fill);
    return (
      <svg {...common}>
        <rect x="1" y="2" width="14" height="12" rx="2.4" fill={fill} />
        <path d="m4.2 6 2.4 2-2.4 2" fill="none" stroke={ink} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.2 10.4h3.6" stroke={ink} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "ssh") {
    return (
      <svg {...common}>
        <rect x="0.5" y="0.5" width="15" height="15" rx="3.5" fill="#2b6b62" />
        <g fill="none" stroke="#eef6f4" strokeWidth="1.05">
          <circle cx="8" cy="8" r="4.7" />
          <ellipse cx="8" cy="8" rx="2" ry="4.7" />
          <path d="M3.3 8h9.4" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (kind === "nebula") {
    return (
      <svg {...common}>
        <clipPath id="profile-icon-tile"><rect width="16" height="16" rx="3" /></clipPath>
        <rect width="16" height="16" rx="3" fill="#f1f2ec" />
        <g clipPath="url(#profile-icon-tile)">
          <path fill="#9a4a22" d={SHELDUCK_BAND} />
          <path fill="#d4372b" d={SHELDUCK_BILL} />
          <path fill="#11231c" fillRule="evenodd" d={SHELDUCK_HEAD} />
        </g>
      </svg>
    );
  }

  if (kind === "pwsh" || kind === "powershell") {
    const fill = kind === "pwsh" ? "#2f6fdc" : "#245aa8";
    return (
      <svg {...common}>
        <path d="M3.2 2.5h10.6a.9.9 0 0 1 .87 1.12l-2.1 8.76a1.4 1.4 0 0 1-1.36 1.07H.6a.9.9 0 0 1-.87-1.12l2.1-8.76A1.4 1.4 0 0 1 3.2 2.5Z" fill={fill} transform="translate(.6 0)" />
        <path d="m5 5.6 3 2.2-3.9 2.5" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.4 10.6h3" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "cmd") {
    return (
      <svg {...common}>
        <rect x="1" y="2" width="14" height="12" rx="2" fill="#2b2d31" stroke="#5c6068" strokeWidth=".8" />
        <path d="m4 6 2.4 2L4 10" fill="none" stroke="#e6e6e6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 10.5h4" stroke="#e6e6e6" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "bash") {
    return (
      <svg {...common}>
        <rect x="1" y="2" width="14" height="12" rx="2.4" fill="#2f6b26" />
        <path d="m4 6 2.4 2L4 10" fill="none" stroke="#e9f6e4" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 10.5h4" stroke="#e9f6e4" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "zsh") {
    // A percent sign, zsh's own prompt.
    return (
      <svg {...common}>
        <rect x="1" y="1" width="14" height="14" rx="3" fill="#6b3f86" />
        <path d="M5 11 11 5" stroke="#f4eaf9" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="5.4" cy="5.4" r="1.25" fill="#f4eaf9" />
        <circle cx="10.6" cy="10.6" r="1.25" fill="#f4eaf9" />
      </svg>
    );
  }

  if (kind === "fish") {
    return (
      <svg {...common}>
        <rect x="1" y="1" width="14" height="14" rx="3" fill="#256f7f" />
        <path d="M3.4 8c1.6-2.3 4.6-3.1 7-1.6L13 4.8v6.4l-2.6-1.6c-2.4 1.5-5.4.7-7-1.6Z" fill="#e6f6f9" />
        <circle cx="5.6" cy="7.7" r=".6" fill="#256f7f" />
      </svg>
    );
  }

  if (kind === "gitbash") {
    return (
      <svg {...common}>
        <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="2.2" transform="rotate(45 8 8)" fill="#e5734a" />
        <circle cx="6.2" cy="6.2" r="1.15" fill="#fff" />
        <circle cx="9.8" cy="9.8" r="1.15" fill="#fff" />
        <circle cx="6.2" cy="10.4" r="1.15" fill="#fff" />
        <path d="M6.2 6.2v4.2M6.2 6.2l3.6 3.6" stroke="#fff" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="6.6" fill="#e0a040" />
      <path d="M5 6.2 7 8l-2 1.8" fill="none" stroke="#2a1d08" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 10.2h2.8" stroke="#2a1d08" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
