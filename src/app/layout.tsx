import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SplashIntro } from "@/components/layout/SplashIntro";
import { AOSInit } from "@/components/common/AOSInit";
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
    <html lang="en" className={`${beVietnamPro.variable} ${jetBrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/30 selection:text-foreground">
        <Suspense fallback={null}>
          <SplashIntro />
        </Suspense>
        <Providers>
          <Suspense fallback={null}>
            <AOSInit />
          </Suspense>
          <Suspense fallback={<header className="h-16 border-b border-line bg-background" />}>
            <Navbar />
          </Suspense>
          <main className="app-frame mx-auto flex w-full max-w-6xl flex-1 flex-col pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
