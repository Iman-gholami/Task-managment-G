import localFont from "next/font/local";
import AppProvider from "@/components/AppProvider";
import "@/styles/tokens.css";
import "@/styles/components.css";

const geist = localFont({ src: "../styles/fonts/Geist-Variable.woff2", variable: "--font-geist", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "../styles/fonts/GeistMono-Variable.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

export const metadata = {
  title: { default: "Sentinel Ops", template: "%s · Sentinel Ops" },
  description: "Task management, SOC shift logs and workforce performance for the Security Department.",
};

// Applies the saved theme before first paint to avoid a light/dark flash.
const themeScript = `try{var t=localStorage.getItem("so.theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
