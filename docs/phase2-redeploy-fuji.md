# Giai đoạn 2: redeploy Factory và tạo round mới

Các lệnh dưới đây để chủ dự án tự chạy. Agent chưa deploy hay gửi giao dịch Fuji. Không cần deploy lại StudentRegistry hoặc MockUSDC, không đổi attester và không xác thực lại những ví đã là Student trong registry hiện có.

## 1. Kiểm tra và chuẩn bị

Từ thư mục gốc repository:

```bash
forge test --root contracts
pnpm test
pnpm build
export RPC=https://api.avax-test.network/ext/bc/C/rpc
export STUDENT_REGISTRY_ADDRESS=0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e
export ATTESTER_ADDRESS=0x5C2001c91aEFFaEDf9ef438cA50Bcddd23ce6181
export DEPLOYER_ADDRESS="$(cast wallet address --account deployer)"
cast call "$STUDENT_REGISTRY_ADDRESS" 'attester()(address)' --rpc-url "$RPC"
```

`deployer` là keystore Foundry đã có trên máy bạn; nhập mật khẩu khi được hỏi. Ví này cần AVAX Fuji trả phí và sẽ là owner của Factory mới. Không truyền private key dạng plaintext. `ATTESTER_ADDRESS` ở đây chỉ dùng đối chiếu registry, **DeployFactory không nhận biến attester**. Nếu getter khác địa chỉ dự kiến thì kiểm tra cấu hình registry/server trước khi tiếp tục, không tự đổi attester bằng script Factory.

## 2. Deploy chỉ Factory

```bash
cd contracts
forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url "$RPC" --chain-id 43113 \
  --account deployer --sender "$DEPLOYER_ADDRESS" --broadcast
cd ..
```

Constructor thật là `RoundFactory(address registry)`. Script lấy registry từ `STUDENT_REGISTRY_ADDRESS`, đọc địa chỉ MockUSDC từ `contracts/deployments/fuji.json` để giữ nguyên token, rồi ghi lại manifest với Factory mới. Token được truyền khi `createRound`, không phải tham số constructor Factory. Bytecode Factory chứa creation code QFRound mới; Factory đã deploy trước đó không thể sinh round Giai đoạn 2 chỉ bằng cập nhật ABI.

Xác nhận giao dịch broadcast thành công trên explorer rồi đối chiếu địa chỉ trong manifest với receipt/broadcast output. Script có thể ghi địa chỉ dự đoán trong quá trình mô phỏng; không coi manifest đã ghi là bằng chứng deploy thành công.

```bash
cat contracts/deployments/fuji.json
node scripts/sync-abis.mjs
```

Nếu cần kiểm tra Factory mới, điền đúng địa chỉ vừa broadcast:

```bash
export FACTORY_ADDRESS=0xYOUR_NEW_FACTORY_ADDRESS
cast code "$FACTORY_ADDRESS" --rpc-url "$RPC"
cast call "$FACTORY_ADDRESS" 'studentRegistry()(address)' --rpc-url "$RPC"
cast call "$FACTORY_ADDRESS" 'owner()(address)' --rpc-url "$RPC"
cast call "$FACTORY_ADDRESS" 'roundCount()(uint256)' --rpc-url "$RPC"
```

Registry phải là địa chỉ ở bước 1; owner phải là keystore deployer; Factory vừa deploy có 0 round.

## 3. Đồng bộ local và Vercel

- Tự đổi `NEXT_PUBLIC_FACTORY_ADDRESS` trong `.env.local` thành địa chỉ mới. Giữ `NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS` và `NEXT_PUBLIC_USDC_ADDRESS` theo manifest. Không commit `.env.local`.
- Lưu/commit manifest và ABI; cập nhật hàng Factory/link Snowtrace trong README theo địa chỉ **đã broadcast thành công**. README hiện đánh dấu địa chỉ cũ cần redeploy.
- Restart `pnpm dev`. Trên Vercel đổi public env ở đúng Production/Preview, **Redeploy và bỏ tick Use existing Build Cache**. Public env cần build mới để có hiệu lực.

## 4. Admin tạo round mới và chạy thử

1. Kết nối ví owner Factory, mở Admin tạo round mới. `createRound` nhận theo thứ tự `name, organizer, token, startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound`; admin round là ví gọi. Chọn `0 < minDonation <= maxDonation <= maxPerRound`, tối đa 50 dự án. Ví dụ min 1, max dự án 5, max round 10 USDC. Không truyền attester vào round; registry được Factory truyền sẵn.
2. Owner MockUSDC mint cho admin/sinh viên hoặc sinh viên dùng faucet tại `/my`; approve rồi `depositPool` trước khi finalize.
3. Ví Student đăng ký dự án, admin duyệt. Dùng ví Student khác chủ dự án để donate. Trong DonateBox chọn chia ngân sách, gõ tiền vào nhiều dự án: Expected Matching đổi ngay; tổng không vượt ngân sách. Approve token có thể là giao dịch riêng, còn `donateMany` là một giao dịch atomic.
4. Dùng **round thử dành riêng cho hủy**: có ít nhất hai donor và pool, admin bấm Hủy vòng và xác nhận. Kiểm tra banner đã hủy, donor Refund toàn bộ tiền gốc, không rút lại lần hai; admin rút pool một lần. Phí mạng không được hoàn. Sau tất cả hoàn/rút, balance round phải bằng 0 nếu không có token chuyển thẳng ngoài các hàm này.
5. Dùng **round thử khác** để kiểm tra finalize sau endTime, claim và phí toast. Không thể finalize/claim một round đã hủy; không thể hủy sau finalize.

Lấy địa chỉ round mới từ Admin hoặc Factory rồi kiểm tra chỉ đọc:

```bash
cast call "$FACTORY_ADDRESS" 'getRounds()(address[])' --rpc-url "$RPC"
export ROUND_ADDRESS=0xYOUR_NEW_ROUND_ADDRESS
cast call "$ROUND_ADDRESS" 'studentRegistry()(address)' --rpc-url "$RPC"
cast call "$ROUND_ADDRESS" 'admin()(address)' --rpc-url "$RPC"
cast call "$ROUND_ADDRESS" 'maxPerRound()(uint256)' --rpc-url "$RPC"
cast call "$ROUND_ADDRESS" 'isCancelled()(bool)' --rpc-url "$RPC"
cast call "$ROUND_ADDRESS" 'cancelledPoolWithdrawn()(bool)' --rpc-url "$RPC"
cast call 0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205 \
  'balanceOf(address)(uint256)' "$ROUND_ADDRESS" --rpc-url "$RPC"
```

Round mới trả `false` cho hai cờ; sau hủy/rút pool chúng thành `true`. Refund không có hạn chót và không yêu cầu Student, chỉ ví đã donate mới lấy được tiền của chính ví đó. Round chưa hủy không có nhánh refund theo timeout.

Explorer: [Snowtrace Fuji](https://testnet.snowtrace.io/). Mở địa chỉ Factory/round/transaction thực nhận sau deploy; không tái sử dụng địa chỉ Factory cũ để thử API mới.
