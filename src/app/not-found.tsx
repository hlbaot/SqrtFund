import Link from "next/link";
import { ArrowLeft, Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <section className="flex min-h-[calc(100vh-12rem)] items-center">
      <div className="grid w-full gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-6">
          <div className="mono-label inline-flex border border-primary/40 bg-primary/10 px-3 py-1 text-primary">
            404 / Route not found
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-bold leading-tight text-foreground sm:text-5xl">
              This funding route does not exist.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted sm:text-base">
              The page may have moved, or the round/project address in the URL is no longer available.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="ui-button mono-label gradient-border inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-foreground"
              data-variant="primary"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link
              href="/my"
              className="ui-button mono-label inline-flex min-h-10 items-center justify-center gap-2 border border-line-strong bg-surface px-4 py-2 text-foreground"
              data-variant="secondary"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </div>

        <div className="hud-frame overflow-hidden p-6 sm:p-8">
          <div className="border-b border-line pb-4">
            <div className="mono-label flex items-center justify-between text-muted">
              <span>sqrt-fund scan</span>
              <span>Fuji</span>
            </div>
          </div>
          <div className="grid gap-4 py-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
                <SearchX className="h-7 w-7" />
              </div>
              <div>
                <p className="mono-label text-primary">No matching page</p>
                <p className="mt-1 text-sm text-muted">Check the route or return to the funding dashboard.</p>
              </div>
            </div>
            <div className="grid gap-2 text-xs text-muted">
              <div className="flex justify-between border border-line bg-surface px-3 py-2">
                <span className="mono-label">status</span>
                <span className="text-primary">404</span>
              </div>
              <div className="flex justify-between border border-line bg-surface px-3 py-2">
                <span className="mono-label">network</span>
                <span className="text-money">Avalanche Fuji</span>
              </div>
              <div className="flex justify-between border border-line bg-surface px-3 py-2">
                <span className="mono-label">action</span>
                <span>Return safely</span>
              </div>
            </div>
          </div>
          <div className="h-2 border border-line bg-surface">
            <div className="h-full w-1/3 bg-primary" />
          </div>
        </div>
      </div>
    </section>
  );
}
