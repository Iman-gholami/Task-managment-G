import localFont from "next/font/local";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/locale.css";
import "@/styles/shell.css";
import "@/styles/components.css";
import "@/styles/data.css";
import "@/styles/screens.css";
import "@/styles/rtl.css";
import "@/styles/analytics.css";
import "@/styles/themes.css";
import "@/styles/motion.css";
import { I18nProvider } from "@/components/i18n";
import { dirOf } from "@/lib/i18n/config";
import { createT } from "@/lib/i18n";
import { getViewerLocale } from "@/lib/server/i18n";
import { THEME_IDS, THEME_KEY } from "@/lib/themes";

// Every font is bundled with the app (no network at build or run time). Persian uses Vazirmatn, English uses Geist,
// IDs and references use Geist Mono; each stack falls back to the other script's font for mixed text.
const geist = localFont({ src: "../styles/fonts/Geist-Variable.woff2", variable: "--font-geist", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "../styles/fonts/GeistMono-Variable.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });
const vazirmatn = localFont({ src: "../styles/fonts/Vazirmatn-Variable.woff2", variable: "--font-vazirmatn", weight: "100 900", display: "swap", adjustFontFallback: false });

export async function generateMetadata() {
  const { locale } = await getViewerLocale();
  const t = createT(locale);
  return {
    title: { default: "Sentinel Ops", template: "%s · Sentinel Ops" },
    description: t("shell.meta.description"),
    applicationName: "Sentinel Ops",
    robots: { index: false, follow: false }, // internal tool
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEF3F3" },
    { media: "(prefers-color-scheme: dark)", color: "#101617" },
  ],
};

// Applies the theme before first paint: a remembered manual choice, otherwise the OS preference.
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});document.documentElement.dataset.theme=${JSON.stringify(THEME_IDS)}.indexOf(t)>-1?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}`;

/**
 * Language, direction and density are resolved on the server (saved preference → cookie → Persian) and rendered
 * on <html>, so the first paint is already right-to-left (or left-to-right) with the right calendar and digits.
 */
export default async function RootLayout({ children }) {
  const { locale, density } = await getViewerLocale();
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-density={density}
      className={`${geist.variable} ${geistMono.variable} ${vazirmatn.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider locale={locale} density={density}>{children}</I18nProvider>
      </body>
    </html>
  );
}
