# Admin USDC balance fix — 17/10/2026

Nguyên nhân: form nạp pool phụ thuộc `round.token()`, trong khi menu ví đọc token cấu hình. Khi factory chưa có round, balance query của form bị disabled, `undefined` bị đổi thành `0n`, rồi validation báo vượt số dư. Invalidate sau mint đã có nhưng không thể làm query thiếu token chạy được. Không có bằng chứng đây là lỗi mint hoặc cache key khi cùng token/chain/wallet.

## Chẩn đoán trước sửa

Số dòng dưới đây theo bản trước sửa; các link mở bản đã sửa.

| Component | Token / balanceOf trước sửa | Refetch sau mint |
| --- | --- | --- |
| [DepositPoolForm](../src/components/admin/DepositPoolForm.tsx) | `useRound().token`; `useReadContract`, không ghim chain trực tiếp (dòng 38–49); `undefined ?? 0n` (51), parse với balance (54) | Poll 5s, global invalidate, refetch riêng sau deposit; query disabled nếu không có token |
| [MintTestUsdcForm](../src/components/admin/MintTestUsdcForm.tsx) | Mint/owner qua `usdcAddress`; chưa hiển thị balance (dòng 36,96) | `invalidateQueries()` sau receipt thành công (125) |
| [ConnectWalletButton](../src/components/layout/ConnectWalletButton.tsx) | `usdcAddress` từ addresses.ts; balanceOf Fuji, poll 30s (63–65) | Nhận global invalidate từ mint |
| [DonateBox](../src/components/project/DonateBox.tsx) | `round.token`, balanceOf poll 5s; thiếu dữ liệu → 0 (71–84) | Nhận global invalidate |
| [BatchDonationForm](../src/components/project/BatchDonationForm.tsx) | `round.token`, balanceOf poll 15s (29) | Nhận global invalidate |
| [useDonate](../src/hooks/useDonate.ts) | Đọc balance/allowance trực tiếp trên token của round trước khi gửi | Đọc lại trực tiếp khi execute |

[useRound](../src/hooks/useRound.ts) chọn `allRounds.at(-1)` (trước sửa dòng 35–36). Danh sách rỗng → không có round/token (token ở dòng 49); form chưa có trạng thái “chưa có round”. [addresses.ts](../src/lib/contracts/addresses.ts) là nguồn duy nhất của địa chỉ USDC/factory cấu hình. Không đọc/in/sửa giá trị môi trường để chẩn đoán.

Thông tin 1.100 USDC ở token `0xFf56491e29085043DbB11cd01D54cC1449A3d686` và factory `0xbC077E28826D0738E56491800bdb8D5725F9e5b3` rỗng do người dùng cung cấp; phiên fix này không chạy lại cast và không tự sửa cấu hình theo địa chỉ đó.

## Kiểm kê hardcode

Tìm literal địa chỉ trong `src`, bỏ ABI: không có địa chỉ USDC/factory deployment hardcode trong luồng runtime. Các literal còn lại:

- [addresses.ts](../src/lib/contracts/addresses.ts): hằng `ZERO_ADDRESS`.
- [useRound.ts](../src/hooks/useRound.ts): so sánh zero-address khi nhận custom round.
- [ProjectForm.tsx](../src/components/project/ProjectForm.tsx): zero-address fallback cho owner.
- [leaderboard-preview.tsx](../src/views/leaderboard-preview.tsx): 1 account giả và 4 round giả cho preview.

`rg` không tìm literal địa chỉ trong `scripts` và `contracts/script`. Manifest, docs, evidence và test fixtures có địa chỉ lịch sử/giả; chúng không phải nguồn token của các component runtime. Không đổi contract hoặc manifest trong tác vụ này.

## Thay đổi

