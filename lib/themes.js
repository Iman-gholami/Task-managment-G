// The app's colour themes. Token values live in styles/tokens.css (one block per id);
// the swatches here only draw the previews in the theme menu and on the Account page.
export const THEMES = [
  {
    id: "light",
    name: "Daylight",
    note: "Light, teal accent",
    scheme: "light",
    swatch: { bg: "#EEF3F3", surface: "#FFFFFF", line: "#D8E0E1", text: "#172325", primary: "#016A5D", accent: "#1B6F62" },
  },
  {
    id: "dark",
    name: "Graphite",
    note: "Dark slate, teal accent",
    scheme: "dark",
    swatch: { bg: "#101617", surface: "#1E2627", line: "#353E3F", text: "#EBF1F2", primary: "#79C1B3", accent: "#72B7A9" },
  },
  {
    id: "gold",
    name: "Black Gold",
    note: "Deep black, gold accent",
    scheme: "dark",
    swatch: { bg: "#171613", surface: "#262521", line: "#41403A", text: "#F1EFE6", primary: "#D9B66B", accent: "#C9AA68" },
  },
  {
    id: "midnight",
    name: "Midnight",
    note: "Navy, violet and azure",
    scheme: "dark",
    swatch: { bg: "#0C1824", surface: "#1B2835", line: "#364453", text: "#EAF1F8", primary: "#73B8DA", accent: "#6CAFCE" },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const THEME_KEY = "so.theme";
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const isTheme = (id) => THEME_IDS.includes(id);
