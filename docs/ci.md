# Thiết lập CI và lưu bản build

Workflow nằm ở [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Phạm vi MVP hiện tại: kiểm tra code và tạo bản build, chưa tự động deploy website hay contract.

## Khi nào chạy?

- Push lên nhánh `main`.
- Pull request vào nhánh `main`.
- Chạy thủ công trong GitHub → **Actions → CI - Test and Build → Run workflow**.

File phải được push lên GitHub trước khi Actions có thể chạy. Việc tạo file ở local không tự kích hoạt workflow trên GitHub.

## Các bước kiểm tra

Hai job chạy độc lập; cả hai phải thành công để workflow được đánh dấu thành công.

| Job | Công việc |
| --- | --- |
| Frontend | Node.js 24, pnpm theo `package.json`, cài dependencies bằng lockfile, chạy test, lint, TypeScript, build Next.js và lưu bản build. |
| Contracts | Tải submodule OpenZeppelin đã ghim phiên bản, cài Forge v1.7.1, chạy test và xuất gas report. |

Các bài integration test cần RPC hoặc Supabase thật được tắt trong CI mặc định. Test không yêu cầu private key, SMTP hoặc quyền truy cập Supabase của bạn.

## Biến cấu hình công khai

Để bản build kết nối đúng các contract, vào **Settings → Secrets and variables → Actions → Variables**, thêm:

- `NEXT_PUBLIC_FACTORY_ADDRESS`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS`

Có thể thêm `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_RPC_URL_FALLBACK` và `NEXT_PUBLIC_EXPLORER_URL`. Nếu không đặt RPC hoặc explorer, workflow dùng giá trị mặc định của Fuji. Chain ID được đặt là `43113`.

Nếu chưa có địa chỉ contract, vẫn có thể chạy kiểm tra và build; các chức năng on-chain cần cấu hình đầy đủ khi chạy ứng dụng. Các biến `NEXT_PUBLIC_*` được đưa vào bản build: thay đổi chúng cần build lại.

Workflow không tải `.env.local` từ máy bạn và không cần GitHub Secrets. Không điền private key, seed phrase hoặc thông tin SMTP/Supabase bí mật vào Variables hay các biến `NEXT_PUBLIC_*`.

## Tải bản build

Sau khi job Frontend thành công, mở lần chạy workflow và tải artifact **`sqrtfund-build-<commit SHA>`**. Artifact được giữ 7 ngày, gồm:

- `sqrtfund-build.tar.gz`: thư mục `.next` không có cache hoặc đầu ra dev, `public`, các file cấu hình và lockfile cần để chạy bản build.
- `SHA256SUMS`: mã kiểm tra toàn vẹn của file nén.

Gas report được lưu trong artifact **`contract-gas-report-<commit SHA>`**. Nếu job Contracts thất bại, workflow vẫn thất bại dù job Frontend đã tạo artifact. Chỉ chọn bản build từ lần chạy mà cả hai job đều thành công.

Bản build không chứa `.env.local`, `node_modules` hoặc khóa ký giao dịch. Đây là đầu ra build để kiểm tra, chưa phải gói deploy tự động.

Để chạy thử artifact trên Linux tương thích với runner, dùng Node.js 24 và pnpm đúng phiên bản trong `package.json`. Trong thư mục trống sau khi giải nén artifact tải từ GitHub:

```bash
sha256sum -c SHA256SUMS
tar -xzf sqrtfund-build.tar.gz
corepack enable
pnpm install --frozen-lockfile
pnpm start
```

Nếu thử các API xác minh email, cần tự cấu hình các biến môi trường phía server theo `.env.example`. CI không thực hiện gửi email, xác minh sinh viên hoặc phát giao dịch blockchain.

## Kiểm tra ở local

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Kiểm tra contract từ root của repo:

```bash
git submodule update --init --recursive
cd contracts
forge test --gas-report
```
