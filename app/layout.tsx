import type { Metadata, Viewport } from "next";
import { Manrope, Fraunces } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AquaOffer — SCV Aqua Premium Instal",
  description: "Ofertare lucrări instalații: oferte, catalog, clienți, situații.",
  appleWebApp: { capable: true, title: "AquaOffer", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a1f3d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro" className={`${manrope.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
