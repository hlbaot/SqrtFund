# Lỗi /round và chuyển sang factory có StudentRegistry

## A. Chẩn đoán trước khi sửa (17/10/2026)

Không đọc/sửa `.env.local`, không dùng khóa, không deploy hay ghi chain. RPC kiểm tra: `https://api.avax-test.network/ext/bc/C/rpc`.

Factory được nêu trong triệu chứng là `0x77015FBa44D3885C25E421f59Ae5C3a5bA87AF4A`. `getRounds()` trả `[0x340618b437F0314f136d5dB2228C13db61F7a7cc]`; `roundCount()` kiểm tra bổ sung trả 1; `owner()` trả `0x3fbF96fA6B3643c89D38eC1588c38912503f2b88`. `studentRegistry()` trên factory cũ revert `0x`.

### Từng getter trên round cũ

Các getter dưới đây dùng `qfRoundAbi` từ `src/lib/contracts/abis/qfRound.ts`. `useRound` trước sửa đọc 15 getter đầu; `useProjects` đọc hai getter dự án. `useRole` đọc registry khi có ví kết nối; chẩn đoán cũng gọi getter này dù không cần private key.

| Hàm | Kết quả cast thật | Nghi vấn |
| --- | --- | --- |
| `admin()` | `0x3fbF96fA6B3643c89D38eC1588c38912503f2b88` | Thành công |
| `token()` | `0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205` | Thành công |
| `startTime()` | `1791958740` | Thành công |
| `endTime()` | `1791964200` | Thành công |
| `minDonation()` | `1000000` | Thành công |
| `maxDonation()` | `5000000` | Thành công |
| `maxMatchBps()` | `3000` | Thành công |
| `pool()` | `0` | Thành công |
| `finalized()` | `true` | Thành công |
| `leftover()` | `0` | Thành công |
| `leftoverWithdrawn()` | `false` | Thành công |
| `projectCount()` | `1` | Thành công |
| `name()` | execution reverted, data `0x` | Getter không được deployment cũ hỗ trợ |
| `organizer()` | execution reverted, data `0x` | Getter không được deployment cũ hỗ trợ |
| `maxPerRound()` | execution reverted, data `0x` | Getter mới bị coi là bắt buộc, gây lỗi round |
| `getProjects(0,50)` | 1 dự án, approved/claimed đều true, totalDonated 10000000, donorCount 2; nextOffset 1 | Thành công, ABI tuple giải mã được |
| `previewMatching()` | projectIds `[1]`, payouts `[0]` | Thành công |
| `studentRegistry()` | execution reverted, data `0x` | Không hỗ trợ danh tính global |

Ví dụ lặp lại lệnh chỉ đọc:

```bash
export RPC=https://api.avax-test.network/ext/bc/C/rpc
export OLD_FACTORY=0x77015FBa44D3885C25E421f59Ae5C3a5bA87AF4A
export OLD_ROUND=0x340618b437F0314f136d5dB2228C13db61F7a7cc
cast call "$OLD_FACTORY" 'getRounds()(address[])' --rpc-url "$RPC"
cast call "$OLD_ROUND" 'admin()(address)' --rpc-url "$RPC"
cast call "$OLD_ROUND" 'maxPerRound()(uint256)' --rpc-url "$RPC"
cast call "$OLD_ROUND" 'studentRegistry()(address)' --rpc-url "$RPC"
```

ABI hiện tại khớp Solidity/artifacts trong repo, có `name`, `organizer`, `maxPerRound`, `studentRegistry`; round cũ không đáp ứng các getter đó. Không thể thêm hàm vào bytecode cũ bằng thay ABI hoặc env.

### Vì sao danh sách sập, nhưng tab vẫn đếm được?

Trước sửa, `src/hooks/useRound.ts:138` OR mọi lỗi core và riêng index 14 (`maxPerRound`) thành `isError`. `src/views/rounds.tsx:46` OR lỗi của mọi entry; dòng 49 truyền trạng thái error cho toàn `RoundsList`. Tại `src/components/rounds/RoundsList.tsx`, nhánh error thay cả grid bằng PresentationState; counts vẫn tính từ các summary đã có. UI thực tế lấy danh sách từ `getRounds()`, không trực tiếp dùng `roundCount()` để vẽ tab.

