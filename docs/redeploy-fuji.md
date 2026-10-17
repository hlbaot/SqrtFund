# Fuji: xác thực Student dùng chung, không phụ thuộc round

> Cập nhật 17/10/2026: manifest hiện đã có registry và factory mới, RPC kiểm tra thành công, nhưng factory mới chưa có round. Nếu đang xử lý lỗi `/round`, xem [bảng chẩn đoán và hướng dẫn dùng factory đã có](round-loading-fuji.md) trước khi quyết định deploy thêm. Các bước deploy bên dưới dành cho môi trường chưa có deployment phù hợp.

Luồng hiện tại là **email trường → OTP → StudentRegistry.verifyStudent → ví Student dùng chung → các round đọc registry**. Trang `/verify` và hai API OTP hoạt động khi chưa có factory/round. Các bước dưới đây do bạn tự chạy; agent không deploy, không dùng khóa thật và không chạy migration trên Supabase thật.

## 1. Kiểm thử trước khi deploy

Từ thư mục gốc:

```bash
forge test --root contracts
pnpm lint
pnpm vitest run
pnpm build
```

Test Supabase opt-in cần project dev riêng; không dùng production. Chạy phần mặc định không gửi mail và không sửa Supabase thật.

## 2. Deploy StudentRegistry một lần

Giữ `ATTESTER_PRIVATE_KEY` riêng cho backend, khác ví deployer/admin. Chỉ suy ra **địa chỉ công khai** của account đó bằng lệnh sau trong terminal của bạn (Node 22+). Lệnh không in khóa:

```bash
export ATTESTER_ADDRESS="$(node --env-file=.env.local --input-type=module <<'JS'
import { privateKeyToAccount } from 'viem/accounts';
const key = process.env.ATTESTER_PRIVATE_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error('Missing or invalid ATTESTER_PRIVATE_KEY');
  process.exit(1);
}
try { console.log(privateKeyToAccount(key).address); }
catch { console.error('Invalid attester account configuration'); process.exit(1); }
JS
)"
test -n "$ATTESTER_ADDRESS" || exit 1
export RPC=https://api.avax-test.network/ext/bc/C/rpc
```

Nếu chưa có deployer trong Foundry keystore, tự import bằng prompt kín. Nếu đã có, bỏ bước import và thay alias trong các lệnh bằng alias hiện có. Không đưa khóa vào command line, Git hay chat. Deployer cần Fuji AVAX; attester ký off-chain nên không cần AVAX.

```bash
cast wallet import sqrt-fund-deployer --interactive
export DEPLOYER_ADDRESS="$(cast wallet address --account sqrt-fund-deployer)"
test -n "$DEPLOYER_ADDRESS" || exit 1
cd contracts
forge script script/DeployStudentRegistry.s.sol:DeployStudentRegistry \
  --rpc-url "$RPC" --account sqrt-fund-deployer \
  --sender "$DEPLOYER_ADDRESS" --broadcast
cd ..
```

Lấy địa chỉ `StudentRegistry deployed at` từ lần broadcast thành công. Không lấy địa chỉ từ một lần mô phỏng thất bại. Sau đó đặt địa chỉ công khai đó:

```bash
export STUDENT_REGISTRY_ADDRESS=0xYOUR_DEPLOYED_STUDENT_REGISTRY
cast call "$STUDENT_REGISTRY_ADDRESS" 'attester()(address)' --rpc-url "$RPC"
cast call "$STUDENT_REGISTRY_ADDRESS" 'owner()(address)' --rpc-url "$RPC"
node scripts/sync-abis.mjs
```

`attester()` phải bằng `ATTESTER_ADDRESS`, `owner()` bằng deployer. Script registry không đụng factory, round hay MockUSDC và chỉ in các địa chỉ công khai.

## 3. Migration Supabase và cấu hình identity

Trong Supabase SQL Editor của project rỗng đã chọn:

