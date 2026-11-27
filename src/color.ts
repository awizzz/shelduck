/** `amount` of `color` over `base`, both #rrggbb. A base that isn't one leaves the color as it is. */
export function mix(color: string, base: string, amount: number): string {
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  if (!/^#[0-9a-f]{6}$/i.test(base)) return color;
  return `#${[0, 1, 2].map((index) => Math.round(channel(color, index) * amount + channel(base, index) * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
}

/** Black or white, whichever reads better on the given #rrggbb color. */
export function readableOn(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.36 ? "#141414" : "#ffffff";
}
