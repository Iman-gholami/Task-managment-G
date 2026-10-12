// Generates the colour system (OKLCH → sRGB hex) and checks it: WCAG contrast for every text, control and mark
// pair (soft tints and overlays are composited over the surface they sit on), plus a minimum perceptual distance
// between colours that must never be confused (status vs status, shift tones vs status, signal vs status).
// Run: node scripts/palette.mjs   (source of truth for the hex values in styles/tokens.css; exits 1 on any FAIL)
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex) => { const [r, g, b] = rgb(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** color-mix(in oklab, fg p%, transparent) painted over an opaque surface (browsers composite in sRGB). */
export const over = (fg, p, surface) => "#" + rgb(fg).map((v, i) => Math.round((v * p + rgb(surface)[i] * (100 - p)) / 100 * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
function oklab(hex) {
  const [r, g, b] = rgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** Perceptual distance (Euclidean OKLab). 0.05+ reads as a different colour at a glance. */
export const deltaE = (a, b) => Math.hypot(...oklab(a).map((v, i) => v - oklab(b)[i]));

// Hues: ink 250 (cool slate), signal 186 (deep teal), success 150, warning 65–75, danger 25, info 245, review 295.
// Shift tones sit between the status hues so a shift never reads as a state: morning 125 (sage), until 8pm 45 (copper), night 272 (deep indigo, a step darker than info).
// Black Gold: warm ink 80, antique gold 82; warning is orange (52) and until 8pm rose-copper (35) so neither reads as the signal.
// Midnight: navy ink 266, periwinkle 284; review is rose (345) and night cyan (200) so neither reads as the signal.
const ink = (L, C = 0.011) => oklch(L, C, 250);
const teal = (L, C) => oklch(L, C, 186);
const warm = (L, C = 0.006) => oklch(L, C, 80);
const gold = (L, C) => oklch(L, C, 82);
const navy = (L, C = 0.04) => oklch(L, C, 266);

/**
 * Four tuned themes. Surfaces step up in lightness in the dark themes (app < sheet < card < inset < raised)
 * so depth comes from layering, not shadows. The signal (`primary`) is one solid colour per theme: it fills
 * primary actions, checked controls and progress, and marks the active page, links and focus. There is no second
 * brand hue: nothing is ever drawn as a gradient between two colours.
 */
export const themes = {
  light: {
    bg: ink(0.955, 0.006), sheet: ink(0.985, 0.003), card: "#FFFFFF", inset: ink(0.97, 0.004), raised: "#FFFFFF",
    border: ink(0.915, 0.008), borderSubtle: ink(0.94, 0.006), borderStrong: ink(0.62, 0.016),
    text: ink(0.22, 0.016), text2: ink(0.43, 0.016), text3: ink(0.51, 0.016), onPrimary: "#FFFFFF",
    primary: teal(0.505, 0.092), primaryHover: teal(0.45, 0.084), link: teal(0.45, 0.084),
    success: oklch(0.48, 0.105, 150), warning: oklch(0.5, 0.105, 65), danger: oklch(0.51, 0.145, 25), info: oklch(0.5, 0.095, 245), violet: oklch(0.5, 0.09, 295),
    dangerSolid: oklch(0.51, 0.145, 25), dangerSolidHover: oklch(0.455, 0.135, 25),
    // Complexity ramp: Simple → Advanced gets darker (more ink = more effort). The light end still clears 2:1.
    viz: [teal(0.76, 0.058), teal(0.64, 0.082), teal(0.53, 0.092), teal(0.4, 0.074)], vizBar: teal(0.6, 0.085),
    // Shift Schedule tones: morning, until-8pm, night. Categorical, never status; each reads as text on a card.
    shift: [oklch(0.52, 0.09, 125), oklch(0.53, 0.1, 45), oklch(0.44, 0.1, 272)],
    toggle: "#FFFFFF", soft: 10, selected: 9, ring: 28,
  },
  dark: {
    bg: ink(0.168), sheet: ink(0.196), card: ink(0.22), inset: ink(0.244), raised: ink(0.262),
    border: ink(0.302), borderSubtle: ink(0.266), borderStrong: ink(0.545, 0.012),
    text: ink(0.94, 0.006), text2: ink(0.8, 0.01), text3: ink(0.69, 0.012),
    primary: teal(0.72, 0.094), primaryHover: teal(0.78, 0.084), link: teal(0.8, 0.08),
    success: oklch(0.75, 0.11, 150), warning: oklch(0.78, 0.112, 75), danger: oklch(0.72, 0.125, 25), info: oklch(0.74, 0.085, 245), violet: oklch(0.74, 0.08, 295),
    dangerSolid: oklch(0.53, 0.14, 25), dangerSolidHover: oklch(0.49, 0.13, 25),
    // In dark mode emphasis is lightness: Advanced is the brightest step, capped so it never reads as white.
    viz: [teal(0.45, 0.05), teal(0.57, 0.078), teal(0.68, 0.094), teal(0.83, 0.08)],
    shift: [oklch(0.79, 0.1, 125), oklch(0.76, 0.1, 45), oklch(0.69, 0.085, 272)],
    toggle: ink(0.32), soft: 13, selected: 12, ring: 32,
  },
  gold: {
    bg: warm(0.155, 0.004), sheet: warm(0.185, 0.005), card: warm(0.212, 0.006), inset: warm(0.238, 0.007), raised: warm(0.255, 0.008),
    border: warm(0.305, 0.009), borderSubtle: warm(0.268, 0.008), borderStrong: warm(0.55, 0.013),
    text: oklch(0.95, 0.01, 88), text2: oklch(0.82, 0.012, 86), text3: oklch(0.7, 0.014, 84),
    primary: gold(0.8, 0.12), primaryHover: gold(0.85, 0.11), link: gold(0.84, 0.1),
    success: oklch(0.76, 0.115, 150), warning: oklch(0.75, 0.125, 52), danger: oklch(0.7, 0.14, 25), info: oklch(0.76, 0.085, 240), violet: oklch(0.75, 0.09, 300),
    dangerSolid: oklch(0.53, 0.14, 25), dangerSolidHover: oklch(0.49, 0.13, 25),
    viz: [gold(0.47, 0.07), gold(0.58, 0.092), gold(0.69, 0.11), gold(0.84, 0.105)],
    shift: [oklch(0.79, 0.1, 125), oklch(0.77, 0.085, 35), oklch(0.69, 0.085, 272)],
    toggle: warm(0.325, 0.009), soft: 13, selected: 12, ring: 32,
  },
  midnight: {
    bg: navy(0.168, 0.034), sheet: navy(0.196, 0.037), card: navy(0.223), inset: navy(0.248, 0.042), raised: navy(0.266, 0.044),
    border: navy(0.314, 0.042), borderSubtle: navy(0.275), borderStrong: navy(0.56),
    text: navy(0.95, 0.01), text2: navy(0.82, 0.024), text3: navy(0.71, 0.032),
    primary: oklch(0.74, 0.11, 284), primaryHover: oklch(0.79, 0.096, 284), link: oklch(0.81, 0.088, 284),
    success: oklch(0.77, 0.11, 158), warning: oklch(0.8, 0.11, 75), danger: oklch(0.72, 0.125, 22), info: oklch(0.77, 0.09, 232), violet: oklch(0.76, 0.105, 345),
    dangerSolid: oklch(0.53, 0.14, 25), dangerSolidHover: oklch(0.49, 0.13, 25),
    viz: [oklch(0.47, 0.075, 284), oklch(0.58, 0.098, 284), oklch(0.7, 0.11, 284), oklch(0.85, 0.075, 284)],
    shift: [oklch(0.79, 0.1, 125), oklch(0.76, 0.1, 45), oklch(0.79, 0.08, 200)],
    toggle: navy(0.335, 0.046), soft: 13, selected: 12, ring: 32,
  },
};

if (process.argv[1]?.endsWith("palette.mjs")) {
  let failures = 0;
  for (const [name, t] of Object.entries(themes)) {
    console.log(`\n${name.toUpperCase()}`);
    for (const [k, v] of Object.entries(t)) if (typeof v !== "number") console.log(`  ${k.padEnd(17)} ${Array.isArray(v) ? v.join(" ") : v}`);
    const onPrimary = t.onPrimary ?? t.bg;
    const hoverOn = (s) => over(t.text, name === "light" ? 4.5 : 5, s);
    const vizBar = t.vizBar ?? t.viz[1];
    // [foreground, background, minimum]: 4.5 for text, 3 for controls and data marks, 2 for the light end of an ordinal ramp.
    const pairs = {
      "text on sheet": [t.text, t.sheet, 4.5], "text on card": [t.text, t.card, 4.5],
      "text-2 on card": [t.text2, t.card, 4.5], "text-2 on inset": [t.text2, t.inset, 4.5], "text-2 on raised": [t.text2, t.raised, 4.5],
      "text-3 on card": [t.text3, t.card, 4.5], "text-3 on bg": [t.text3, t.bg, 4.5], "text-3 on inset": [t.text3, t.inset, 4.5], "text-3 on raised": [t.text3, t.raised, 4.5],
      "text-3 on hover (sidebar)": [t.text3, hoverOn(t.bg), 4.5], "text-3 on hover (card)": [t.text3, hoverOn(t.card), 4.5],
      "text-2 on selected row": [t.text2, over(t.primary, t.selected, t.card), 4.5],
      "label on primary": [onPrimary, t.primary, 4.5], "label on primary-hover": [onPrimary, t.primaryHover, 4.5],
      "link on card": [t.link, t.card, 4.5], "link on sheet": [t.link, t.sheet, 4.5],
      "active nav count": [t.link, over(t.primary, t.soft + (name === "light" ? 0 : 1), over(t.text, name === "light" ? 6.5 : 8, t.bg)), 4.5],
      "label on danger-solid": ["#FFFFFF", t.dangerSolid, 4.5], "label on danger hover": ["#FFFFFF", t.dangerSolidHover, 4.5],
      "primary vs card (3:1)": [t.primary, t.card, 3], "focus vs sheet (3:1)": [t.primary, t.sheet, 3],
      "input border (3:1)": [t.borderStrong, t.card, 3], "input border on inset (3:1)": [t.borderStrong, t.inset, 3],
      "bar vs card (3:1)": [vizBar, t.card, 3], "latest bar vs card (3:1)": [t.primary, t.card, 3],
      "ramp light end (2:1)": [name === "light" ? t.viz[0] : t.viz[0], t.card, 2],
    };
    for (const k of ["success", "warning", "danger", "info", "violet"]) {
      pairs[`${k} on card`] = [t[k], t.card, 4.5];
      pairs[`${k} on its tint`] = [t[k], over(t[k], t.soft, t.card), 4.5];
    }
    pairs["neutral badge"] = [t.text2, over(t.text3, t.soft, t.card), 4.5];
    t.shift.forEach((s, i) => {
      const n = ["morning", "until 8pm", "night"][i];
      pairs[`shift ${n} on card`] = [s, t.card, 4.5];
      pairs[`shift ${n} chip`] = [s, over(s, 12, t.card), 4.5];
    });
    for (const [k, [fg, bg, min]] of Object.entries(pairs)) {
      const c = contrast(fg, bg), bad = c < min;
      failures += bad;
      console.log(`  ${k.padEnd(28)} ${fg} on ${bg}  ${c.toFixed(2)}${bad ? `  FAIL (< ${min})` : ""}`);
    }
    // Colours that carry different meanings must not be confused at a glance.
    const S = { success: t.success, warning: t.warning, danger: t.danger, info: t.info, review: t.violet };
    const apart = [["primary", t.primary, S], ["morning", t.shift[0], S], ["until 8pm", t.shift[1], S], ["night", t.shift[2], S]];
    const keys = Object.keys(S);
    keys.forEach((a, i) => keys.slice(i + 1).forEach((b) => apart.push([a, S[a], { [b]: S[b] }])));
    for (const [a, hex, others] of apart) for (const [b, v] of Object.entries(others)) {
      const d = deltaE(hex, v), bad = d < 0.045;
      failures += bad;
      if (bad || process.argv.includes("--all")) console.log(`  ${`${a} vs ${b}`.padEnd(28)} ΔE ${d.toFixed(3)}${bad ? "  FAIL (< 0.045)" : ""}`);
    }
  }
  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks pass.");
  process.exitCode = failures ? 1 : 0;
}
