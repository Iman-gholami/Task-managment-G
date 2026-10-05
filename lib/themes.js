// The app's colour themes. Token values live in styles/tokens.css (one block per id);
// the swatches here only draw the previews in the theme menu and on the Account page.
export const THEMES = [
  {
    id: "light",
    name: "Daylight",
    note: "Light, teal accent",
    scheme: "light",
    swatch: { bg: "#EDF0F4", surface: "#FFFFFF", line: "#DFE3E8", text: "#151B22", primary: "#007B70", accent: "#006E8E" },
  },
  {
    id: "dark",
    name: "Graphite",
    note: "Dark slate, teal accent",
    scheme: "dark",
    swatch: { bg: "#080D11", surface: "#14191E", line: "#272C31", text: "#E8EBEF", primary: "#4EB9AD", accent: "#54BBD2" },
  },
  {
    id: "gold",
    name: "Black Gold",
    note: "Deep black, gold accent",
    scheme: "dark",
    swatch: { bg: "#090807", surface: "#171513", line: "#2F2C27", text: "#F2F0E7", primary: "#FBC629", accent: "#EBA002" },
  },
  {
    id: "midnight",
    name: "Midnight",
    note: "Navy, violet and azure",
    scheme: "dark",
    swatch: { bg: "#0A0B1E", surface: "#16182F", line: "#2A2E49", text: "#EEF0F8", primary: "#A491FE", accent: "#5CABF2" },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const THEME_KEY = "so.theme";
export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const isTheme = (id) => THEME_IDS.includes(id);
