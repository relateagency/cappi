import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Custom Caps für Firmen | CAPPI — Made in Europa ab 50 Stück",
  description:
    "Premium Custom Caps mit deinem Logo. 3D-Stickerei, Made in Portugal, geliefert in 4 Wochen. Kostenloses 3D-Mockup.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/intl-tel-input@24.6.0/build/css/intlTelInput.css"
        />
      </head>
      <body>
        {children}
        {/* intl-tel-input muss vor app.js geladen sein (app.js nutzt window.intlTelInput) */}
        <Script
          src="https://cdn.jsdelivr.net/npm/intl-tel-input@24.6.0/build/js/intlTelInputWithUtils.min.js"
          strategy="beforeInteractive"
        />
        <Script src="/app.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
