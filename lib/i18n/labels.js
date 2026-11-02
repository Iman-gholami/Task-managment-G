import { IRAN_PROVINCES, ROLE_LABELS } from "../roles.js";

// Province values remain canonical Persian names in the database and API.
// These labels affect presentation only, and never change arbitrary user text.
const PROVINCES_EN = [
  "East Azerbaijan", "West Azerbaijan", "Ardabil", "Isfahan", "Alborz",
  "Ilam", "Bushehr", "Tehran", "Chaharmahal and Bakhtiari", "South Khorasan",
  "Razavi Khorasan", "North Khorasan", "Khuzestan", "Zanjan", "Semnan",
  "Sistan and Baluchestan", "Fars", "Qazvin", "Qom", "Kurdistan",
  "Kerman", "Kermanshah", "Kohgiluyeh and Boyer-Ahmad", "Golestan", "Gilan",
  "Lorestan", "Mazandaran", "Markazi", "Hormozgan", "Hamadan", "Yazd",
];
const PROVINCE_EN = Object.fromEntries(IRAN_PROVINCES.map((name, index) => [name, PROVINCES_EN[index]]));
const ROLE_FA = { analyst: "کارشناس", engineer: "مهندس", soc_manager: "مدیر SOC", security_manager: "مدیر امنیت", observer: "ناظر" };
const ROLE_EN = { ...ROLE_LABELS, observer: "Observer" };
const TEAM_FA = { "Design & Automation": "طراحی و اتوماسیون", "Threat Intelligence": "هوش تهدید", "Security Department": "واحد امنیت" };

export function provinceLabel(value, locale) {
  return locale === "en" ? (PROVINCE_EN[value] ?? value) : value;
}

export function roleLabel(value, locale) {
  return (locale === "fa" ? ROLE_FA : ROLE_EN)[value] ?? value;
}

export function teamLabel(value, locale) {
  return locale === "fa" ? (TEAM_FA[value] ?? value) : value;
}