1. Lấy khối `MANUAL RESET` ở cuối `supabase/migrations/0001_verification.sql`, bỏ dấu `--` và chạy riêng. Khối này DROP các hàm/bảng cũ; chỉ thực hiện khi đã xác nhận project không còn dữ liệu cần giữ.
2. Chạy toàn bộ `supabase/migrations/0001_verification.sql`. Đây là migration duy nhất; không chạy migration nâng cấp khác.
3. Kiểm tra hai bảng `otp_requests`, `verifications`, RLS bật, không policy cho client; các hàm `reserve_otp`, `consume_otp`, `verification_stats` chỉ cấp quyền gọi cho service role.
4. Lấy URL project và service role key, đặt `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ở server. Không dùng tiền tố `NEXT_PUBLIC_` cho hai biến này.

Không có dữ liệu cũ nào được tự chuyển thành danh tính Student mới. Mỗi sinh viên xác thực một lần vào registry dùng chung.

Trong `.env.local`, thêm:

```dotenv
NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS=0xYOUR_DEPLOYED_STUDENT_REGISTRY
```

Giữ nguyên Supabase/SMTP/OTP secret và khóa attester. Không `source .env.local` vào shell vì đây là tệp dotenv, không phải script shell. Dừng dev server cũ rồi chạy lại:

```bash
pnpm dev
```

Lúc này có thể mở `/verify`, kết nối ví Fuji và xác thực email **ngay cả khi chưa có round hay factory mới**. Request body chỉ cần `{ email, address }`. Khi nhập đúng mã, ký giao dịch trên StudentRegistry; `isStudent(wallet)` trở thành true và UI hiện Student dùng chung.

Đọc lại kết quả với địa chỉ ví sinh viên công khai:

```bash
cast call "$STUDENT_REGISTRY_ADDRESS" 'isStudent(address)(bool)' 0xSTUDENT_WALLET --rpc-url "$RPC"
```

## 4. Cho các round sử dụng Student dùng chung

Đây là bước nâng cấp phần vòng tài trợ; không phải điều kiện để gửi OTP. Bytecode round/factory cũ không thể đọc registry mới chỉ bằng đổi ABI. Cần một factory mới, sau đó các round mới tự dùng cùng registry. Quy trình sau tái sử dụng MockUSDC hiện có, không deploy token lại:

```bash
cd contracts
forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url "$RPC" --account sqrt-fund-deployer \
  --sender "$DEPLOYER_ADDRESS" --broadcast
cd ..
```

`DeployFactory.s.sol` cần `STUDENT_REGISTRY_ADDRESS`; nó không tạo registry khác. Script đọc `mockUsdc` từ `contracts/deployments/fuji.json` và tự cập nhật manifest với `roundFactory`, `studentRegistry`, giữ token cũ. Đối chiếu manifest với giao dịch thành công; script chạy thất bại có thể để lại địa chỉ mô phỏng nên phải kiểm tra trên chain.

```bash
export FACTORY="$(node --input-type=module -e "import fs from 'node:fs'; console.log(JSON.parse(fs.readFileSync('contracts/deployments/fuji.json','utf8')).roundFactory)")"
cast call "$FACTORY" 'studentRegistry()(address)' --rpc-url "$RPC"
cast call "$FACTORY" 'owner()(address)' --rpc-url "$RPC"
node scripts/sync-abis.mjs
```

Đổi `NEXT_PUBLIC_FACTORY_ADDRESS` trong `.env.local`, cập nhật bảng địa chỉ deployment trong README và restart dev. `NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS` phải giữ cùng registry. Vào Admin bằng ví factory owner rồi tạo round mới. Chọn `minDonation <= maxDonation <= maxPerRound` (ví dụ 1 / 5 / 10 USDC). Một ví được chia ngân sách cho nhiều dự án; ngân sách bắt đầu từ 0 ở mỗi round mới. Form không có ô attester: factory truyền registry vào constructor round; signer/identity không nằm trong round.

Kiểm tra round mới:

```bash
export ROUND=0xYOUR_NEW_ROUND_ADDRESS
cast call "$ROUND" 'studentRegistry()(address)' --rpc-url "$RPC"
cast call "$ROUND" 'admin()(address)' --rpc-url "$RPC"
cast call "$ROUND" 'maxPerRound()(uint256)' --rpc-url "$RPC"
cast call "$ROUND" 'remainingBudget(address)(uint256)' 0xSTUDENT_WALLET --rpc-url "$RPC"
cast call "$ROUND" 'isWhitelisted(address)(bool)' 0xSTUDENT_WALLET --rpc-url "$RPC"
```

Tạo round thứ hai dùng factory này và đọc lại `isWhitelisted`: cùng ví Student phải được chấp nhận, không gửi OTP lại. Các factory khác có thể dùng chung registry này. Không deploy registry riêng cho từng round/factory vì sẽ chia tách danh tính.

`Deploy.s.sol` chỉ dành cho cài đặt mới hoàn toàn: nó deploy MockUSDC + StudentRegistry + RoundFactory. Không dùng nó khi mục tiêu là tái sử dụng token/registry hiện có.

## 5. Vercel và vận hành

Thêm `NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS`, địa chỉ factory mới cùng các env server hiện có vào đúng environment Vercel, rồi redeploy để public env được build lại. Khóa attester của môi trường đó phải suy ra đúng attester on-chain. Không gửi bất kỳ secret nào lên client.

EIP-712 domain mới là `{ name: 'SqrtFundStudentRegistry', version: '1', chainId: 43113, verifyingContract: registry }`; proof cũ của QFRound không dùng được. `confirm` trả `{ registryAddress, chainId, emailHash, expiry, signature }`; frontend kiểm tra target trước khi gửi giao dịch. Đổi registry trong lúc OTP còn hiệu lực trả `REGISTRY_CHANGED` và yêu cầu mã mới.

Xoay khóa attester bằng **owner của registry**, không qua từng round/factory:

```bash
# ATTESTER_ADDRESS is the public address matching the new backend signing key.
cast send "$STUDENT_REGISTRY_ADDRESS" 'setAttester(address)' "$ATTESTER_ADDRESS" \
  --rpc-url "$RPC" --account sqrt-fund-deployer --sender "$DEPLOYER_ADDRESS"
