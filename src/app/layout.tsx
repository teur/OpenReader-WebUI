import "./globals.css";
import { Providers } from "./providers";
import TTSPlayer from "@/components/TTSPlayer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenReader WebUI",
  description: "A modern web interface for reading and managing documents",
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
        <script src="/theme.js" />
        <style dangerouslySetInnerHTML={{ __html: `
          :root { color-scheme: light dark; }
          html.dark { color-scheme: dark; }
          html.light { color-scheme: light; }
          html { background: var(--background); }
        `}} />
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