- [useTokenBalance.ts](../src/hooks/useTokenBalance.ts) dùng token từ addresses.ts, public client Fuji, query key chung gồm chain/token/wallet chuẩn hóa chữ thường. `balance` là undefined nếu chưa đọc thành công, sai mạng, disconnect hoặc lỗi; zero thật giữ nguyên `0n`.
- [tokenBalance.ts](../src/lib/tokenBalance.ts) chứa query options và invalidation chung. Sau receipt thành công, [useTxFlow](../src/hooks/useTxFlow.ts) yêu cầu [TransactionFlow](../src/lib/txToast.ts) invalidate/refetch các balance đang mounted. Bao phủ mint/faucet, deposit, donate/batch, claim và refund. Receipt reverted hoặc hash chưa mined không kích hoạt cơ chế này; query inactive được đánh dấu stale.
- [useAdminRounds.ts](../src/hooks/useAdminRounds.ts) đọc danh sách từ factory, kiểm admin của từng round, sắp mới nhất trước; mặc định chọn round mới nhất của wallet hiện tại. Dropdown cho phép đổi; lựa chọn thủ công được giữ nếu còn hợp lệ. Factory RPC error được tách khỏi empty list; lỗi `name()` có thể fallback địa chỉ, lỗi `admin()` không bị coi như empty list.
- Form pool có thông báo VI/EN: chưa có round, không có round thuộc admin, loading, lỗi đọc/retry, round cancelled và token mismatch. Chỉ dùng balance thành công để báo vượt số dư. Dropdown, Max, input và confirm bị chặn khi trạng thái không hợp lệ.
- Menu, mint recipient, pool, DonateBox và batch dùng chung hook; approve/preflight dùng token cấu hình. Nếu round dùng token khác, deposit/donate bị chặn thay vì approve nhầm token. Không giả định mọi round cũ đều dùng token mới.

## Files sửa/thêm

| Nhóm | Files |
| --- | --- |
| Hook/query mới | [useTokenBalance.ts](../src/hooks/useTokenBalance.ts), [useAdminRounds.ts](../src/hooks/useAdminRounds.ts), [tokenBalance.ts](../src/lib/tokenBalance.ts) |
| Luồng receipt/factory/donate | [useTxFlow.ts](../src/hooks/useTxFlow.ts), [txToast.ts](../src/lib/txToast.ts), [useRound.ts](../src/hooks/useRound.ts), [useDonate.ts](../src/hooks/useDonate.ts) |
| Component | [DepositPoolForm.tsx](../src/components/admin/DepositPoolForm.tsx), [MintTestUsdcForm.tsx](../src/components/admin/MintTestUsdcForm.tsx), [ConnectWalletButton.tsx](../src/components/layout/ConnectWalletButton.tsx), [DonateBox.tsx](../src/components/project/DonateBox.tsx), [BatchDonationForm.tsx](../src/components/project/BatchDonationForm.tsx) |
| Copy | [copy.ts](../src/lib/copy.ts) |
| Test mới | [token-balance.test.ts](../__tests__/token-balance.test.ts), [deposit-pool-balance.test.ts](../__tests__/deposit-pool-balance.test.ts), [admin-round-selection.test.ts](../__tests__/admin-round-selection.test.ts) |
| Báo cáo/log | Tài liệu này và [evidence](evidence/admin-balance-2026-10-17/) |

## Kiểm tra đã chạy

| Lệnh | Kết quả |
| --- | --- |
| `pnpm tsc --noEmit` | Exit 0 — [log](evidence/admin-balance-2026-10-17/tsc.log) |
| `pnpm test` | Exit 0; **250 passed / 13 skipped**, 31 file passed / 2 skipped — [log](evidence/admin-balance-2026-10-17/test.log) |
| `pnpm build` | Exit 0; compiled, type check, generate pages thành công — [log](evidence/admin-balance-2026-10-17/build.log) |

Build có warning dependency động `ox/tempo` đã có trước thay đổi. 13 integration test vẫn skip theo cơ chế opt-in môi trường test riêng của repo.

19 test mới kiểm tra invalidation/refetch qua QueryClient/QueryObserver thật sau receipt success, không refetch trước mining/reverted, trạng thái balance loading/error/zero, render form với số tiền nhập sẵn, không có round (VI/EN), token mismatch và round thuộc admin. Component được render SSR với hook dependencies giả lập; chưa phải kiểm thử DOM tương tác/Core/on-chain thực tế. Không gửi giao dịch hoặc deploy.

## Người dùng cần làm

1. Restart dev server nếu đổi public env; các địa chỉ `NEXT_PUBLIC_*` được nạp khi chạy/build frontend. Tự xác nhận cấu hình USDC/factory/registry đúng bộ deployment, không gửi secret vào chat.
2. Nếu đổi env Vercel: tự Redeploy và **bỏ tick Use existing Build Cache** để build lại public env; phiên này không deploy.
3. Với factory rỗng, tạo round bằng ví admin trước; sau khi tạo, form đọc lại danh sách và chọn round mới nhất thuộc admin. Mint token không tự tạo round.
4. Trên Fuji, kiểm tra menu và form cùng số dư; mint cho chính ví/recipient khác, deposit, donate, claim/refund rồi quan sát cập nhật mà không reload. Thử chuyển round, lỗi RPC, sai mạng. Chưa có bằng chứng browser/Core thật từ phiên fix này.
