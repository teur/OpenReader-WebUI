import "./globals.css";
import { Providers } from "./providers";
import { Metadata } from "next";
import Script from "next/script";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "OpenReader WebUI",
  description: 'A "bring your own TTS api" web interface for reading documents with high quality text-to-speech voices.',
  keywords: "PDF reader, text to speech, tts open ai, kokoro tts, Kokoro-82M, OpenReader, TTS PDF reader, high quality text to speech",
  authors: [{ name: "Richard Roberson" }],
  manifest: "/manifest.json",
  metadataBase: new URL("https://openreader.richardr.dev"), // Replace with your domain
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://openreader.richardr.dev",
    siteName: "OpenReader WebUI",
    title: "OpenReader WebUI",
    description: 'A "bring your own TTS api" web interface for reading documents with high quality text-to-speech voices.',
    images: [
      {
        url: "/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: "OpenReader WebUI Logo",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add your verification codes if you have them
    google: "MJXyTudn1kgQF8EtGD-tsnAWev7Iawso9hEvqeGHB3U",
  },
};

const isDev = process.env.NEXT_PUBLIC_NODE_ENV !== 'production';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <Script src="/theme.js" strategy="beforeInteractive" />
      </head>
      <body className="antialiased">
        <Providers>
          <div className="min-h-screen bg-background p-4">
            <div className="relative max-w-6xl mx-auto align-center">
              <div className="bg-base rounded-lg shadow-lg">
                {children}
              </div>
              {!isDev && <Footer />}
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