Wagmi `readContracts`/viem multicall đã mặc định `allowFailure=true`; lỗi không phải do thiếu Promise.allSettled trong thư viện. Việc ứng dụng gom cờ lỗi làm mất toàn bộ giao diện là lỗi xử lý kết quả. `name`/`organizer` trước đó vốn tùy chọn; `maxPerRound` mới là getter làm `isError` thành true trong ca này.

### Số lượt đọc và RPC

- Factory: 2 getter `getRounds`, `owner` dùng `roundFactoryAbi`.
- Mỗi round: 15 getter chi tiết + `getProjects(0,50)` + `previewMatching` = 17 lượt contract logic. N round: `2 + 17N`, nên N=1 là 19 lượt. Hook trùng ở Navbar/role/notification có cùng query key và được cache/deduplicate.
- Khi nối ví Fuji, có thêm registry `isStudent`, round `studentRegistry`, token `balanceOf` và 5 getter faucet (`lastFaucetMint`, `FAUCET_COOLDOWN`, `lifetimeMinted`, `FAUCET_AMOUNT`, `LIFETIME_CAP`), không phải mỗi round đều đọc faucet. Ngoài ra có native balance, block number và getBlock để hiệu chỉnh đồng hồ; getBlock có thể lặp ở nhiều useClaim instance.
- 19 lượt logic không đồng nghĩa 19 HTTP request: có 3 nhóm multicall (factory/details/projects) cho N=1, có thể tách/gộp theo scheduler và giới hạn calldata. Chưa ghi trace trình duyệt trước sửa nên không khẳng định số HTTP tuyệt đối.
- Trước sửa: một HTTP transport, chưa bật HTTP JSON-RPC batch và chưa có fallback env. Query round/project poll 5 giây; projects còn refetch theo mỗi block. Viem transport mặc định retryCount=3/retryDelay=150ms; TanStack browser có retry/backoff mặc định, không cấu hình riêng tại các hook này.
- Các lệnh cast chẩn đoán chạy thành công hoặc trả execution reverted; không ghi nhận HTTP 429. Không có bằng chứng RPC rate limit là nguyên nhân gốc, dù polling trùng có thể tạo thêm tải.

**Kết luận:** (a) deployment cũ không tương thích ABI mới là tác nhân trực tiếp; (c) gom lỗi ở code làm lỗi lan thành cả danh sách. Chưa có bằng chứng cho (b) RPC giới hạn.

### Deployment mới đã có trong manifest

Không do agent deploy trong lần sửa này. `contracts/deployments/fuji.json` hiện đã chứa:

- Factory `0x4fb01ae390bD9F46Dd921e5aC5D99c17912074D8`.
- Registry `0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e`.
- MockUSDC `0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205`.

Đọc chain thật: factory mới `studentRegistry()` khớp registry, `getRounds()` là `[]`, `roundCount()` là 0, owner vẫn `0x3fbF96fA6B3643c89D38eC1588c38912503f2b88`. Runtime dài 12860 byte và có selector `0x59a86aa8` của `createRound(string,string,address,uint256,uint256,uint256,uint256,uint256,uint256)`. Registry `attester()` trả `0x5C2001c91aEFFaEDf9ef438cA50Bcddd23ce6181` đúng địa chỉ yêu cầu. Đây là bằng chứng hỗ trợ tái sử dụng factory mới; chưa có round mới để kiểm tra giao dịch tạo round/donate.

## B. Sửa giao diện/đọc dữ liệu

