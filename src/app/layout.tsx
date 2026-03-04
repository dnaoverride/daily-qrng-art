import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://qrngart.dnasoftwaresolutions.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "QRNG Art — umetnost iz kvantnog suma",
  description:
    "Jedinstvena slika svakog dana, generisana iz kvantno nasumičnih brojeva. Australijski nacionalni univerzitet, ANU QRNG.",
  openGraph: {
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "QRNG Art — umetnost iz kvantnog suma",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
