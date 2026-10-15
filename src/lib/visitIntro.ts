export const VISIT_INTRO_SEEN_KEY = "sqrt-fund:visit-intro-seen";

// Run before the first paint. A tab shows the intro once, including direct links.
export const VISIT_INTRO_BOOTSTRAP = `try{if(sessionStorage.getItem('${VISIT_INTRO_SEEN_KEY}')!=='1'){sessionStorage.setItem('${VISIT_INTRO_SEEN_KEY}','1');document.documentElement.classList.add('splash-active');}}catch{document.documentElement.classList.add('splash-active');}`;

export function markVisitIntroSeen() {
  try { window.sessionStorage.setItem(VISIT_INTRO_SEEN_KEY, "1"); } catch { /* Storage may be disabled. */ }
}
