// Generates the colour palette (OKLCH → sRGB hex) and checks WCAG contrast for every text/background pair.
// Run: node scripts/palette.mjs   (source of truth for the hex values in styles/tokens.css)
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(v))) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const STEPS = { 50: 0.985, 100: 0.963, 200: 0.925, 300: 0.868, 400: 0.735, 500: 0.62, 600: 0.52, 700: 0.44, 800: 0.345, 900: 0.265, 950: 0.205, 975: 0.17 };
// Chroma tapers at the extremes so light and dark steps never look neon.
const scale = (h, cMax, taper = true) => Object.fromEntries(Object.entries(STEPS).map(([k, L]) => [k, oklch(L, taper ? cMax * Math.min(1, 0.12 + 2.2 * Math.min(L, 1 - L)) : cMax, h)]));

export const palette = {
  neutral: scale(250, 0.016), // "Ink": cool, faintly blue-slate
  accent: scale(185, 0.115),          // "Signal": deep teal
  success: scale(150, 0.11),
  warning: scale(75, 0.12),
  danger: scale(25, 0.14),
  info: scale(245, 0.1),
  review: scale(295, 0.1),
};

if (process.argv[1].endsWith("palette.mjs")) {
  for (const [name, s] of Object.entries(palette)) console.log(name.padEnd(8), Object.entries(s).map(([k, v]) => `${k}:${v}`).join(" "));
  const n = palette.neutral, a = palette.accent;
  const pairs = {
    "light text-1 on bg": [n[950], "#FFFFFF"], "light text-2 on bg": [n[700], "#FFFFFF"], "light text-3 on surface-2": [n[600], n[50]],
    "light on accent btn": ["#FFFFFF", a[600]], "light accent link": [a[700], "#FFFFFF"], "light border-strong (UI 3:1)": [n[500], "#FFFFFF"], "light text-3 on bg": [n[600], "#FFFFFF"],
    "light danger text": [palette.danger[600], "#FFFFFF"], "light warning text": [palette.warning[700], "#FFFFFF"], "light success text": [palette.success[700], "#FFFFFF"], "light info text": [palette.info[600], "#FFFFFF"], "light review text": [palette.review[600], "#FFFFFF"],
    "dark text-1 on bg": [n[50], n[975]], "dark text-2 on surface": [n[300], n[950]], "dark text-3 on surface": [n[400], n[950]],
    "dark on accent btn": [n[975], a[400]], "dark accent link": [a[300], n[950]], "dark border-strong (UI 3:1)": [n[600], n[950]],
    "dark danger": [palette.danger[400], n[950]], "dark warning": [palette.warning[400], n[950]], "dark success": [palette.success[400], n[950]], "dark info": [palette.info[400], n[950]], "dark review": [palette.review[400], n[950]],
  };
  for (const [k, [fg, bg]] of Object.entries(pairs)) console.log(k.padEnd(32), fg, "on", bg, contrast(fg, bg).toFixed(2));
}
