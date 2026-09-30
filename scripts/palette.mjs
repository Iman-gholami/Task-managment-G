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
const ink = (L, C = 0.012) => oklch(L, C, 250);
const teal = (L, C) => oklch(L, C, 185);

/**
 * Two tuned themes. Surfaces step up in lightness in dark mode (app < sheet < card < inset < raised)
 * so depth comes from layering, not shadows.
 */
export const themes = {
  light: {
    bg: ink(0.955, 0.006), sheet: ink(0.985, 0.003), card: "#FFFFFF", inset: ink(0.97, 0.004), raised: "#FFFFFF",
    border: ink(0.915, 0.008), borderSubtle: ink(0.94, 0.006), borderStrong: ink(0.62, 0.016),
    text: ink(0.22, 0.016), text2: ink(0.44, 0.016), text3: ink(0.53, 0.016),
    primary: teal(0.52, 0.1), primaryHover: teal(0.46, 0.095), link: teal(0.46, 0.095),
    success: oklch(0.48, 0.11, 150), warning: oklch(0.5, 0.11, 65), danger: oklch(0.52, 0.16, 25), info: oklch(0.5, 0.1, 245), violet: oklch(0.5, 0.1, 295),
    // Complexity ramp: Simple → Advanced gets darker (more ink = more effort).
    viz: [teal(0.8, 0.06), teal(0.67, 0.095), teal(0.54, 0.1), teal(0.4, 0.08)],
  },
  dark: {
    bg: ink(0.155), sheet: ink(0.185), card: ink(0.21), inset: ink(0.235), raised: ink(0.245),
    border: ink(0.29), borderSubtle: ink(0.255), borderStrong: ink(0.53, 0.012),
    text: ink(0.94, 0.006), text2: ink(0.8, 0.01), text3: ink(0.685, 0.012),
    primary: teal(0.72, 0.1), primaryHover: teal(0.78, 0.09), link: teal(0.8, 0.085),
    success: oklch(0.75, 0.12, 150), warning: oklch(0.78, 0.12, 75), danger: oklch(0.72, 0.13, 25), info: oklch(0.74, 0.09, 245), violet: oklch(0.74, 0.09, 295),
    // In dark mode emphasis is lightness: Advanced is the brightest step, capped so it never reads as white.
    viz: [teal(0.44, 0.055), teal(0.56, 0.085), teal(0.68, 0.1), teal(0.83, 0.085)],
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
      "label on primary": [onPrimary, t.primary], "link on card": [t.link, t.card],
      "input border (3:1)": [t.borderStrong, t.card], "primary vs card (3:1)": [t.primary, t.card],
      success: [t.success, t.card], warning: [t.warning, t.card], danger: [t.danger, t.card], info: [t.info, t.card], review: [t.violet, t.card],
      "viz simple vs card (3:1)": [t.viz[0], t.card],
    };
    for (const [k, [fg, bg]] of Object.entries(pairs)) console.log(`  ${k.padEnd(26)} ${fg} on ${bg}  ${contrast(fg, bg).toFixed(2)}`);
  }
}
