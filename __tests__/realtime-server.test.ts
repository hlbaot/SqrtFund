import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect } from "socket.io-client";
import { createRealtimeServer } from "../realtime/server.mjs";

const secret = "test-secret-for-publish-only-12345678";
const origin = "http://localhost:3015";
const service = createRealtimeServer({ secret, origins: [origin] });
let url: string;
beforeAll(async () => {
  await new Promise<void>(resolve => service.http.listen(0, "127.0.0.1", resolve));
  const address = service.http.address();
  if (!address || typeof address === "string") throw new Error("Missing address");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>(resolve => service.io.close(() => resolve())));

describe("Socket.IO notification service", () => {
  it("rejects unauthenticated publishing", async () => {
    const result = await fetch(`${url}/publish`, { method: "POST", body: JSON.stringify({ kind: "organizers" }) });
    expect(result.status).toBe(401);
  });
  it("broadcasts only a refresh hint to connected browsers", async () => {
    const socket = connect(url, { transports: ["websocket"], extraHeaders: { origin }, autoConnect: false, reconnection: false });
    try {
      await new Promise<void>((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); socket.connect(); });
      const received = new Promise(resolve => socket.once("data:changed", resolve));
      const result = await fetch(`${url}/publish`, { method: "POST", headers: { authorization: `Bearer ${secret}` },
        body: JSON.stringify({ kind: "organizers", contactEmail: "must-not-be-forwarded@example.com" }) });
      expect(result.status).toBe(204);
      expect(await received).toEqual({ kind: "organizers" });
    } finally { socket.disconnect(); }
  });
  it("rejects browser connections from an unapproved origin", async () => {
    const socket = connect(url, { transports: ["websocket"], extraHeaders: { origin: "https://unapproved.example" }, autoConnect: false, reconnection: false });
    try {
      const denied = new Promise(resolve => socket.once("connect_error", resolve));
      socket.connect();
      await denied;
      expect(socket.connected).toBe(false);
    } finally { socket.disconnect(); }
  });
});
