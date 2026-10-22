export function matchesNavRoute(pathname: string, href: string) {
  href = href.split(/[?#]/)[0];
  if (href === "/round" && pathname === "/rounds") return true;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
