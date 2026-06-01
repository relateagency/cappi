import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bilder werden als statische Assets via <img> ausgeliefert (kein next/image-Optimizer noetig)
  images: { unoptimized: true },
  async rewrites() {
    // Abwaertskompatibilitaet: /cappi liefert dieselbe Landing Page wie /
    return [{ source: "/cappi", destination: "/" }];
  },
};

export default nextConfig;
