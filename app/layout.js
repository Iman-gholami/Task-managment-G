import localFont from "next/font/local";
import ThemeBootstrap from "@/components/ThemeBootstrap";
import { Vazirmatn } from "next/font/google";
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
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
  adjustFontFallback: false,
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
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"} className={`${geist.variable} ${geistMono.variable} ${vazirmatn.variable}`} suppressHydrationWarning>
      <body>
        <ThemeBootstrap />
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
