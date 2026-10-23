import { NextResponse } from "next/server";
import crypto from "node:crypto";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy file ảnh" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Vui lòng chọn file định dạng hình ảnh" }, { status: 400 });
    }

    // Giới hạn 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Kích thước ảnh tối đa là 5MB" }, { status: 400 });
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName) {
      return NextResponse.json(
        { error: "Chưa cấu hình NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME trong file môi trường (.env)" },
        { status: 500 }
      );
    }

    const uploadBody = new FormData();
    uploadBody.append("file", file);

    if (apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const stringToSign = `timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

      uploadBody.append("api_key", apiKey);
      uploadBody.append("timestamp", timestamp);
      uploadBody.append("signature", signature);
    } else if (uploadPreset) {
      uploadBody.append("upload_preset", uploadPreset);
    } else {
      return NextResponse.json(
        { error: "Chưa cấu hình CLOUDINARY_API_KEY/SECRET hoặc NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET" },
        { status: 500 }
      );
    }

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadBody,
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Tải ảnh lên Cloudinary thất bại" },
        { status: res.status }
      );
    }

    return NextResponse.json({ url: data.secure_url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi server khi upload ảnh";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
