import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, getLocale } from "next-intl/server";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import type { Locale } from "@/i18n/config";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function getBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL || "https://qrng-art-test.dnasoftwaresolutions.com";
  const trimmed = raw.trim().replace(/\/$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
const baseUrl = getBaseUrl();
const ogImageUrl = `${baseUrl}/api/og-image`;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    metadataBase: new URL(baseUrl),
    title: t("title"),
    description: t("description"),
    openGraph: {
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: t("ogAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [ogImageUrl],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [messages, locale] = await Promise.all([getMessages(), getLocale()]);
  return (
    <html lang={locale}>
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-RC435L0VQB"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-RC435L0VQB');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Header currentLocale={locale as Locale} />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
