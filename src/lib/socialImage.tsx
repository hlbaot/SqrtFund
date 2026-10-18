import "server-only";
import { ImageResponse } from "next/og";
export const socialImageSize = { width: 1200, height: 630 };
export function createSocialImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#0a0a10", color: "#f1f5f9", borderTop: "8px solid #e84142" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 104, fontWeight: 700 }}><svg width="100" height="112" viewBox="0 0 100 112"><path d="M4 62 L24 54 L44 96 L72 10 H98" fill="none" stroke="#e84142" strokeWidth="9" /></svg><span>Fund</span></div>
    <div style={{ display: "flex", marginTop: "36px", fontSize: 40, lineHeight: 1.35, maxWidth: "1000px" }}>Quadratic Funding cho quỹ hoạt động sinh viên</div>
    <div style={{ display: "flex", marginTop: "32px", color: "#cbd5e1", fontSize: 24 }}>Minh bạch · Cộng đồng · Avalanche Fuji Testnet</div>
  </div>, socialImageSize);
}
