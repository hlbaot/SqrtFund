# Nạp thành công trước khi tạo round

Luồng mới: điền thông tin → nhập số USDC lớn hơn 0 → bấm **Nạp** cạnh ô số tiền → xác nhận approve nếu cần → xác nhận deposit → bấm **Tạo round**.

Deposit chuyển token vào Factory, chưa triển khai round. Credit được lưu theo ví và token trên chain, nên tải lại trang vẫn đọc được. Nếu sửa số tiền, giao diện chỉ yêu cầu nạp phần còn thiếu. Credit dư không bị tự dùng hết. Không gọi tạo round từ nút Nạp; nút Tạo round chỉ khả dụng khi credit đủ. Approve thành công chưa phải deposit thành công.

Sau khi gộp Multi-Organizer, source Factory cho phép owner và Organizer được cấp quyền cùng sử dụng luồng này. Mỗi ví chỉ dùng được credit của chính mình. Thu hồi Organizer chặn nạp/tạo mới nhưng vẫn cho rút credit chưa dùng. Factory `0xA8F91a1e7DD90F64c105c3CAa8FBe153c6bfc55f` đã triển khai trước đó chỉ hỗ trợ owner; giao diện giữ tương thích để owner tiếp tục nạp và tạo round. Muốn dùng cả chức năng cấp quyền Organizer và nạp trước trên chain thì cần một deployment có cả hai tính năng, không chỉ cập nhật ABI.

`createFundedRound` trừ credit, triển khai `PrefundedQFRound` và chuyển đúng số token vào round trong cùng giao dịch. Pool và token balance được khởi tạo đồng bộ. Nếu constructor hoặc chuyển token thất bại, toàn bộ giao dịch rollback: không có round mới, credit còn nguyên. Token có phí chuyển bị từ chối. Factory chỉ dùng credit của người gọi; chuyển owner không chuyển credit của owner cũ.

Nút **Rút lại tiền đã nạp** hoàn trả toàn bộ credit chưa dùng về ví gửi, không yêu cầu điền lại form. Người gửi vẫn có quyền rút sau khi chuyển owner Factory; có thể vào trực tiếp `/admin` để thấy khoản nạp của mình. Nếu chưa có credit thì không có tiền để rút. Phí mạng không được hoàn.

## Kiểm tra trước deploy

```bash
cd contracts
forge test --offline
forge build --offline --sizes
cd ..
node scripts/sync-abis.mjs
pnpm exec vitest run
pnpm exec tsc --noEmit
```

Factory cũ không có escrow và không nâng cấp được bằng thay ABI. Giao diện kiểm tra `fundingVersion() == 1` và chặn luồng mới nếu Factory chưa hỗ trợ hoặc không đọc được dữ liệu. Không tự lùi về luồng tạo trước rồi nạp sau.

## Chuẩn bị triển khai Fuji

Script mới chỉ deploy Factory; không deploy lại token/registry và không tự ghi đè manifest.

Factory đã được chủ dự án triển khai trên Fuji và kiểm tra RPC ngày 21/10/2026:

- Factory: `0xA8F91a1e7DD90F64c105c3CAa8FBe153c6bfc55f`
- Owner: `0x3fbF96fA6B3643c89D38eC1588c38912503f2b88`
- Registry: `0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e`
- `fundingVersion()`: `1`
- Giao dịch: `0x883930e36dc62285a1f9bb16c7b963d7c16b78846e250b0b0905b7c0ff247c0c`
- Manifest Factory cũ: `contracts/deployments/fuji-before-prefunding.json` (giữ lại để truy cập các round cũ).

Manifest hiện tại và `.env.local` đã cập nhật Factory mới. Môi trường hosting cần cập nhật public env và build/redeploy riêng. Các bước dưới đây dành cho lần triển khai khác.

1. Lưu lại manifest, địa chỉ Factory cũ và danh sách round cũ để tiếp tục quản lý chúng. Factory mới có danh sách round rỗng. Đổi Factory trên frontend làm danh sách mặc định đọc Factory mới; các round cũ và tiền trong chúng vẫn tồn tại và có thể truy cập bằng địa chỉ round cụ thể. Nếu cần hiển thị lịch sử nhiều Factory trong cùng danh sách, phải bổ sung nguồn Factory lịch sử riêng.
2. Dùng cùng `STUDENT_REGISTRY_ADDRESS` và `NEXT_PUBLIC_USDC_ADDRESS` hiện có. Ví broadcast là owner Factory mới, cần AVAX Fuji và USDC để thử luồng.
3. Đặt `RPC` là Fuji RPC và `STUDENT_REGISTRY_ADDRESS` là địa chỉ registry thực. Chạy mô phỏng trước; chỉ thêm `--broadcast` khi chủ dự án muốn deploy thật. `deployer` là alias keystore đã có của bạn:

```bash
cd contracts
forge script script/DeployPrefundedFactory.s.sol:DeployPrefundedFactory \
  --rpc-url "$RPC" --account deployer

# Deploy thật khi đã kiểm tra mô phỏng:
forge script script/DeployPrefundedFactory.s.sol:DeployPrefundedFactory \
  --rpc-url "$RPC" --account deployer --broadcast
```

4. Lấy `FACTORY` từ receipt broadcast thành công, không dùng địa chỉ của lần mô phỏng. Xác minh:

```bash
cast call "$FACTORY" 'owner()(address)' --rpc-url "$RPC"
cast call "$FACTORY" 'studentRegistry()(address)' --rpc-url "$RPC"
cast call "$FACTORY" 'fundingVersion()(uint256)' --rpc-url "$RPC"
cast call "$FACTORY" 'roundCount()(uint256)' --rpc-url "$RPC"
```

`fundingVersion` phải bằng 1, owner đúng ví quản trị, registry đúng registry đang dùng. Factory vừa deploy có 0 round.

5. Sau xác minh, cập nhật `contracts/deployments/fuji.json` với Factory thật, giữ nguyên registry/token. Đặt `NEXT_PUBLIC_FACTORY_ADDRESS` trong `.env.local` và môi trường hosting tương ứng; restart local hoặc build/redeploy frontend. Không đổi cấu hình sang địa chỉ dự đoán trước khi có receipt.
6. Chạy thử với số nhỏ: Nạp thành công nhưng roundCount vẫn 0; tải lại trang và nhập lại thông tin, credit vẫn còn; Tạo round làm roundCount tăng 1, pool/balance đúng số tiền; thử rút credit chưa dùng. Dùng ví thứ hai xác nhận không rút hoặc dùng được credit của ví đầu.

## Khôi phục credit bằng contract

Nếu giao diện không truy cập được, người gửi có thể đọc và rút credit trực tiếp. `DEPOSITOR` là ví gửi, `TOKEN` là USDC đã nạp, `AMOUNT_RAW` là số nguyên theo 6 decimals (1 USDC = 1000000). Không cần quyền owner hiện tại để rút credit của chính mình.

```bash
cast call "$FACTORY" 'initialPoolDeposits(address,address)(uint256)' \
  "$DEPOSITOR" "$TOKEN" --rpc-url "$RPC"
cast send "$FACTORY" 'withdrawInitialPool(address,uint256)' \
  "$TOKEN" "$AMOUNT_RAW" --rpc-url "$RPC" --account depositor
```

Không chuyển token trực tiếp đến Factory bằng ERC20 transfer: chỉ `depositInitialPool` ghi nhận credit. Không đưa private key lên frontend, command line hoặc chat.