```

Cập nhật khóa backend đồng bộ. Student đã xác thực vẫn giữ trạng thái; chỉ proof chưa dùng từ signer cũ mất hiệu lực. Không cần redeploy registry chỉ để xoay khóa.

Các lỗi cấu hình còn lại:

| Mã | Ý nghĩa |
| --- | --- |
| `CONFIG_MISSING` | Thiếu/cấu hình sai biến; response chỉ liệt kê tên biến |
| `DB_SCHEMA_MISMATCH` | Thiếu bảng/cột/RPC; reset project rỗng rồi chạy migration duy nhất |
| `REGISTRY_UNAVAILABLE` | RPC lỗi, địa chỉ registry sai hoặc attester backend/on-chain lệch |
| `REGISTRY_CHANGED` | OTP được cấp cho deployment registry khác |
| `EMAIL_SEND_FAILED` | SMTP/provider từ chối hoặc timeout; xem diagnostic stage mail |
| `ALREADY_VERIFIED` | Cùng ví/email đã xác nhận ở DB; trả proof mới, không gửi mail, tiếp tục giao dịch ví |
| `EMAIL_ALREADY_USED` / `WALLET_ALREADY_VERIFIED` | Email hoặc ví đã gắn với danh tính khác |
| `SERVICE_UNAVAILABLE` | Lỗi dịch vụ khác; xem diagnostic có giới hạn, không chứa dữ liệu OTP |

Các API xác thực chỉ dùng registry. Contract không còn hàm admin cấp Student thủ công; `isWhitelisted` chỉ là view tương thích đọc `studentRegistry.isStudent`, không phải danh sách quyền riêng của round.

## 6. Kiểm tra mail và API sau khi cấu hình

Cấu hình Gmail như README: bật 2FA, App Password 16 ký tự viết liền, `SMTP_FROM` khớp `SMTP_USER`, cổng 587. Kiểm tra đúng mailer mà API sử dụng:

```bash
node --conditions=react-server --env-file=.env.local --experimental-strip-types scripts/test-mail.ts student@your-school.edu.vn
```

Thay email mẫu bằng hộp thư bạn kiểm soát. Lệnh này gửi mail thật nhưng không tạo OTP trong DB; mã trong mail test không dùng để xác thực tài khoản.

Sau khi restart `pnpm dev`, dùng ví và email trường của bạn:

```bash
curl -sS http://localhost:3000/api/verify/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"student@your-school.edu.vn","address":"0xYOUR_STUDENT_WALLET"}'
curl -sS http://localhost:3000/api/verify/confirm \
  -H 'Content-Type: application/json' \
  -d '{"requestId":"UUID_FROM_REQUEST","otp":"SIX_DIGITS_FROM_EMAIL"}'
```

Thay các placeholder trước khi chạy; không đăng mã thực tế lên Git/chat. Response confirm chứa proof, chưa có nghĩa ví đã là Student: mở `/verify` để UI gọi `verifyStudent` và đợi receipt thành công. Kiểm tra `isStudent` bằng `cast call` như bước 3; tạo hai round mới để chứng minh danh tính dùng chung và ngân sách độc lập.
