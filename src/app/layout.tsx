import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { SplashIntro } from "@/components/layout/SplashIntro";
import { VISIT_INTRO_BOOTSTRAP } from "@/lib/visitIntro";
import { Footer } from "@/components/layout/Footer";
import { Suspense } from "react";
import { Providers } from "./providers";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "√Fund | Quadratic Funding for Students",
  description:
    "Democratic quadratic funding for student clubs and decentralized university initiatives on Avalanche Fuji testnet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The bootstrap intentionally sets the intro class before React hydrates.
    <html suppressHydrationWarning lang="en" className={`${beVietnamPro.variable} ${jetBrainsMono.variable}`}>
      <head>
        <script id="visit-intro" dangerouslySetInnerHTML={{ __html: VISIT_INTRO_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary selection:text-white">
        <SplashIntro />
        <div id="app-content" className="flex min-h-screen flex-col">
          <Providers>
            <Suspense fallback={<header className="h-16 border-b border-line bg-background" />}>
              <Navbar />
            </Suspense>
            <main className="flex w-full flex-1 flex-col">
              {children}
            </main>
            <Footer />
          </Providers>
        </div>
      </body>
    </html>
  );
}
