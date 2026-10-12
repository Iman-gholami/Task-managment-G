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

// Hues: ink 208 (neutral slate), signal 180 (deep teal), success 150, warning 70, danger 25, info 245, review 295.
// Black Gold: warm ink 95, muted brass 85. Midnight: navy ink 250, restrained steel blue 230 (review remains rose).
const ink = (L, C = 0.012) => oklch(L, C, 208);
const teal = (L, C) => oklch(L, C, 180);
const warm = (L, C = 0.006) => oklch(L, C, 95);
const gold = (L, C) => oklch(L, C, 85);
const navy = (L, C = 0.04) => oklch(L, C, 250);

/**
 * Four tuned themes. Surfaces step up in lightness in the dark themes (app < sheet < card < inset < raised)
 * so depth comes from layering, not shadows. `accent` is the second stop of the signature gradient
 * (primary → accent) used on primary buttons, the brand mark and progress fills; it carries the same label colour.
 */
export const themes = {
  light: {
    bg: ink(0.96, 0.005), sheet: ink(0.985, 0.003), card: "#FFFFFF", inset: ink(0.967, 0.004), raised: "#FFFFFF",
    border: ink(0.90, 0.009), borderSubtle: ink(0.94, 0.006), borderStrong: ink(0.60, 0.016),
    text: ink(0.245, 0.017), text2: ink(0.445, 0.014), text3: ink(0.505, 0.012),
    primary: teal(0.47, 0.085), primaryHover: teal(0.425, 0.075), link: teal(0.425, 0.075), accent: teal(0.49, 0.08),
    success: oklch(0.48, 0.10, 150), warning: oklch(0.49, 0.09, 75), danger: oklch(0.52, 0.13, 27), info: oklch(0.48, 0.095, 230), violet: oklch(0.50, 0.08, 295),
    // Complexity ramp: Simple → Advanced gets darker (more ink = more effort).
    viz: [teal(0.64, 0.055), teal(0.60, 0.07), teal(0.52, 0.08), teal(0.40, 0.07)],
    // Shift Schedule tones: morning, until-8pm, night. Categorical, never status; each reads as text on a card.
    shift: [oklch(0.47, 0.08, 160), oklch(0.49, 0.095, 70), oklch(0.50, 0.07, 280)],
  },
  dark: {
    bg: ink(0.195, 0.01), sheet: ink(0.225, 0.011), card: ink(0.26, 0.011), inset: ink(0.29, 0.011), raised: ink(0.315, 0.012),
    border: ink(0.355, 0.012), borderSubtle: ink(0.31, 0.012), borderStrong: ink(0.58, 0.015),
    text: ink(0.955, 0.007), text2: ink(0.82, 0.009), text3: ink(0.715, 0.012),
    primary: teal(0.76, 0.076), primaryHover: teal(0.81, 0.07), link: teal(0.83, 0.066), accent: teal(0.73, 0.073),
    success: oklch(0.76, 0.105, 150), warning: oklch(0.79, 0.10, 80), danger: oklch(0.75, 0.115, 25), info: oklch(0.78, 0.08, 230), violet: oklch(0.76, 0.075, 295),
    // In dark mode emphasis is lightness: Advanced is the brightest step, capped so it never reads as white.
    viz: [teal(0.56, 0.045), teal(0.63, 0.06), teal(0.70, 0.07), teal(0.82, 0.055)],
    shift: [oklch(0.78, 0.09, 160), oklch(0.80, 0.10, 74), oklch(0.77, 0.08, 285)],
  },
  // Black Gold: near-black warm surfaces, one bright gold signal. Warning shifts to copper so it never reads as the brass accent.
  gold: {
    bg: warm(0.20, 0.006), sheet: warm(0.235, 0.006), card: warm(0.265, 0.008), inset: warm(0.295, 0.008), raised: warm(0.325, 0.008),
    border: warm(0.37, 0.01), borderSubtle: warm(0.325, 0.008), borderStrong: warm(0.62, 0.013),
    text: oklch(0.95, 0.012, 95), text2: oklch(0.83, 0.014, 90), text3: oklch(0.72, 0.013, 88),
    primary: gold(0.79, 0.102), primaryHover: gold(0.84, 0.09), link: gold(0.86, 0.088), accent: gold(0.75, 0.092),
    success: oklch(0.78, 0.103, 152), warning: oklch(0.77, 0.11, 53), danger: oklch(0.74, 0.12, 25), info: oklch(0.78, 0.077, 230), violet: oklch(0.77, 0.09, 304),
    viz: [gold(0.56, 0.058), gold(0.63, 0.07), gold(0.71, 0.085), gold(0.84, 0.09)],
    // The until-8pm shift is orange (like warning) so it never reads as the gold accent.
    shift: [oklch(0.79, 0.09, 160), oklch(0.78, 0.10, 55), oklch(0.77, 0.082, 290)],
  },
  // Midnight: deep navy surfaces with a restrained steel-blue signal. Review moves to rose so it stays distinct from the accent.
  midnight: {
    bg: navy(0.205, 0.03), sheet: navy(0.235, 0.03), card: navy(0.27, 0.03), inset: navy(0.30, 0.031), raised: navy(0.33, 0.032),
    border: navy(0.38, 0.032), borderSubtle: navy(0.33, 0.032), borderStrong: navy(0.61, 0.032),
    text: navy(0.955, 0.012), text2: navy(0.83, 0.02), text3: navy(0.72, 0.026),
    primary: oklch(0.75, 0.085, 230), primaryHover: oklch(0.81, 0.075, 230), link: oklch(0.85, 0.075, 230), accent: oklch(0.72, 0.082, 230),
    success: oklch(0.78, 0.10, 160), warning: oklch(0.80, 0.10, 78), danger: oklch(0.75, 0.11, 23), info: oklch(0.80, 0.073, 205), violet: oklch(0.77, 0.075, 345),
    viz: [oklch(0.56, 0.045, 230), oklch(0.63, 0.06, 230), oklch(0.70, 0.075, 230), oklch(0.83, 0.063, 230)],
    // Night is cyan here so it stays distinct from the violet accent.
    shift: [oklch(0.78, 0.085, 160), oklch(0.80, 0.09, 72), oklch(0.78, 0.07, 205)],
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
      "shift morning": [t.shift[0], t.card], "shift until 8pm": [t.shift[1], t.card], "shift night": [t.shift[2], t.card],
    };
    for (const [k, [fg, bg]] of Object.entries(pairs)) console.log(`  ${k.padEnd(26)} ${fg} on ${bg}  ${contrast(fg, bg).toFixed(2)}`);
  }
}
