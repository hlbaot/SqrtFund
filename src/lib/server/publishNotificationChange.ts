import "server-only";

/** Chỉ gọi sau khi lưu thành công. Lỗi socket không được biến đơn đã lưu thành lỗi gửi đơn. */
export async function publishNotificationChange() {
  const url = process.env.SOCKET_SERVER_URL;
  const secret = process.env.SOCKET_PUBLISH_SECRET;
  if (!url || !secret) return;
  try {
    const response = await fetch(new URL("/publish", url), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ kind: "organizers" }),
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) console.warn("[notifications] publish rejected", response.status);
  } catch {
    // Không log URL/header vì có thể chứa thông tin hạ tầng hoặc secret.
    console.warn("[notifications] realtime unavailable; polling will refresh data");
  }
}
