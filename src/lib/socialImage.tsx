import "server-only";
import { ImageResponse } from "next/og";
export const socialImageSize = { width: 1200, height: 630 };
export function createSocialImage() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", background: "#0a0a10", color: "#f1f5f9", borderTop: "8px solid #e84142" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 104, fontWeight: 700 }}><span style={{ color: "#e84142" }}>N</span><span>-Power</span></div>
    <div style={{ display: "flex", marginTop: "36px", fontSize: 40, lineHeight: 1.35, maxWidth: "1000px" }}>Quadratic Funding cho quỹ hoạt động sinh viên</div>
    <div style={{ display: "flex", marginTop: "32px", color: "#cbd5e1", fontSize: 24 }}>Minh bạch · Cộng đồng · Avalanche Fuji Testnet</div>
  </div>, socialImageSize);
}
