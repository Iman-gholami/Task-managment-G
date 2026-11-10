import localFont from "next/font/local";
import ThemeBootstrap from "@/components/ThemeBootstrap";
import { cookies } from "next/headers";
import I18nProvider from "@/components/I18nProvider";
import { normalizeLocale } from "@/lib/i18n/messages";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";
import "@/styles/components.css";
import "@/styles/data.css";
import "@/styles/screens.css";
import "@/styles/rtl.css";
import "@/styles/analytics.css";
import "@/styles/themes.css";
import "@/styles/motion.css";

const geist = localFont({ src: "../styles/fonts/Geist-Variable.woff2", variable: "--font-geist", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "../styles/fonts/GeistMono-Variable.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });
// Vazirmatn, Arabic-script subset only (OFL). The unicode-range lets it lead every font stack:
// Persian letters, Persian digits and the zero-width non-joiner use Vazirmatn, Latin falls through to Geist.
// Without it, Persian typed in English screens reached Geist's Arial fallback before the Persian font.
// next/font only accepts literal values here, so the range is written out in place.
const persian = localFont({
  src: "../styles/fonts/Vazirmatn-Arabic-Variable.woff2",
  weight: "100 900",
  variable: "--font-persian",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});

export const metadata = {
  title: { default: "Sentinel Ops", template: "%s · Sentinel Ops" },
  description: "Task management, SOC shift logs and workforce performance for the Security Department.",
  applicationName: "Sentinel Ops",
  robots: { index: false, follow: false }, // internal tool
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEF3F3" },
    { media: "(prefers-color-scheme: dark)", color: "#101617" },
  ],
};

export default async function RootLayout({ children }) {
  const locale = normalizeLocale((await cookies()).get("so.locale")?.value);
  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"} className={`${geist.variable} ${geistMono.variable} ${persian.variable}`} suppressHydrationWarning>
      <body>
        <ThemeBootstrap />
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
