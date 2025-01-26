import "./globals.css";
import { Providers } from "./providers";
import { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "OpenReader WebUI",
  description: "A modern web interface for reading and managing documents",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  }
};

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
            <div className="max-w-6xl mx-auto align-center">
              <div className="bg-base rounded-lg shadow-lg">
                {children}
              </div>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
