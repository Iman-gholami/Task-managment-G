import localFont from "next/font/local";
import { Vazirmatn } from "next/font/google";
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
import { THEME_IDS, THEME_KEY } from "@/lib/themes";

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
    { media: "(prefers-color-scheme: light)", color: "#EDF0F4" },
    { media: "(prefers-color-scheme: dark)", color: "#080D11" },
  ],
};

// Applies the theme before first paint: a remembered manual choice, otherwise the OS preference.
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});document.documentElement.dataset.theme=${JSON.stringify(THEME_IDS)}.indexOf(t)>-1?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${vazirmatn.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
