// Generates the colour system (OKLCH → sRGB hex) and checks WCAG contrast for every text/background pair.
// Run: node scripts/palette.mjs   (source of truth for the hex values in styles/tokens.css)
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Hues: ink 250 (cool slate), signal 185 (deep teal), success 150, warning 70, danger 25, info 245, review 295.
// Black Gold: warm ink 85, gold 88 → amber 75. Midnight: navy ink 278, violet 290 → azure 248 (review moves to 345).
const ink = (L, C = 0.012) => oklch(L, C, 250);
const teal = (L, C) => oklch(L, C, 185);
const warm = (L, C = 0.006) => oklch(L, C, 85);
const gold = (L, C) => oklch(L, C, 88);
const navy = (L, C = 0.04) => oklch(L, C, 278);

/**
 * Four tuned themes. Surfaces step up in lightness in the dark themes (app < sheet < card < inset < raised)
 * so depth comes from layering, not shadows. `accent` is the second stop of the signature gradient
 * (primary → accent) used on primary buttons, the brand mark and progress fills; it carries the same label colour.
 */
export const themes = {
  light: {
    bg: ink(0.955, 0.006), sheet: ink(0.985, 0.003), card: "#FFFFFF", inset: ink(0.97, 0.004), raised: "#FFFFFF",
    border: ink(0.915, 0.008), borderSubtle: ink(0.94, 0.006), borderStrong: ink(0.62, 0.016),
    text: ink(0.22, 0.016), text2: ink(0.44, 0.016), text3: ink(0.53, 0.016),
    primary: teal(0.52, 0.1), primaryHover: teal(0.46, 0.095), link: teal(0.46, 0.095), accent: oklch(0.5, 0.1, 225),
    success: oklch(0.48, 0.11, 150), warning: oklch(0.5, 0.11, 65), danger: oklch(0.52, 0.16, 25), info: oklch(0.5, 0.1, 245), violet: oklch(0.5, 0.1, 295),
    // Complexity ramp: Simple → Advanced gets darker (more ink = more effort).
    viz: [teal(0.8, 0.06), teal(0.67, 0.095), teal(0.54, 0.1), teal(0.4, 0.08)],
  },
  dark: {
    bg: ink(0.155), sheet: ink(0.185), card: ink(0.21), inset: ink(0.235), raised: ink(0.245),
    border: ink(0.29), borderSubtle: ink(0.255), borderStrong: ink(0.53, 0.012),
    text: ink(0.94, 0.006), text2: ink(0.8, 0.01), text3: ink(0.685, 0.012),
    primary: teal(0.72, 0.1), primaryHover: teal(0.78, 0.09), link: teal(0.8, 0.085), accent: oklch(0.74, 0.1, 215),
    success: oklch(0.75, 0.12, 150), warning: oklch(0.78, 0.12, 75), danger: oklch(0.72, 0.13, 25), info: oklch(0.74, 0.09, 245), violet: oklch(0.74, 0.09, 295),
    // In dark mode emphasis is lightness: Advanced is the brightest step, capped so it never reads as white.
    viz: [teal(0.44, 0.055), teal(0.56, 0.085), teal(0.68, 0.1), teal(0.83, 0.085)],
  },
  // Black Gold: near-black warm surfaces, one bright gold signal. Warning shifts to orange so it never reads as the accent.
  gold: {
    bg: warm(0.135, 0.004), sheet: warm(0.168, 0.005), card: warm(0.198, 0.006), inset: warm(0.228, 0.007), raised: warm(0.24, 0.008),
    border: warm(0.295, 0.01), borderSubtle: warm(0.255, 0.008), borderStrong: warm(0.54, 0.014),
    text: oklch(0.955, 0.012, 95), text2: oklch(0.82, 0.014, 90), text3: oklch(0.7, 0.016, 88),
    primary: gold(0.85, 0.165), primaryHover: gold(0.89, 0.15), link: gold(0.87, 0.15), accent: oklch(0.76, 0.16, 75),
    success: oklch(0.77, 0.14, 150), warning: oklch(0.76, 0.15, 52), danger: oklch(0.71, 0.17, 25), info: oklch(0.77, 0.1, 240), violet: oklch(0.76, 0.11, 300),
    viz: [gold(0.46, 0.085), gold(0.58, 0.115), gold(0.72, 0.145), gold(0.88, 0.15)],
  },
  // Midnight: deep navy surfaces with a violet → azure signal. Review moves to rose so it stays distinct from the accent.
  midnight: {
    bg: navy(0.16, 0.04), sheet: navy(0.19, 0.042), card: navy(0.22, 0.045), inset: navy(0.245, 0.047), raised: navy(0.26, 0.05),
    border: navy(0.31, 0.05), borderSubtle: navy(0.27, 0.047), borderStrong: navy(0.56, 0.05),
    text: navy(0.955, 0.012), text2: navy(0.82, 0.03), text3: navy(0.71, 0.04),
    primary: oklch(0.72, 0.155, 290), primaryHover: oklch(0.78, 0.13, 290), link: oklch(0.8, 0.12, 290), accent: oklch(0.72, 0.13, 248),
    success: oklch(0.77, 0.13, 158), warning: oklch(0.8, 0.13, 75), danger: oklch(0.72, 0.15, 22), info: oklch(0.77, 0.11, 230), violet: oklch(0.76, 0.14, 345),
    viz: [oklch(0.46, 0.1, 290), oklch(0.57, 0.135, 290), oklch(0.69, 0.15, 290), oklch(0.85, 0.1, 290)],
  },
};

if (process.argv[1]?.endsWith("palette.mjs")) {
  for (const [name, t] of Object.entries(themes)) {
    console.log(`\n${name.toUpperCase()}`);
    for (const [k, v] of Object.entries(t)) console.log(`  ${k.padEnd(14)} ${Array.isArray(v) ? v.join(" ") : v}`);
    const onPrimary = name === "light" ? "#FFFFFF" : t.bg;
    const pairs = {
      "text on sheet": [t.text, t.sheet], "text on card": [t.text, t.card],
      "text-2 on card": [t.text2, t.card], "text-2 on inset": [t.text2, t.inset],
      "text-3 on card": [t.text3, t.card], "text-3 on bg": [t.text3, t.bg], "text-3 on inset": [t.text3, t.inset],
      "label on primary": [onPrimary, t.primary], "label on accent": [onPrimary, t.accent], "link on card": [t.link, t.card],
      "input border (3:1)": [t.borderStrong, t.card], "primary vs card (3:1)": [t.primary, t.card],
      success: [t.success, t.card], warning: [t.warning, t.card], danger: [t.danger, t.card], info: [t.info, t.card], review: [t.violet, t.card],
      "viz simple vs card (3:1)": [t.viz[0], t.card],
    };
    for (const [k, [fg, bg]] of Object.entries(pairs)) console.log(`  ${k.padEnd(26)} ${fg} on ${bg}  ${contrast(fg, bg).toFixed(2)}`);
  }
}
