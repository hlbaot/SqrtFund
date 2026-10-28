import type { Metadata } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { SplashIntro } from "@/components/layout/SplashIntro";
import { VISIT_INTRO_BOOTSTRAP } from "@/lib/visitIntro";
import { Footer } from "@/components/layout/Footer";
import { SiteChainLatticeBackground } from "@/components/background/DeferredLattice";
import { Suspense } from "react";
import { getRequestLocale, pageMetadata } from "@/lib/seo.server";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { AutoOnboardingTour } from "@/components/onboarding/AutoOnboardingTour";
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

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await pageMetadata("home");
  return { ...metadata, title: { default: `${metadata.title} | SqrtFund`, template: "%s | SqrtFund" } };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = await getRequestLocale();

  return (
    // The bootstrap intentionally sets the intro class before React hydrates.
    <html suppressHydrationWarning lang={initialLocale} className={`${beVietnamPro.variable} ${jetBrainsMono.variable}`}>
      <head>
        <script id="visit-intro" dangerouslySetInnerHTML={{ __html: VISIT_INTRO_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary selection:text-white">
        <SplashIntro initialLocale={initialLocale} />
        <div id="app-content" className="relative isolate flex min-h-screen flex-col">
          <Suspense fallback={null}>
            <SiteChainLatticeBackground />
          </Suspense>
          <Providers initialLocale={initialLocale}>
            <Suspense fallback={null}><NavigationProgress /></Suspense>
            <Suspense fallback={<header className="h-16 border-b border-line bg-background" />}>
              <Navbar />
            </Suspense>
            <main className="relative z-10 flex w-full flex-1 flex-col">
              {children}
            </main>
            <Footer />
            <AutoOnboardingTour />
          </Providers>
        </div>
      </body>
    </html>
  );
}
