export function matchesNavRoute(pathname: string, href: string) {
  if (href === "/round" && pathname === "/rounds") return true;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
