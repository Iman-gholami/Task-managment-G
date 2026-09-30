import localFont from "next/font/local";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";
import "@/styles/components.css";
import "@/styles/data.css";
import "@/styles/screens.css";

const geist = localFont({ src: "../styles/fonts/Geist-Variable.woff2", variable: "--font-geist", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "../styles/fonts/GeistMono-Variable.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

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
const themeScript = `try{var t=localStorage.getItem("so.theme");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
