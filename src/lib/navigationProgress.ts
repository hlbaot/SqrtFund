export function isRouteNavigation(destination: URL, current: URL) {
  return destination.origin === current.origin && (destination.pathname !== current.pathname || destination.search !== current.search);
}

export function startRouteProgress(href: string) {
  window.dispatchEvent(new CustomEvent("sqrt-route-start", { detail: href }));
}
