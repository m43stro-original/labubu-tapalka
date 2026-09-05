import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Labubu Empire — Telegram Tapalka",
  description: "Легендарная тапалка с фабрикой Лабубу, валютой в рублях и PvP дуэлями",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090c10",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <link rel="preload" as="image" href="/images/1lvl.png" />
        <link rel="preload" as="image" href="/images/2lvl.png" />
        <link rel="preload" as="image" href="/images/3lvl.png" />
        <link rel="preload" as="image" href="/images/4lvl.png" />
        <link rel="preload" as="image" href="/images/5lvl.png" />
        <link rel="preload" as="image" href="/images/6lvl.png" />
        <link rel="preload" as="image" href="/images/7lvl.png" />
      </head>
      <body className="bg-[#090c10] text-[#f0f6fc] antialiased overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
