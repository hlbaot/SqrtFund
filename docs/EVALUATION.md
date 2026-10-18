# Evaluation Criteria Self-Assessment

Vòng online chấm Technical Implementation và Avalanche Integration (50 điểm), nên hai mục này đặt lên đầu và chi tiết nhất. Trọng số dưới đây lấy từ yêu cầu đánh giá của chủ dự án; không tự gán điểm. **Strong / Partial / Missing** mô tả mức bằng chứng, không phải điểm của giám khảo. Strong: có bằng chứng trực tiếp cho claim giới hạn rõ; Partial: có một phần nhưng thiếu triển khai/kiểm chứng; Missing: chưa có bằng chứng.

| Tiêu chí | Trọng số | Status | Bằng chứng chính | Gap lớn nhất |
| --- | ---: | --- | --- | --- |
| Technical Implementation | Online 25 | **Strong** | [Test, invariant, gas](#technical-implementation) | Chưa audit; fuzz có miền hữu hạn |
| Avalanche Integration | Online 25 | **Partial** | [RPC, deployment, wallet, phí](#avalanche-integration) | Factory/token không khớp artifact; factory chưa có round |
| Creativity & Innovation | Finals 15 | **Strong** | [QF + student identity](#creativity-innovation) | Chưa chống nhiều email/người và collusion |
| Impact & Use Case | Finals 15 | **Partial** | [Quy trình CLB](#impact-use-case) | Chưa có pilot CLB; demo end-to-end chưa xác nhận |
| Presentation & Pitching | Finals 10 | **Partial** | [Ví dụ chạy bằng code và pitch](#presentation-pitching) | Slide và video: **Not done** |
| UI/UX & Demo | Finals 10 | **Partial** | [Input preview, fee, OTP](#ui-ux-demo) | Có code/test nhưng chưa kiểm thử trình duyệt + Core + email thật |

**Bổ sung source — từ chối dự án:** Admin round có `rejectProject`, event và trạng thái rejected cuối tuple; giữ quota và không có lý do on-chain. Source có UI xác nhận, toast receipt, nhãn cho admin/chủ dự án; chưa deploy hoặc demo Fuji tính năng này. Xem [test và hướng dẫn triển khai thủ công](project-rejection.md). Các số liệu/snapshot dưới đây là bằng chứng lịch sử, không phải benchmark của bản thay đổi này.

Ngày kiểm tra: **17/10/2026, Asia/Ho_Chi_Minh**. Snapshot workspace có thay đổi chưa commit, base commit `23d264873ccdf7e49b368895972fceccc207f92e`; kết quả không đại diện riêng cho commit đó. Không đọc/in/sửa giá trị bí mật trong `.env.local`, không deploy, không gửi giao dịch hoặc email. Build Next.js dùng cơ chế nạp môi trường sẵn có; không trích xuất môi trường vào báo cáo. Không thêm tính năng sản phẩm trong tác vụ này.

<a id="evidence-run"></a>
## Evidence run — kết quả thật

Chạy từ root repo, trừ lệnh `forge` chạy trong `contracts`. [Thư mục log](evidence/2026-10-17/) lưu kết quả của lần kiểm tra này.

| Lệnh đã chạy | Kết quả | Bằng chứng |
| --- | --- | --- |
| `cd contracts && forge test` | **113 pass, 0 fail, 0 skip**, 4 suite | [forge-test.log](evidence/2026-10-17/forge-test.log) |
| `cd contracts && forge test --gas-report` | **113 pass**, có bảng gas theo hàm | [gas-report.log](evidence/2026-10-17/gas-report.log) |
| `cd contracts && forge test --match-test test_GasFinalizeExactly50Projects -vv` | Pass; phạm vi call **1,583,871 gas** | [finalize50.log](evidence/2026-10-17/finalize50.log) |
| `pnpm test` | **231 pass, 13 skip**, 28 file pass / 2 file skip | [pnpm-test.log](evidence/2026-10-17/pnpm-test.log) |
| `pnpm tsc --noEmit` | Lần đầu lỗi TS6053 khi build đồng thời thay `.next/types`; chạy lại sau build **exit 0** | [Lần đầu](evidence/2026-10-17/tsc.log), [chạy lại](evidence/2026-10-17/tsc-rerun.log) |
| `pnpm build` | **Exit 0**, compiled và tạo routes; có warning dependency động `ox/tempo` | [build.log](evidence/2026-10-17/build.log) |
| `python3 docs/evidence/2026-10-17/verify-fuji.py` | Read-only `cast`: chain 43113, có bytecode cả 3 địa chỉ; factory rounds rỗng | [fuji-pinned.json](evidence/2026-10-17/fuji-pinned.json) |

Foundry **1.8.5**, Solidity **0.8.24**, optimizer 200, `via_ir = true` theo [foundry.toml](../contracts/foundry.toml); pnpm **11.20.0**. Foundry có warning không ghi được signature cache ngoài sandbox; test vẫn pass. `forge test` có suite kế thừa `QFRoundTest`: 27 + 40 + 45 + 1 = 113 lượt test, **không phải 113 test logic độc lập**. Không chạy `tsc` đồng thời với build khi tái lập.

13 skip gồm 12 Supabase integration cần bật opt-in và DB test riêng trong [email-otp.integration.test.ts](../__tests__/email-otp.integration.test.ts), 1 RPC integration cần opt-in trong [round-rpc.integration.test.ts](../__tests__/round-rpc.integration.test.ts). Không coi skip là pass; kiểm tra `cast` riêng không thay thế toàn bộ integration suite.

### Kiểm chứng độc lập trên snapshot không có file môi trường

Một lần chạy bổ sung bắt đầu khoảng **18:07 ngày 17/10/2026** đã kiểm tra lại bản source trong thư mục tạm, loại toàn bộ `.env*`, `.git`, `.next`, `broadcast`, `out`, `cache`; không nạp `.env.local`. Dependencies đang cài được dùng qua symlink. [187 dấu vân tay SHA-256](evidence/2026-10-17/independent-1807/source-sha256.json) của source/test/config/manifest đã đối chiếu với workspace và không khác tại lúc đóng gói. Không gồm README/docs đang được cập nhật đồng thời. Đây là lần chạy riêng, không thay hoặc gộp các log ở bảng trên.

| Lệnh thực thi trong snapshot | Kết quả độc lập | Log |
| --- | --- | --- |
| `cd contracts && forge test` | 113 pass, 0 fail, 0 skip; fuzz 256 runs mỗi lần; invariant 256 runs / 128000 calls / 0 reverts | [forge-test.txt](evidence/2026-10-17/independent-1807/forge-test.txt) |
| `cd contracts && forge test --gas-report` | 113 pass; số avg/calls khác lần chạy trên do fuzz | [forge-gas-report.txt](evidence/2026-10-17/independent-1807/forge-gas-report.txt) |
| `cd contracts && forge test --match-test test_GasFinalizeExactly50Projects -vv` | 1 pass; cold external call finalize 50 = **1,583,871 gas** | [finalize-50.txt](evidence/2026-10-17/independent-1807/finalize-50.txt) |
| `pnpm --config.verify-deps-before-run=false test` | 231 pass, 13 skip, 0 fail | [vitest.txt](evidence/2026-10-17/independent-1807/vitest.txt) |
| `pnpm --config.verify-deps-before-run=false tsc --noEmit` | Exit 0, không diagnostic | [tsc.txt](evidence/2026-10-17/independent-1807/tsc.txt) |
| `pnpm --config.verify-deps-before-run=false build` | Exit 0 sau cấp network để tải Google Fonts | [build.txt](evidence/2026-10-17/independent-1807/build.txt) |

Các lệnh pnpm không flag cũng đã được thử trong snapshot; dependency-state check yêu cầu cài lại rồi dừng vì thiếu TTY. Flag trên bỏ kiểm tra trạng thái cài đặt, không bỏ test hoặc typecheck. Build sandbox lần đầu lỗi DNS Google Fonts ([log lỗi](evidence/2026-10-17/independent-1807/build-network-blocked.txt)); lần chạy có network đã pass. Foundry có warning không ghi được signature cache, exit vẫn 0. Snapshot không có credentials nên build pass không chứng minh backend/email/production env hoạt động.

Gas report độc lập (min / avg / median / max): `donate` **28,839 / 137,325 / 125,132 / 193,562**; `donateMany` **30,785 / 275,610 / 276,372 / 283,126**; `finalize` **28,800 / 117,873 / 118,297 / 1,580,835**; `claim` **28,881 / 60,909 / 77,231 / 77,231**; `verifyStudent` **23,565 / 98,249 / 98,320 / 98,320**. Đây là gas local, gồm nhiều fixture/revert, không phải phí AVAX.

Để đối chiếu snapshot, từ root repo chạy:

```sh
python3 - <<'PY_CHECK'
from pathlib import Path
import hashlib, json
manifest = json.loads(Path('docs/evidence/2026-10-17/independent-1807/source-sha256.json').read_text())
changed = [name for name, expected in manifest.items()
           if not Path(name).is_file() or hashlib.sha256(Path(name).read_bytes()).hexdigest() != expected]
print('Files:', len(manifest), 'Changed:', changed)
raise SystemExit(bool(changed))
PY_CHECK
```

<a id="technical-implementation"></a>
## 1. Technical Implementation — Strong

**Claim:** Source hiện tại có QF số nguyên on-chain, Factory modular, fuzz/stateful invariant và benchmark cho 50 dự án; bằng chứng này xác nhận hành vi trong môi trường test local.

| Yêu cầu | Đã làm gì | File/test cụ thể | Kiểm chứng |
| --- | --- | --- | --- |
| Foundry + payout an toàn | Tổng matching payout ≤ pool; payout + leftover = pool | [QFRound.t.sol](../contracts/test/QFRound.t.sol): `testFuzz_PayoutsNeverExceedPool` | `cd contracts && forge test --match-test testFuzz_PayoutsNeverExceedPool -vv` |
| Trần ngân sách | Tổng chi của ví ≤ `maxPerRound`; exact cap và vượt 1 đơn vị bị chặn | [StudentVerification.t.sol](../contracts/test/StudentVerification.t.sol): `testFuzz_SpentAndPayoutBound`, `test_ExactRoundCapAndOneWeiOver` | `cd contracts && forge test --match-contract StudentVerificationTest -vv` |
| Bảo toàn tiền khi hủy | Tiền vào = đang giữ + đã refund + pool đã trả; drain hết sau cleanup | [RoundCancellationInvariant.t.sol](../contracts/test/RoundCancellationInvariant.t.sol): `invariant_RecognizedInflowsEqualHeldPlusReturned`, `afterInvariant` | `cd contracts && forge test --match-contract RoundCancellationInvariantTest -vv` |
| Fuzz cancellation | Bất kể thứ tự trả pool/refund vẫn bảo toàn; nhiều donor/project về 0 | [RoundPhase2.t.sol](../contracts/test/RoundPhase2.t.sol): `testFuzz_CancelConservation`, `testFuzz_ManyDonorsProjectsRefundToZero` | `cd contracts && forge test --match-test 'testFuzz_.*' -vv` |
| `sumSqrt` và aggregation | Cộng theo tổng đóng góp mỗi ví trước sqrt, batch tương đương tuần tự, refund trừ đúng root | [RoundPhase2.t.sol](../contracts/test/RoundPhase2.t.sol): `testFuzz_DonateManyEqualsSequential`, `test_PartialRefundKeepsOtherDonorsAccounting`; [QFRound.t.sol](../contracts/test/QFRound.t.sol): `test_Math_SingleDonor_YieldsZeroMatching_And_Incremental1plus1plus1` | `cd contracts && forge test --match-contract RoundPhase2Test -vv` |
| Edge case làm tròn | `SCALE = 1e12`, floor sqrt và floor chia; 1 donor matching = 0; dust balance ≤ N đơn vị nhỏ nhất sau claim + rút leftover | [QFRound.sol](../contracts/src/QFRound.sol): `_recordDonation`, `_computeMatching`; `test_AccountingDustBound`, `testFuzz_PayoutsNeverExceedPool` | `cd contracts && forge test --match-test 'test_(AccountingDustBound|Math_SingleDonor.*)' -vv` |
| Chia hết, pool thiếu, cap | Fixture raw 300/150/50, pool 100 → 60/30/10; cap 20% → 20/20/10, leftover 50; pool 0; pending loại khỏi matching | [RoundPhase2.t.sol](../contracts/test/RoundPhase2.t.sol): `test_UnderfundedProportionalEvent`, `test_UnderfundedCapAndZeroPool`, `test_ZeroPoolStillReportsRawDemandAndEvent`, `test_PendingProjectExcludedAndCannotClaim` | `cd contracts && forge test --match-contract RoundPhase2Test -vv` |
| Factory modular | Factory tạo round độc lập; registry dùng chung; ERC20 test riêng | [RoundFactory.sol](../contracts/src/RoundFactory.sol), [QFRound.sol](../contracts/src/QFRound.sol), [StudentRegistry.sol](../contracts/src/StudentRegistry.sol), [MockUSDC.sol](../contracts/src/MockUSDC.sol); `test_RoundFactory_OnlyOwnerAndRoundCountWithSeveralRounds` | `cd contracts && forge test --match-test test_RoundFactory_OnlyOwnerAndRoundCountWithSeveralRounds` |
| Bảo mật | `ReentrancyGuard`, `SafeERC20`; cập nhật state trước transfer (CEI), `onlyAdmin`/`onlyOwner`, owner-only claim; batch rollback nếu transfer lỗi | [QFRound.sol](../contracts/src/QFRound.sol); `test_DonateManyFailedTokenTransferRollsBack`, `test_CancellationAccessAndFinalizeBoundary` | `cd contracts && forge test --match-contract RoundPhase2Test` |
| Không có timeout refund | Refund chỉ sau `cancelRound`; admin chỉ rút matching pool khi cancelled; không được rút donor funds do quá hạn | `test_NoTimeoutRefundWithoutCancellation`, `test_CancelRefundAllAndPoolAccounting` trong [RoundPhase2.t.sol](../contracts/test/RoundPhase2.t.sol) | `cd contracts && forge test --match-test test_NoTimeoutRefundWithoutCancellation` |
| Gas bounded | `MAX_PROJECTS = 50`, finalize gồm các vòng lặp theo approved projects, **bounded O(N), N ≤ 50** | `test_GasFinalizeExactly50Projects`; [log](evidence/2026-10-17/finalize50.log) | `cd contracts && forge test --match-test test_GasFinalizeExactly50Projects -vv` |

**Phạm vi fuzz/invariant:** 5 tên fuzz riêng: `testFuzz_PayoutsNeverExceedPool`, `testFuzz_SpentAndPayoutBound`, `testFuzz_DonateManyEqualsSequential`, `testFuzz_CancelConservation`, `testFuzz_ManyDonorsProjectsRefundToZero` (payout chạy lại qua kế thừa), mỗi lần xuất hiện chạy **256 runs**. Stateful invariant chạy **256 runs / 128,000 calls / 0 reverts** (500 calls/run), 2 donor và 2 project; handler có early-return nên không phải mọi call đều chuyển state. Fuzz nhiều donor giới hạn 2–8 donor, 1–6 project; không phải chứng minh tổng quát cho mọi đầu vào.

`sumSqrt` được đối chiếu qua batch/sequential, single-donor, và partial/full refund; **Not done:** invariant độc lập tái tính tổng root cho mọi donor qua mọi trạng thái. “Wei” trong tên test dust là **đơn vị nhỏ nhất của MockUSDC (10^-6 token), không phải native AVAX wei**. Dust ≤ N ở fixture không có nghĩa toàn bộ leftover ≤ N: leftover còn gồm pool dư và phần bị cap, không được redistribute sau cap. Công thức source đảm bảo `leftover = pool - totalPayout`.

**Gas 50 dự án:** fixture 25 owner (2 project/owner), 10 donor, mỗi project có 2 donor, pool 1,000 token. `gasleft()` quanh call sau `vm.cool` = **1,583,871**, gas-report max `finalize` = **1,580,835**; khác phạm vi đo/overhead. **36,076,965** trong dòng test là cả setup/fixture, không phải gas giao dịch finalize. Đây là benchmark local của một fixture có payout khác 0 cho cả 50, không phải trần gas được chứng minh hay receipt Fuji.

**Gaps:** **Not done** audit độc lập/formal verification; collusion chưa xử lý; chưa có tổng quát invariant `sumSqrt`; chưa stress mọi cấu hình constructor cực lớn (Solidity overflow checks vẫn áp dụng). Xem [Roadmap](#roadmap).

<a id="avalanche-integration"></a>
## 2. Avalanche Integration — Partial

**Claim:** Có deployment Fuji của ba contract nền, EVM wallet flow chuẩn và batch donation ở source; mức bằng chứng chưa đủ xác nhận round demo của phiên bản hiện tại đang hoạt động trên Fuji.

| Yêu cầu | Đã làm gì | File/test cụ thể | Kiểm chứng |
| --- | --- | --- | --- |
| Fuji 43113 | Manifest 3 địa chỉ, RPC xác nhận chain/code/getters | [fuji.json](../contracts/deployments/fuji.json), [snapshot RPC](evidence/2026-10-17/fuji-pinned.json) | `python3 docs/evidence/2026-10-17/verify-fuji.py` sau `cd contracts && forge build` rồi về root |
| Đúng phiên bản | So runtime local/remote, bỏ CBOR metadata và mask immutable | [verify-fuji.py](evidence/2026-10-17/verify-fuji.py), [kết quả ban đầu](evidence/2026-10-17/fuji-bytecode.json) | Chạy script trên; không coi code khác rỗng là khớp version |
| Core | Wagmi `injected()`; chọn connector ID `app.core.extension` hoặc tên Core trước fallback injected | [wagmi.ts](../src/lib/wagmi.ts), [ConnectWalletButton.tsx](../src/components/layout/ConnectWalletButton.tsx) | `rg -n 'injected|app.core.extension|connectAsync' src/lib/wagmi.ts src/components/layout/ConnectWalletButton.tsx` |
| Chuyển mạng | Connect chỉ định target chain; `NetworkGuard` dùng `switchChainAsync` | [chains.ts](../src/lib/chains.ts), [NetworkGuard.tsx](../src/components/common/NetworkGuard.tsx) | `rg -n 'switchChainAsync|TARGET_CHAIN_ID' src/components/common/NetworkGuard.tsx` |
| Thêm mạng | Không có nút Add Fuji riêng; connector có thể xử lý thêm mạng tùy wallet | [NetworkGuard.tsx](../src/components/common/NetworkGuard.tsx) | `rg -n 'wallet_addEthereumChain|addChain' src` (không thấy app gọi trực tiếp) |
| Micro-donation | UI mặc định 1–5 token; contract dùng bounds round, không hardcode 1–5 cho mọi round | [DonateBox.tsx](../src/components/project/DonateBox.tsx), [QFRound.sol](../contracts/src/QFRound.sol) | Xem `_recordDonation`; đọc `minDonation`/`maxDonation` của round khi đã có địa chỉ |
| Batch | `donateMany` gom nhiều allocation, cập nhật state và chỉ 1 ERC20 transfer; allowance thiếu vẫn cần giao dịch approve riêng | [useDonate.ts](../src/hooks/useDonate.ts), [BatchDonationForm.tsx](../src/components/project/BatchDonationForm.tsx), `testFuzz_DonateManyEqualsSequential` | `cd contracts && forge test --match-test testFuzz_DonateManyEqualsSequential` |
| Phí thật trong UI | `TransactionFlow.wait` lưu `gasUsed * effectiveGasPrice` theo hash; toast hiện AVAX + Snowtrace | [txToast.ts](../src/lib/txToast.ts), [Toast.tsx](../src/components/ui/Toast.tsx), [phase2-matching-fees.test.ts](../__tests__/phase2-matching-fees.test.ts) | `pnpm test -- __tests__/phase2-matching-fees.test.ts` |

### Deployment: địa chỉ và giới hạn xác nhận

| Contract | Địa chỉ / Snowtrace | Runtime bytes | Đối chiếu artifact local |
| --- | --- | ---: | --- |
| MockUSDC | [0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205](https://testnet.snowtrace.io/address/0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205) | 2,354 | **Không khớp** sau bỏ metadata |
| RoundFactory | [0x4fb01ae390bD9F46Dd921e5aC5D99c17912074D8](https://testnet.snowtrace.io/address/0x4fb01ae390bD9F46Dd921e5aC5D99c17912074D8) | 12,860 | **Không khớp** sau bỏ metadata/mask immutable |
| StudentRegistry | [0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e](https://testnet.snowtrace.io/address/0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e) | 2,575 | **Khớp** sau bỏ metadata/mask immutable |

Tại block **59,595,539**, RPC xác nhận factory `studentRegistry()` bằng registry trong manifest, token `decimals() = 6`, registry có `attester()`. **Factory `getRounds() = []`**. Không có QFRound trong manifest; **chưa kiểm chứng được `maxPerRound`, `studentRegistry`, cancellation/batch/`matchingTotalRaw` của một round sinh từ factory này**. Không suy diễn mismatch là contract độc hại: chỉ xác nhận chưa khớp bản build local; cần đối chiếu build/deploy provenance. So bytecode mask không xác minh giá trị immutable, quyền owner hay toàn bộ state; getter factory registry được kiểm tra riêng. Script ghim block cho code/getters, chain ID/gas price lấy tại lúc truy vấn.

Tái kiểm tra một round khi chủ dự án đã có địa chỉ thật: chạy `cast call ROUND_ADDRESS 'studentRegistry()(address)' --rpc-url https://api.avax-test.network/ext/bc/C/rpc` và thay signature bằng `maxPerRound()(uint256)`, `minDonation()(uint256)`, `maxDonation()(uint256)`, `MAX_PROJECTS()(uint256)`, `isCancelled()(bool)`, `matchingTotalRaw()(uint256)`. `ROUND_ADDRESS` là placeholder, **không phải lệnh đã chạy**. Không tự chọn một round cũ ngoài manifest làm bằng chứng cho bản hiện tại.

**Đối chiếu độc lập:** [phép đọc Cast](evidence/2026-10-17/independent-1807/fuji.json) ở latest bắt đầu block `59595497` cũng thấy ba địa chỉ có code, Factory đúng registry nhưng `getRounds()=[]`. [So artifact](evidence/2026-10-17/independent-1807/versions.json): Factory local/remote **14713/12860 bytes**, token **2957/2354 bytes**, registry **2575/2575 bytes**; registry khớp sau mask immutable, hai contract kia không khớp sau bỏ metadata. [Script tái lập so sánh](evidence/2026-10-17/independent-1807/compare-versions.py) chạy từ root bằng `python3 docs/evidence/2026-10-17/independent-1807/compare-versions.py` sau `forge build --root contracts`; không cần key/file env.

[Round legacy trong test RPC](https://testnet.snowtrace.io/address/0x340618b437F0314f136d5dB2228C13db61F7a7cc) không được Factory manifest trả về: [probe](evidence/2026-10-17/independent-1807/legacy-round.json) đọc min/max=1/5, projectCount=1, finalized=true; các getter `studentRegistry`, `maxPerRound`, `isCancelled` đều revert. Không dùng round đó làm bằng chứng budget/cancellation của source hiện tại.

Đã thử tìm receipt verification bằng `cast logs --address 0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e --from-block 59500000 --to-block 59595497 'StudentVerified(address,bytes32)' --json --rpc-url https://api.avax-test.network/ext/bc/C/rpc`; RPC từ chối vì tối đa **100 block/request** ([raw response](evidence/2026-10-17/independent-1807/student-events-response.json)). Không suy ra chưa từng có verification; không có tx hash để đọc receipt cụ thể. Phí thực trả vẫn **Missing**.

### Gas local và chi phí AVAX

| Action | Min / Avg / Median / Max gas local | Calls | Phí AVAX đo từ receipt Fuji |
| --- | --- | ---: | --- |
| `donate` | 28,839 / 137,090 / 125,132 / 193,562 | 9,089 | **Missing — Not done** |
| `donateMany` | 30,785 / 275,610 / 276,372 / 283,126 | 528 | **Missing — Not done** |
| `finalize` | 28,800 / 117,762 / 118,297 / 1,580,835 | 1,090 | **Missing — Not done** |
| `claim` | 28,881 / 60,909 / 77,231 / 77,231 | 1,571 | **Missing — Not done** |
| `verifyStudent` | 23,565 / 98,249 / 98,320 / 98,320 | 10,192 | **Missing — Not done** |

Nguồn: [gas-report.log](evidence/2026-10-17/gas-report.log). Min/avg gồm lời gọi revert/idempotent và nhiều fixture, không phải giá thành chuẩn của một hành động thành công. Số calls/fuzz có thể đổi giữa lần chạy. Không so trực tiếp avg batch với single để suy ra tiết kiệm phần trăm.

`cast gas-price` lần truy vấn ban đầu trả **160 wei/gas** ([fuji-initial.json](evidence/2026-10-17/fuji-initial.json)), là snapshot testnet chứ không phải `effectiveGasPrice` của receipt. **Chi phí AVAX thực trả cho 5 action: chưa có số đo**, không dùng `gasPrice * local gas` thay receipt. Cách thu: `cast receipt TX_HASH --rpc-url https://api.avax-test.network/ext/bc/C/rpc --json`, lưu hash/block/`gasUsed`/`effectiveGasPrice`, tính `feeAVAX = gasUsed * effectiveGasPrice / 10^18`; `TX_HASH` là placeholder chưa chạy. Không quy USD, không giả định giá AVAX, không so chain khác vì chưa có bộ số liệu phù hợp.

**Gaps:** **Not done** round demo/version provenance, receipt phí từng action, Core E2E, nút thêm mạng riêng. Đây là tích hợp EVM qua wagmi chuẩn với ưu tiên connector Core; không đủ căn cứ tuyên bố tích hợp Core chuyên sâu. Xem [Roadmap](#roadmap).

<a id="creativity-innovation"></a>
## 3. Creativity & Innovation — Strong

**Claim:** SqrtFund kết hợp QF với danh tính sinh viên dùng chung giữa các round, ngân sách ví và hoàn tiền khi hủy để mô hình hóa quỹ CLB Việt Nam; không tuyên bố phát minh ra QF.

| Yêu cầu | Đã làm gì | File/test cụ thể | Kiểm chứng |
| --- | --- | --- | --- |
| QF cho sinh viên VN | Round/organizer, project CLB, matching theo số người góp; VI/EN | [QFRound.sol](../contracts/src/QFRound.sol), [copy.ts](../src/lib/copy.ts) | `rg -n 'organizer|sumSqrt' contracts/src/QFRound.sol` |
| OTP email thật + EIP-712 | API gửi email qua SMTP hoặc Resend; consume OTP rồi ký attestation; contract kiểm tra chữ ký/domain/expiry | [request-otp](../src/app/api/verify/request-otp/route.ts), [confirm](../src/app/api/verify/confirm/route.ts), [mailer.ts](../src/lib/verify/mailer.ts), [signer.ts](../src/lib/verify/signer.ts); `test_WrongSignerSenderRegistryChainAndLegacyDomain` | `cd contracts && forge test --match-test test_WrongSignerSenderRegistryChainAndLegacyDomain` |
| 1 email ↔ 1 wallet | DB unique email_hash/address, reservation lock; on-chain `emailOwner`, `walletEmail` | [migration SQL](../supabase/migrations/0001_verification.sql), [StudentRegistry.sol](../contracts/src/StudentRegistry.sol); `test_EmailAndWalletAreGloballyUnique` | `cd contracts && forge test --match-test test_EmailAndWalletAreGloballyUnique` |
| Ngân sách theo round | `spentInRound`, `remainingBudget`, reset ở round mới | `test_NewRoundResetsBudgetAndKeepsStudent` trong [StudentVerification.t.sol](../contracts/test/StudentVerification.t.sol) | `cd contracts && forge test --match-test test_NewRoundResetsBudgetAndKeepsStudent` |
| Hủy và refund | Donor tự gọi refund, sponsor/admin rút pool riêng | [RoundCancellationPanel.tsx](../src/components/round/RoundCancellationPanel.tsx), [RoundPhase2.t.sol](../contracts/test/RoundPhase2.t.sol) | `cd contracts && forge test --match-test test_CancelRefundAllAndPoolAccounting` |

**Gaps:** Luồng gửi OTP production đã có code, **chưa xác nhận mail delivery/DB thật trong phiên này**. Đây là OTP + backend attester, **chưa phải ZK email**. 1 email/1 ví không chứng minh 1 người/1 ví. Refund phải được donor gửi transaction, không tự chuyển tiền khi hủy. Chống collusion và danh tính nâng cao: **Not done**, trong [Roadmap](#roadmap).

<a id="impact-use-case"></a>
## 4. Impact & Use Case — Partial

**Claim:** Mô hình có thể làm minh bạch cách phân bổ quỹ tài trợ CLB và tăng trọng số của sự ủng hộ rộng, nhưng chưa có dữ liệu pilot chứng minh tác động thực tế.

| Yêu cầu | Đã làm gì | File/test cụ thể | Kiểm chứng |
| --- | --- | --- | --- |
| Thiếu minh bạch/bất bình đẳng | Công thức, donation, pool, payout, claim public; không đo mức “cấp quỹ theo quan hệ” ngoài đời | [QFRound.sol](../contracts/src/QFRound.sol), [leaderboard](../src/components/leaderboard/Leaderboard.tsx) | `cd contracts && forge test --match-test test_ClaimFlow` |
| Người hưởng lợi | Sinh viên góp nhỏ, CLB có nhiều supporter, đơn vị tài trợ cần audit trail | [useDonate.ts](../src/hooks/useDonate.ts), [useClaim.ts](../src/hooks/useClaim.ts), [admin view](../src/views/admin.tsx) | `pnpm build`, mở routes `/verify`, `/admin`, `/rounds`, `/my` |
| Dùng thử ngay | UI quản lý round, duyệt dự án, deposit, donate, finalize/claim; cần deployment đúng và dịch vụ OTP cấu hình | [CreateRoundForm.tsx](../src/components/admin/CreateRoundForm.tsx), [DepositPoolForm.tsx](../src/components/admin/DepositPoolForm.tsx), [FinalizeButton.tsx](../src/components/admin/FinalizeButton.tsx) | `pnpm dev`; thực hiện checklist dưới đây (chưa chạy E2E) |
| Phạm vi Việt Nam | Demo Fuji và MockUSDC; hướng đến minh bạch quỹ tài trợ, không chào bán đầu tư/yield | [MockUSDC.sol](../contracts/src/MockUSDC.sol), [manifest](../contracts/deployments/fuji.json) | `cast call 0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205 'decimals()(uint8)' --rpc-url https://api.avax-test.network/ext/bc/C/rpc` |

**Một CLB chạy thử một round:** (1) Đơn vị vận hành là factory owner tạo round với thời gian, bounds và budget, sponsor cung cấp matching pool qua admin. (2) Thành viên kết nối Fuji, có test AVAX, xác thực email và nhận MockUSDC faucet. (3) CLB đăng ký project; admin approve hoặc reject on-chain trên phiên bản mới. Rejected không được donate/matching/claim, không giải phóng quota và không có lý do từ chối on-chain. (4) Sinh viên nhập 1–5 token theo bounds round, xem preview, approve ERC20 nếu cần, donate/batch. (5) Sau endTime admin finalize; sau grace 1 ngày ai cũng có thể finalize; owner claim direct + matching, admin rút leftover. Nếu admin hủy trước finalize, donor tự refund và admin rút pool. **Đây là quy trình dựa trên source; chưa xác nhận hoàn tất trên deployment manifest có factory rounds rỗng.** Không phải mọi CLB tự tạo round được: `createRound` là `onlyOwner`.

“Cấp quỹ theo quan hệ” là giả thuyết vấn đề cần phỏng vấn/pilot, không phải kết quả khảo sát đã có. On-chain cho thấy phân bổ/chuyển token; **chưa theo dõi CLB chi tiêu tiền sau claim**. QF có cap/scaling nên không bảo đảm luôn ưu tiên tuyệt đối dự án nhiều supporter.

**Pháp lý:** Demo dùng **Fuji testnet, MockUSDC không có giá trị**, minh bạch hóa phân bổ quỹ tài trợ; không chào mời gọi vốn hay đầu tư. Trước pilot có tiền thật phải đối chiếu văn bản pháp luật Việt Nam hiện hành về tài sản số, tài trợ và dữ liệu cá nhân; chưa có kết luận tuân thủ. Nguồn chính thức để bắt đầu rà soát: [Nghị quyết 05/2025/NQ-CP về thí điểm thị trường tài sản mã hóa](https://vanban.chinhphu.vn/?classid=0&docid=215249&pageid=27160) (tra cứu 17/10/2026); việc viện dẫn không xác định văn bản này bao phủ hay miễn trừ mô hình SqrtFund. **Not done:** rà soát pháp lý đầy đủ. Nguồn chính thức bổ sung đã tra cứu: [Luật 71/2025/QH15 — Luật Công nghiệp công nghệ số, hiệu lực 01/01/2026](https://congbao.chinhphu.vn/van-ban/luat-so-71-2025-qh15-45555.htm); không coi đây là danh mục quy định đầy đủ hoặc xác nhận tuân thủ.

**Gaps / pilot placeholder:** **Not done** pilot thật. `TODO_PILOT`: tên CLB/trường, thời gian, số sinh viên/dự án, quỹ thực tế, số giao dịch, phản hồi và sự đồng ý công bố. Không điền số giả. Xem [Roadmap](#roadmap).

<a id="presentation-pitching"></a>
## 5. Presentation & Pitching — Partial

**Claim:** Có ví dụ Before/After tái lập bằng đúng BigInt math và ba câu pitch; slide/video hoàn chỉnh chưa có bằng chứng.

| Yêu cầu | Đã làm gì | File/test cụ thể | Kiểm chứng |
| --- | --- | --- | --- |
| Slide Before/After | Có nội dung số bên dưới; deck: **Not done — TODO_SLIDES_URL** | [qf-example.cjs](evidence/2026-10-17/qf-example.cjs), [output](evidence/2026-10-17/qf-example.json) | Lệnh compile/run bên dưới |
| QF dễ hiểu | 100 × 1 so với 20 × 5, cùng tổng 100; mỗi ví khác nhau, không phải owner | [qf.ts](../src/lib/qf.ts): `sqrtBigInt`, `computeRawMatching`, `computeMatchingBigInt` | Chạy ví dụ; không dùng donation 50 vượt max 5 |
| Pitch/video | 3 câu pitch có evidence; video: **Not done — TODO_VIDEO_URL** | [README placeholders](../README.md) | Chủ dự án điền link và thử mở ẩn danh |

Từ root repo:

```sh
pnpm tsc src/lib/qf.ts --target ES2020 --module commonjs --skipLibCheck --outDir /tmp/sqrt-evaluation/qf
node docs/evidence/2026-10-17/qf-example.cjs
```

| Chỉ số | A: 100 ví × 1 MockUSDC | B: 20 ví × 5 MockUSDC |
| --- | ---: | ---: |
| Before: tổng góp trực tiếp | 100.000000 | 100.000000 |
| After: matching thô, số thực lý tưởng `(Σ√d)² − Σd` | 9,900 | 1,900 |
| Matching thô đúng integer code | **9,900.000000** | **1,899.999999** |
| Payout với pool 10,000, cap 10000 bps | **8,389.830509** | **1,610.169490** |
| Payout với pool 10,000, cap 3000 bps | **3,000.000000** | **1,610.169490** |

Raw demand tổng **11,799.999999**, lớn hơn pool 10,000 nên phải proportional scaling; trường hợp không cap có leftover **0.000001**. Khi cap 30%, leftover **5,389.830510**, không tự redistribute. Raw A/B khoảng **5.21×** không phải cam kết payout luôn gấp như vậy. Các donor phải khác ví, đã verify, không phải owner, budget mỗi ví ≥ số góp; maxDonation 5 hợp lệ. Đây là ví dụ tính code local, không phải round Fuji đã chạy.

**Why on-chain?**  
QF trong `_computeMatching` và sổ góp nằm trong contract, ai cũng có thể đối chiếu.  
Sau finalize, owner claim direct donation + matching theo state đã chốt.  
Admin vẫn duyệt/từ chối dự án và hủy round trước finalize; minh bạch công thức không xóa quyền quản trị đó.

**Why Avalanche?**  
Dự án cấu hình Fuji C-Chain 43113, dùng EVM contracts và giao dịch góp nhỏ theo bounds round.  
`donateMany` gom allocation vào một call; Core được ưu tiên qua connector wagmi.  
Gas local đã đo; chi phí Fuji thực trả và độ mượt Core còn cần receipt/E2E, chưa tuyên bố lợi thế định lượng so chain khác.

**Tiền hoặc yield đến từ đâu?**  
Matching pool được admin nạp bằng `depositPool` trước finalize; source chỉ cho admin gọi.  
Hiện token là MockUSDC testnet, owner có quyền mint; không có sponsor thực tế được xác nhận.  
Không có cơ chế tạo yield/lãi; tài trợ thật từ trường/cựu sinh viên/doanh nghiệp là kịch bản cần pilot, không phải đối tác đã có.

**Gaps:** **Not done** deck, video, diễn tập pitch có thời lượng; điền thông tin đội ngũ. Xem [Roadmap](#roadmap).

<a id="ui-ux-demo"></a>
## 6. UI/UX & Demo — Partial

**Claim:** Expected Matching đã cập nhật theo ô nhập trước donate và UI có cảnh báo/fee/OTP flow; chưa kiểm chứng trải nghiệm end-to-end trong trình duyệt thực tế.

| Yêu cầu | Đã làm gì | File/test cụ thể | Kiểm chứng |
| --- | --- | --- | --- |
| Real-time theo input | `onChange → handleAmountChange → inputValue → useMemo(impact)` gọi `simulateDonationImpact`, render `expectedMatching` | [DonateBox.tsx](../src/components/project/DonateBox.tsx), [qf.ts](../src/lib/qf.ts) | `rg -n 'inputValue|simulateDonationImpact|expectedMatching|onChange' src/components/project/DonateBox.tsx` |
| Cảnh báo pool thiếu | `matchingCoverage`, totalRaw giả lập, hiển thị coverage và cảnh báo scale | [MatchingPoolWarning.tsx](../src/components/project/MatchingPoolWarning.tsx), [matching-coverage-visibility.test.ts](../__tests__/matching-coverage-visibility.test.ts) | `pnpm test -- __tests__/matching-coverage-visibility.test.ts` |
| Supporter/ranking | Hiển thị số supporter, direct/matching/total, sort và ranking theo supporter | [leaderboard model](../src/components/leaderboard/model.ts), [Leaderboard.tsx](../src/components/leaderboard/Leaderboard.tsx), [Podium.tsx](../src/components/leaderboard/Podium.tsx) | `rg -n 'supporters|matching|rank' src/components/leaderboard/model.ts src/components/leaderboard/Leaderboard.tsx` |
| Lỗi rõ + song ngữ | VI/EN, allowance/balance/budget checks, map contract error, rejected/timeout toasts | [copy.ts](../src/lib/copy.ts), [errors.ts](../src/lib/errors.ts), [useDonate.ts](../src/hooks/useDonate.ts) | `pnpm test` và đổi locale khi manual demo |
| Trạng thái tx + explorer | Approving/donating/success/error, receipt fee AVAX, Snowtrace; claim dùng receipt | [useDonate.ts](../src/hooks/useDonate.ts), [useClaim.ts](../src/hooks/useClaim.ts), [Toast.tsx](../src/components/ui/Toast.tsx), [ExplorerLink.tsx](../src/components/tx/ExplorerLink.tsx) | `pnpm test -- __tests__/phase2-matching-fees.test.ts` |
| Verify flow | Modal 6 ô, paste, countdown, resend, retry wallet tx, check chain/registry/expiry | [StudentVerifyBox.tsx](../src/components/verify/StudentVerifyBox.tsx) | `rg -n 'onPaste|resendLeft|expiry|verifyStudent|Retry wallet' src/components/verify/StudentVerifyBox.tsx` |

Preview là ước tính dựa trên snapshot RPC; các ví khác có thể donate/admin có thể nạp pool trước finalize. Không phải lời hứa payout. Test “updates expected matching immediately…” kiểm tra hàm toán, **không mount DonateBox và gõ trên DOM**; đường nối input được kiểm tra qua source. Input sai được parse về 0 cho preview, donation vẫn có validation. Chưa có evidence browser cho rounding/display trên mọi locale/màn hình.

**Gaps:** Expected Matching **đã có trong source**, không phải việc cần thêm tính năng. **Not done:** kiểm thử tương tác DOM/browser, Core thật, email thật, claim/refund thật và mobile demo. Không tự thêm tính năng UI trong tác vụ tài liệu này. Xem [Roadmap](#roadmap).

## Where a judge would push back

1. **Một người có nhiều email trường thì sao?** Registry/DB chỉ đảm bảo 1 email ↔ 1 ví, không đảm bảo 1 người. Alias được normalize nhưng nhiều email hợp lệ vẫn là Sybil gap; [StudentRegistry.sol](../contracts/src/StudentRegistry.sol), [domain.ts](../src/lib/verify/domain.ts). Chống danh tính đa email: **Not done**.
2. **Nhóm bạn thỏa thuận góp chéo để lấy pool?** Budget, self-donation ban và aggregate-before-sqrt hạn chế một số hành vi; không phát hiện collusion giữa các ví. Pairwise penalty/reputation: **Not done**; [_recordDonation](../contracts/src/QFRound.sol).
3. **Admin có kiểm duyệt/cancel được không?** Có. `approveProject`/`rejectProject`/`cancelRound` là `onlyAdmin`, cancel trước finalize; factory create là `onlyOwner`. Donor được pull-refund sau cancel, không có quyền buộc admin approve; [QFRound.sol](../contracts/src/QFRound.sol), [RoundFactory.sol](../contracts/src/RoundFactory.sol).
4. **Backend attester là điểm tin cậy tập trung?** Đúng. Chữ ký chứng minh attester cấp quyền, không tự chứng minh email ở chain. Owner có thể đổi attester; `isStudent` cũ không tự bị revoke; [StudentRegistry.sol](../contracts/src/StudentRegistry.sol), [signer.ts](../src/lib/verify/signer.ts). ZK/DKIM proof: **Not done**.
5. **MockUSDC có phải USDC thật, yield từ đâu?** Không. Token test có faucet và owner mint, không giá trị; không có yield. Sponsor funding thực tế chưa có; [MockUSDC.sol](../contracts/src/MockUSDC.sol), `depositPool` trong [QFRound.sol](../contracts/src/QFRound.sol).
6. **Finalize có tăng gas theo dự án, ai trả gas?** Có: bounded O(N), N ≤ 50; fixture local đo call 1,583,871 gas, chưa có receipt Fuji. Người gọi trả gas; admin được finalize trong 1 ngày grace, sau đó permissionless; [test benchmark](../contracts/test/RoundPhase2.t.sol), [finalize log](evidence/2026-10-17/finalize50.log).
7. **Pool có thể nạp đến phút cuối khiến preview đổi?** Có. `depositPool` không chặn sau endTime, chỉ chặn finalized/cancelled và cần admin; payout chốt ở finalize, preview không cố định. Chưa có cơ chế khóa pool sớm; [QFRound.sol](../contracts/src/QFRound.sol).
8. **Giám khảo có demo ngay bản đang deploy được không?** Chưa đủ bằng chứng: factory trong manifest có rounds rỗng, factory/token không khớp local runtime. Cần xác minh/redeploy đúng build, tạo round và thu receipt trước khi khẳng định end-to-end; [snapshot RPC](evidence/2026-10-17/fuji-pinned.json). Không thực hiện deploy trong tác vụ này.

<a id="roadmap"></a>
## Gaps / Roadmap theo ảnh hưởng đến tiêu chí

Ước lượng công sức tương đối, không phải lịch cam kết. Tất cả dòng dưới là **Not done** trong phạm vi bằng chứng hiện tại.

| Ưu tiên | Gap / ảnh hưởng | Đề xuất sửa hoặc bổ sung bằng chứng | Công sức |
| --- | --- | --- | --- |
| 1 | Deployment provenance + round demo (Avalanche 25, Demo 10) | Xác minh build của factory/token, redeploy nếu cần; tạo round, kiểm getter/version và quay E2E Core | Vừa |
| 2 | Receipt phí 5 action; lợi ích micro-donation chưa đo (Avalanche 25) | Thu tx/receipt thành công cho donate, batch có số allocation rõ, finalize 50, claim, verify; tính AVAX, tính approve riêng | Vừa |
| 3 | Slide/video (Pitch 10) | Tạo deck Before/After từ số integer, 3 câu pitch, video demo và link xem ẩn danh | Nhỏ |
| 4 | OTP/DB/Core/browser thật (Demo 10, Impact 15) | Bật integration trên DB test riêng; kiểm mail delivery và ký/claim/refund; thêm browser interaction kiểm preview theo input | Vừa |
| 5 | Chưa audit / invariant sumSqrt độc lập (Technical 25) | Review độc lập, thêm handler invariant tái tính root và adversarial ERC20/reentrancy tests | Lớn |
| 6 | Sybil/collusion (Innovation 15, Impact 15) | Thử nghiệm identity mạnh hơn, phân tích pairwise coordination; đánh giá tradeoff quyền riêng tư | Lớn |
| 7 | Chưa pilot/đo tác động/quy trình pháp lý (Impact 15) | Pilot với CLB có consent, khảo sát trước/sau, đối chiếu pháp luật trước tiền thật | Lớn |
| 8 | Chưa có nút Add Fuji riêng | Thử wallet unknown-chain trước; nếu cần thêm thao tác rõ và test Core | Nhỏ |
| 9 | ZK email, min-supporter quorum, pool lock sớm | Thiết kế/đánh giá trước, không tuyên bố đã triển khai | Lớn |

Repo chưa có `LICENSE` ở root dù source contract có SPDX MIT: **Not done**, chủ dự án cần xác nhận và thêm giấy phép repo (công sức nhỏ).

## Chỗ chủ dự án cần điền và link cần bấm thử

- `TODO_SLIDES_URL`: deck Before/After; `TODO_VIDEO_URL`: video demo. Chưa có URL nên không tạo link giả.
- Đội ngũ: tên, vai trò, GitHub/liên hệ; ví admin demo và địa chỉ round thật (placeholder có sẵn trong [README](../README.md)).
- `TODO_PILOT`: CLB/trường, số người, kết quả, phản hồi và bằng chứng đồng ý công bố.
- Bấm thử [ứng dụng trong README](https://sqrt-fund.vercel.app) ở chế độ ẩn danh, desktop/mobile; đường `/verify`, `/rounds`, `/my`, `/admin` trên app đúng deployment. **Chưa xác nhận availability hoặc cấu hình của web live trong phiên này.**
- Bấm ba link Snowtrace ở bảng deployment, sau đó link round và tx receipt khi có; RPC đã kiểm code, **chưa kiểm explorer UI hoặc source verification badge**.
- Bấm slide/video sau khi điền và bảo đảm quyền “ai có link cũng xem”; link source pháp lý là điểm bắt đầu rà soát, không phải chứng nhận tuân thủ.

Không có số phí AVAX thực trả, pilot, sponsor, video, slide hay thông số round on-chain nào được suy diễn để lấp chỗ trống. Các bằng chứng source trong tài liệu chỉ áp dụng cho workspace đã kiểm tra; cần chạy lại sau khi đổi code/deployment.
