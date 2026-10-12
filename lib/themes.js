// The app's colour themes. Token values live in styles/tokens.css (one block per id);
// the swatches here only draw the previews in the theme menu and on the Account page.
export const THEMES = [
  {
    id: "light",
    name: "Daylight",
    note: "Light, teal accent",
    scheme: "light",
    swatch: { bg: "#EDF0F4", surface: "#FFFFFF", line: "#DFE3E8", text: "#151B22", primary: "#00756C" },
  },
  {
    id: "dark",
    name: "Graphite",
    note: "Dark slate, teal accent",
    scheme: "dark",
    swatch: { bg: "#0B0F14", surface: "#171B20", line: "#2A2F34", text: "#E8EBEF", primary: "#55B8AD" },
  },
  {
    id: "gold",
    name: "Black Gold",
    note: "Deep black, gold accent",
    scheme: "dark",
    swatch: { bg: "#0D0C0A", surface: "#1A1816", line: "#312F2A", text: "#F1EEE7", primary: "#E4B65C" },
  },
  {
    id: "midnight",
    name: "Midnight",
    note: "Navy, violet and azure",
    scheme: "dark",
    swatch: { bg: "#080E1E", surface: "#121B2E", line: "#273147", text: "#EBEEF5", primary: "#A2A1EE" },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const THEME_KEY = "so.theme";
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const isTheme = (id) => THEME_IDS.includes(id);