- Loader `src/lib/contracts/roundReads.ts` probe `studentRegistry`, cache capability cho địa chỉ round bất biến. Getter revert/no data được phân biệt với lỗi RPC. Round cũ chỉ đọc 12 getter core; bỏ các getter metadata/ngân sách mới.
- Multicall cho phép lỗi từng trường. Metadata tùy chọn không chặn dữ liệu core; lỗi core/dự án chỉ hiện thẻ lỗi có địa chỉ round. Revert/no data có thông báo contract không khớp và nhãn phiên bản cũ; RPC lỗi không bị gán nhầm là legacy.
- `useFactoryRounds` tách discovery khỏi lỗi round mới nhất. `RoundsView` không OR lỗi từng round thành lỗi toàn trang; round thành công được hiển thị ngay khi xong. Round lỗi chưa rõ trạng thái không được tính nhầm vào số round đã kết thúc.
- `useRole` dùng registry từ capability đã đọc, bỏ getter trùng. Round cũ không được coi là hỗ trợ quyền Student dùng chung.
- Round/project/factory poll 15 giây; bỏ refetch project theo từng block. Retry query 2 lần, backoff 750/1500ms (trần 3000ms); transport retry 2 lần, delay cơ sở 750ms, timeout 10 giây. HTTP JSON-RPC batch: đợi 20ms, tối đa 10 request/batch. `NEXT_PUBLIC_RPC_URL_FALLBACK` tùy chọn; chỉ dùng URL Fuji công khai không chứa credential bí mật.
- Diagnostic chỉ in address/functionName/kind, không in raw provider error/URL có thể mang credential; tránh lặp cùng lỗi khi polling.

Với round cũ đã nhận diện, phần danh sách cần factory 2 + core 12 + projects 2 = 16 lượt logic ở các chu kỳ sau, thêm 1 capability probe cho lần đầu. Với round mới: 2 + 15 + 2 = 19 lượt, thêm 1 probe lần đầu. Đây là số lượt contract logic cho một round, không phải đo số HTTP trong trình duyệt.

## C. Bạn tự thực hiện: ưu tiên factory đã có

### 1. Kiểm tra địa chỉ công khai trước

Từ thư mục gốc:

```bash
export RPC=https://api.avax-test.network/ext/bc/C/rpc
export ATTESTER_ADDRESS=0x5C2001c91aEFFaEDf9ef438cA50Bcddd23ce6181
export STUDENT_REGISTRY_ADDRESS=0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e
export FACTORY=0x4fb01ae390bD9F46Dd921e5aC5D99c17912074D8
export USDC=0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205
cast call "$FACTORY" 'studentRegistry()(address)' --rpc-url "$RPC"
cast call "$FACTORY" 'owner()(address)' --rpc-url "$RPC"
cast call "$FACTORY" 'getRounds()(address[])' --rpc-url "$RPC"
cast call "$STUDENT_REGISTRY_ADDRESS" 'attester()(address)' --rpc-url "$RPC"
```

Nếu các địa chỉ đúng như trên, dùng factory này rồi sang bước 3. Danh sách rỗng hiện tại là trạng thái hợp lệ, cần admin tạo round đầu tiên.

### 2. Chỉ khi bạn muốn deploy một factory khác

`RoundFactory` constructor chỉ nhận **một address registry**. Không truyền USDC hay attester vào constructor; token được truyền khi `createRound`, attester nằm trên registry. `DeployFactory.s.sol` đọc `STUDENT_REGISTRY_ADDRESS`, lấy MockUSDC có sẵn từ manifest, và ghi manifest factory/registry mới sau khi chạy. `ATTESTER_ADDRESS` ở đây dùng kiểm tra registry, không phải biến script deploy factory tiêu thụ.

Dùng keystore đã có tên `deployer`; không nhập private key vào command line:

```bash
forge test --root contracts
export DEPLOYER_ADDRESS="$(cast wallet address --account deployer)"
cd contracts
forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url "$RPC" --chain-id 43113 \
  --account deployer --sender "$DEPLOYER_ADDRESS" --broadcast
cd ..
```

Sau broadcast thành công, đọc địa chỉ thật từ transaction/manifest. Không dùng địa chỉ từ simulation thất bại. Đặt `FACTORY` thành địa chỉ vừa deploy, kiểm tra code và registry/owner trên chain:

