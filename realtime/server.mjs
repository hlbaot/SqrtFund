import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { Server } from "socket.io";

/** Kênh công khai chỉ phát tín hiệu đổi dữ liệu; không phát email, đơn hay quyền của ví. */
export function createRealtimeServer({ secret, origins }) {
  if (!secret || secret.length < 32 || !origins.length) throw new Error("Configure secret (32+ characters) and allowed origins");
  const http = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200).end("ok");
      return;
    }
    if (request.method !== "POST" || request.url !== "/publish") { response.writeHead(404).end(); return; }
    const provided = Buffer.from(request.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      response.writeHead(401).end(); return;
    }
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 1024) { response.writeHead(413).end(); return; }
      }
      const change = JSON.parse(body);
      if (change?.kind !== "organizers") { response.writeHead(400).end(); return; }
      // Không chuyển tiếp payload tùy ý từ caller xuống browser.
      io.emit("data:changed", { kind: "organizers" });
      response.writeHead(204).end();
    } catch { response.writeHead(400).end(); }
  });
  const io = new Server(http, {
    transports: ["websocket"],
    maxHttpBufferSize: 1024,
    cors: { origin: origins },
    allowRequest: (request, accept) => accept(null, origins.includes(request.headers.origin ?? "")),
  });
  // Không có socket.on("publish"): browser không được tự phát thông báo giả.
  return { http, io };
}
