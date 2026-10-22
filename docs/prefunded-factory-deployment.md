# Khôi phục luồng nạp USDC → tạo round

## Nguyên nhân đã kiểm tra trên Fuji

Factory `0xac3c59afacb7df7d082d2dadeeca1c5763f63687` có phân quyền Organizer nhưng không có `fundingVersion`, `depositInitialPool`, `initialPoolDeposits`, `withdrawInitialPool`, `createFundedRound`.
Không thể bổ sung các hàm này bằng cách sửa ABI, frontend hoặc `.env` trong khi giữ nguyên contract đã deploy.
Không chuyển USDC trực tiếp vào địa chỉ Factory này để thay cho nạp deposit.

Source `contracts/src/RoundFactory.sol` hiện tại hỗ trợ cả Multi-Organizer và nạp/rút trước khi tạo vòng. Giữ nguyên StudentRegistry và USDC hiện có khi triển khai bản này.

## Triển khai

Ví ký deploy sẽ là Platform Owner của Factory mới. Dùng keystore của ví quản trị mong muốn; không gửi private key trong chat hoặc ghi vào lệnh.

```bash
cd /Users/baotoan/Documents/SqrtFund/contracts
NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS=0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e \
forge script script/DeployPrefundedFactory.s.sol:DeployPrefundedFactory \
  --rpc-url fuji \
  --account deployer \
  --sender <DIA_CHI_VI_QUAN_TRI_KHOP_KEYSTORE> \
  --broadcast
```

Chỉ dùng địa chỉ `Prefunded Factory` sau khi giao dịch broadcast có receipt thành công. Địa chỉ từ mô phỏng không phải contract đã deploy.

## Cấu hình ứng dụng

1. Cập nhật `NEXT_PUBLIC_FACTORY_ADDRESS` trong `.env.local` bằng địa chỉ vừa deploy thành công. Giữ nguyên USDC và StudentRegistry.
2. Chạy kiểm tra từ thư mục gốc:

   ```bash
   pnpm check:factory <FACTORY_MOI> <VI_NHA_TO_CHUC>
   ```

   Cần thấy `Funding version: 1`, `Deposit-before-creation: supported` và đúng StudentRegistry. Script chỉ đọc dữ liệu, không ký hay gửi giao dịch. Thiếu hàm là lỗi `UNSUPPORTED`; lỗi RPC được báo riêng.
3. Quyền Organizer của Factory cũ không tự chuyển sang Factory mới. Platform Owner mới cần cấp lại bằng màn hình Cấp quyền Organizer hoặc gọi `setOrganizer(address,bool)` với `true` trên Factory mới. Kiểm tra lại `Wallet authorized: true`.
4. Khởi động lại `pnpm dev`. Với Vercel, cập nhật biến môi trường tương ứng rồi redeploy frontend vì `NEXT_PUBLIC_*` được đóng vào bản build.
5. Cập nhật `contracts/deployments/fuji.json` chỉ sau khi xác nhận receipt và kết quả kiểm tra. Giữ bản ghi Factory cũ để truy cập các round cũ; việc đổi Factory không di chuyển round hoặc tiền đã có.

## Thử luồng

- Nhập thông tin round và số USDC cần nạp, bấm Nạp.
- Xác nhận approve nếu cần, sau đó xác nhận giao dịch `depositInitialPool`.
- Chỉ khi receipt thành công và credit on-chain đủ, nút Tạo round mới mở.
- Bấm Tạo round gọi `createFundedRound`, chuyển phần credit đã chọn vào round mới. Nếu tạo thất bại, giao dịch rollback và credit vẫn còn.
- Nếu chưa muốn tạo, bấm rút tiền chưa dùng (`withdrawInitialPool`). Không cần tạo round hoặc điền đủ form để rút. Ví bị thu hồi quyền Organizer vẫn rút được credit của chính nó.
