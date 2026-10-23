import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/upload/route";

describe("POST /api/upload", () => {
  it("returns 400 when no file is uploaded", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Không tìm thấy file");
  });

  it("returns 400 when file is not an image", async () => {
    const formData = new FormData();
    const blob = new Blob(["not an image"], { type: "text/plain" });
    formData.append("file", blob, "test.txt");
    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("định dạng hình ảnh");
  });
});
