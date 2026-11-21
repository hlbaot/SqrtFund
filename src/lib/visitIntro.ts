export const VISIT_INTRO_SEEN_KEY = "sqrt-fund:visit-intro-seen";

// Chạy trước lần paint đầu; mỗi tab chỉ hiện intro một lần, kể cả link trực tiếp.
export const VISIT_INTRO_BOOTSTRAP = `try{if(sessionStorage.getItem('${VISIT_INTRO_SEEN_KEY}')!=='1'){sessionStorage.setItem('${VISIT_INTRO_SEEN_KEY}','1');document.documentElement.classList.add('splash-active');}}catch{document.documentElement.classList.add('splash-active');}`;

export function markVisitIntroSeen() {
  try { window.sessionStorage.setItem(VISIT_INTRO_SEEN_KEY, "1"); } catch { /* Storage có thể bị tắt. */ }
}
