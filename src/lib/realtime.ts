/** Socket chỉ báo dữ liệu đã đổi, tuyệt đối không dùng payload để cấp quyền. */
export const REALTIME_EVENT = "data:changed";
export type RealtimeChange = { kind: "organizers" | "chain" };

export function isRealtimeChange(value: unknown): value is RealtimeChange {
  return Boolean(value && typeof value === "object" && "kind" in value
    && (value.kind === "organizers" || value.kind === "chain"));
}

export function isNotificationQuery(key: readonly unknown[]) {
  return ["readContract", "readContracts", "round-fields", "round-notifications",
    "organizer-application", "admin-organizer-applications", "ui-mirror", "round-donation-history"].includes(String(key[0]));
}