```bash
export FACTORY="$(node --input-type=module -e "import fs from 'node:fs'; console.log(JSON.parse(fs.readFileSync('contracts/deployments/fuji.json','utf8')).roundFactory)")"
cast code "$FACTORY" --rpc-url "$RPC"
cast call "$FACTORY" 'studentRegistry()(address)' --rpc-url "$RPC"
cast call "$FACTORY" 'owner()(address)' --rpc-url "$RPC"
node scripts/sync-abis.mjs
```

Không cần deploy registry/token khác cho lỗi này. Nếu muốn thay token/registry, đó là một lựa chọn khác cần quyết định riêng.

### 3. Cập nhật public env, manifest và README

Bạn tự sửa **chỉ các địa chỉ công khai** trong `.env.local`; không chia sẻ secret:

```dotenv
NEXT_PUBLIC_FACTORY_ADDRESS=0x4fb01ae390bD9F46Dd921e5aC5D99c17912074D8
NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS=0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e
NEXT_PUBLIC_USDC_ADDRESS=0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205
NEXT_PUBLIC_RPC_URL_FALLBACK=
```

Nếu bạn deploy factory khác ở bước 2 thì thay địa chỉ factory bằng kết quả broadcast mới. Fallback để trống vẫn hoạt động; nếu điền phải là RPC Fuji 43113, URL được công khai trong browser.

Đối chiếu/cập nhật `contracts/deployments/fuji.json` và bảng deployment README theo địa chỉ thật. Manifest hiện có đã đúng factory mới, agent không ghi đè nó. Dừng dev server của bạn rồi chạy lại `pnpm dev` để nạp public env.

Trong Vercel, cập nhật `NEXT_PUBLIC_FACTORY_ADDRESS`, registry/token và fallback nếu dùng ở đúng Production/Preview environment. Chọn Redeploy và **bỏ tick dùng Build Cache** theo yêu cầu. Public env được nhúng lúc build; đổi env mà chưa redeploy không thay bundle đang chạy.

### 4. Admin tạo dữ liệu thử

1. Kết nối ví factory owner trên Fuji, vào `/admin`, tạo round có `minDonation <= maxDonation <= maxPerRound`, ví dụ 1 / 5 / 10 USDC. Chọn start/end phù hợp thời điểm kiểm tra.
2. Lấy địa chỉ round từ receipt hoặc `getRounds`. Kiểm tra `studentRegistry`, `maxPerRound` và `admin` trên round mới.
3. Mint MockUSDC cho admin (chỉ token owner được mint) hoặc dùng faucet. Ví dụ dưới đây mint 1000 MockUSDC; lệnh do bạn tự chạy bằng keystore, chỉ khi owner trùng:

```bash
export DEPLOYER_ADDRESS="$(cast wallet address --account deployer)"
cast call "$USDC" 'owner()(address)' --rpc-url "$RPC"
# Chỉ chạy nếu deployer là owner của MockUSDC:
cast send "$USDC" 'mint(address,uint256)' "$DEPLOYER_ADDRESS" 1000000000 \
  --rpc-url "$RPC" --account deployer --sender "$DEPLOYER_ADDRESS"
```

4. Trên Admin, approve token và `depositPool` (ví dụ 100 USDC). Nếu muốn dùng CLI, đặt ROUND bằng địa chỉ mới thật rồi chạy:

```bash
export ROUND=0xYOUR_NEW_ROUND
cast call "$ROUND" 'studentRegistry()(address)' --rpc-url "$RPC"
cast call "$ROUND" 'admin()(address)' --rpc-url "$RPC"
cast call "$ROUND" 'maxPerRound()(uint256)' --rpc-url "$RPC"
cast send "$USDC" 'approve(address,uint256)' "$ROUND" 100000000 \
  --rpc-url "$RPC" --account deployer --sender "$DEPLOYER_ADDRESS"
cast send "$ROUND" 'depositPool(uint256)' 100000000 \
  --rpc-url "$RPC" --account deployer --sender "$DEPLOYER_ADDRESS"
```

