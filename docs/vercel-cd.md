# CD deploy website lên Vercel

## Luồng hoạt động

Workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) thực hiện:

1. Push `main` hoặc chạy thủ công trên `main`.
2. Frontend chạy test, lint, TypeScript, build và lưu artifact; contract chạy Forge test.
3. Cả hai job đạt mới chạy `deploy` trong GitHub Environment `production`.
4. Lấy cấu hình Production từ Vercel, tạo `.vercel/output`, rồi deploy bằng `--prebuilt --prod`.
5. URL deploy xuất hiện trong phần tóm tắt workflow và GitHub Environment.

Pull request chỉ chạy CI. Production được chạy tuần tự, không hủy lần deploy đang chạy khi có commit mới. Node.js dùng phiên bản 24; Vercel CLI ghim `65.0.0`.

CI vẫn lưu artifact Next.js thông thường như trước. Job CD tạo thêm output theo định dạng Vercel và dùng đúng biến Production; không upload artifact `.next` thông thường như một bản prebuilt của Vercel.

## Thiết lập một lần

### 1. Tạo hoặc chọn project Vercel

Đặt Framework **Next.js**, Root Directory là root repo (`./`), Node.js **24.x**. File [`vercel.json`](../vercel.json) đã đặt lệnh cài dependencies và build theo pnpm/lockfile của repo.

Có thể liên kết project từ root repo:

```bash
pnpm dlx vercel@65.0.0 login
pnpm dlx vercel@65.0.0 link
```

Lấy `orgId` và `projectId` trong `.vercel/project.json`. Thư mục `.vercel` đã được gitignore. Tạo token tại Vercel **Account Settings → Tokens**, chọn phạm vi cho phép truy cập project đó.

### 2. Đặt GitHub Actions Secrets

Vào repo **Settings → Secrets and variables → Actions → Secrets**, thêm:

| Secret | Giá trị |
| --- | --- |
| `VERCEL_TOKEN` | Token Vercel có quyền deploy project |
| `VERCEL_ORG_ID` | `orgId` trong file liên kết project |
| `VERCEL_PROJECT_ID` | `projectId` trong file liên kết project |

Có thể đặt các secret trong Environment `production` thay cho Repository Secrets. Workflow báo rõ tên biến thiếu, không in giá trị token. Không cần gửi token qua chat hoặc ghi vào repo.

### 3. Đặt biến Production trên Vercel

Vào project **Settings → Environment Variables**, chọn môi trường **Production** và cấu hình theo [`.env.example`](../.env.example):

- Public: `NEXT_PUBLIC_CHAIN_ID=43113`, RPC/explorer, Factory, USDC và StudentRegistry đã xác minh. Dùng địa chỉ Factory hỗ trợ Multi-Organizer khi chạy tính năng Organizer mới.
- Backend: `OTP_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, cấu hình SMTP hoặc Resend. Cấu hình `ATTESTER_PRIVATE_KEY` và chính sách domain nếu sử dụng xác minh sinh viên.

Đặt cùng các địa chỉ public vào GitHub Actions Variables cho bản build CI. Deploy production dùng biến lấy từ Vercel, không lấy `.env.local` trên máy bạn. Không đặt biến bí mật dưới tên `NEXT_PUBLIC_*`.

Chạy các migration Supabase theo thứ tự trước khi sử dụng tính năng tương ứng, bao gồm [`0003_organizer_contact_otp.sql`](../supabase/migrations/0003_organizer_contact_otp.sql) cho OTP Organizer. Workflow này không tự thay đổi database hay deploy hợp đồng blockchain.

### 4. Kích hoạt deploy

Push cấu hình và code đã sẵn sàng lên `main`, hoặc vào **Actions → CI/CD - Test, Build and Deploy → Run workflow → main**. Chỉ khi cả hai job CI đạt, job Vercel mới chạy.

`vercel.json` tắt Vercel Git auto-deploy để tránh một luồng khác deploy trước khi CI hoàn tất; deploy sẽ đi qua workflow này. Không có preview deployment tự động trong phạm vi MVP hiện tại.

## Trạng thái kiểm chứng

Đã thêm cấu hình CD và hướng dẫn ở local. Chưa có project được liên kết trong workspace hoặc token để thực hiện lần deploy Vercel thật; chưa xác nhận URL website mới. Cần hoàn thành phần Secrets và Production env ở trên trước lần chạy đầu tiên.

## Tài liệu tham khảo

- [Vercel: GitHub Actions với pull, build và deploy prebuilt](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel).
- [Vercel: cấu hình git.deploymentEnabled](https://vercel.com/docs/project-configuration/git-configuration).
