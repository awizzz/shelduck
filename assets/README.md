# Logo and icon

A common shelduck in profile, in four flat colors: plumage `#f1f2ec`, ink `#11231c`, chestnut `#9a4a22` and the red bill `#d4372b`.

| File | For |
| --- | --- |
| `logo.svg` | The bird alone, for light backgrounds. On a dark one, use the icon: its tile carries the white. |
| `icon.svg` | 64 px and up: the app icon, the loading screen, the About page, the website. |
| `icon-medium.svg` | 32 to 48 px: the same bust with a heavier line. |
| `icon-small.svg` | 16 to 24 px: redrawn with few points, the size of a tab. The built-in shell's tab draws the same shape in `src/components/ProfileIcon.tsx`. |

`src-tauri/icons/icon.ico` holds 16, 20 and 24 px from `icon-small.svg`, 32, 40 and 48 px from `icon-medium.svg`, and 64 and 256 px from `icon.svg`. `src-tauri/icons/icon.png` is `icon.svg` at 512 px. Render them with a browser engine (Chromium) for clean edges, then pack the PNGs into the `.ico`.

The interface is set in Alegreya Sans and the terminal in IBM Plex Mono, both in `public/fonts/` with their license. No italics anywhere.