5. Sinh viên xác thực tại `/verify`, đăng ký dự án `/register`; admin duyệt dự án mới. Quyền duyệt dự án không cấp Student. Sinh viên khác lấy MockUSDC từ faucet `/my` và donate thử. Chủ dự án không tự donate. Để thấy raw matching tăng cần nhiều ví Student khác nhau ủng hộ, không chỉ chia nhỏ giao dịch từ một ví.
6. Mở `/round`: round mới đọc đủ dữ liệu; nếu cấu hình về factory cũ để xem lịch sử thì round cũ có nhãn phiên bản cũ, không làm sập danh sách. Agent không tạo round, mint, deposit hay gửi email thử thay bạn.

## D. Kiểm thử và giới hạn xác nhận

Các test Vitest mới ở `__tests__/round-loading.test.ts`, `__tests__/rpc-transport.test.ts` bao phủ lỗi từng trường/từng round, legacy getter không được gọi lại, phân biệt mạng/revert, render thẻ lỗi cùng round lành, log không lộ URL, batching và fallback/backoff.

Test RPC tùy chọn chỉ đọc:

```bash
RUN_ROUND_RPC_INTEGRATION=1 pnpm vitest run __tests__/round-rpc.integration.test.ts
```

Test này đã chạy thành công với round cũ bằng loader thật. Bộ test mặc định bỏ qua test mạng này và 12 test Supabase DEV; không sửa dữ liệu thật. Chưa kiểm chứng round mới do factory mới chưa có round; chưa truy cập deployment Vercel của bạn hoặc chạy giao dịch bằng ví thật. Chưa có browser trace trước sửa để đo request thực tế. Kết quả: `pnpm tsc --noEmit`, `pnpm lint`, `pnpm build` đều exit 0; `RUN_VERIFICATION_INTEGRATION=0 pnpm test` có 204 pass, 13 skip (25 file pass, 2 file skip). Test RPC chỉ đọc chạy riêng có 1 pass. Build còn warning dependency ox/viem.

## E. Tệp đã sửa/tạo

| Tệp | Thay đổi |
| --- | --- |
| `src/lib/contracts/roundReads.ts` | Loader capability, multicall từng trường, log an toàn, retry policy |
| `src/lib/contracts/rpc.ts` | HTTP batch và optional fallback Fuji |
| `src/lib/wagmi.ts` | Dùng transport mới |
| `src/hooks/useRound.ts` | Tách discovery, cache dữ liệu từng round, bỏ getter mới trên legacy |
| `src/hooks/useProjects.ts` | allowFailure tường minh, polling 15s, bỏ refetch mỗi block, diagnostic |
| `src/hooks/useRole.ts` | Tái sử dụng registry đã probe, bỏ query trùng |
| `src/views/rounds.tsx` | Cô lập trạng thái mỗi round; Retry cả metadata/projects |
| `src/components/rounds/RoundsList.tsx` | Thẻ lỗi địa chỉ cụ thể, nhãn legacy, giữ các thẻ tốt |
| `src/components/leaderboard/model.ts` | Metadata version/readError tùy chọn cho summary |
| `src/lib/copy.ts` | Thông báo EN/VI cho lỗi round/phiên bản |
| `__tests__/round-loading.test.ts` | Loader và render danh sách bị lỗi một phần |
| `__tests__/rpc-transport.test.ts` | Batch, primary retry và fallback |
| `__tests__/round-rpc.integration.test.ts` | Test opt-in, chỉ đọc Fuji qua loader/transport thật |
| `.env.example` | NEXT_PUBLIC_RPC_URL_FALLBACK tùy chọn |
| `docs/round-loading-fuji.md` | Chẩn đoán, kết quả cast và lệnh để người dùng tự chạy |
| `docs/redeploy-fuji.md` | Dẫn tới deployment mới hiện có trước khi deploy thêm |
| `docs/change-report.md` | Đồng bộ trạng thái deployment và kết quả kiểm tra |
| `README.md` | Địa chỉ thật mới, fallback env, hướng dẫn /round và test mới |

Không xóa tệp, không sửa Solidity/ABI hoặc ghi đè thay đổi manifest có sẵn trong lần sửa này.
