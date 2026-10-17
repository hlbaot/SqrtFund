# Báo cáo Giai đoạn 2

## Kết quả kiểm tra cục bộ

- `forge test --root contracts`: 105 pass, 0 fail; invariant 256 runs, 128000 calls.
- `forge test --root contracts --match-test test_GasFinalizeExactly50Projects -vv`: cold external-call finalize = **1584455 gas**, đúng 50 dự án approved, mỗi dự án có matching dương. Không phải tổng gas giao dịch; không dùng số gas toàn fixture làm benchmark finalize.
- `pnpm test`: 217 pass, 13 skip; 27 file pass, 2 file skip (12 test Supabase và 1 RPC opt-in).
- `pnpm exec tsc --noEmit`: pass.
- `pnpm build`: pass, có warning dependency động ox/viem.
- `pnpm abi`: thành công.
- Lint các component mới và logic Phase 2/test mới: pass. `pnpm lint` toàn repo còn 2 lỗi `react-hooks/set-state-in-effect` trong `src/lib/context/locale.tsx` (dòng 40, 72 lúc chạy); không sửa phần locale đang được thay đổi ngoài phạm vi.
- Artifact runtime: QFRound 11251 bytes, RoundFactory 14447 bytes theo artifact build hiện tại.

Foundry kiểm tra refund hết tiền cho mọi donor, rút lại revert, không refund theo timeout, không hủy sau finalize, tất cả thao tác funding bị khóa khi hủy, pool rút riêng một lần, batch atomic/giới hạn/caps, fuzz so sánh sumSqrt giữa batch và tuần tự. Stateful invariant kiểm tra tiền vào = balance + tiền hoàn + pool đã rút, sau drain balance bằng 0. Vitest kiểm tra khả năng đọc Phase 1/2, preview dùng cùng pool cho mọi allocation, receipt fee, SSR banner/refund/pool/quyền admin.

## Tệp sửa/tạo trong phạm vi Giai đoạn 2

| Tệp | Thay đổi |
| --- | --- |
| `contracts/src/QFRound.sol` | Cancel/refund/refundMany/pool recovery, donateMany và logic donation dùng chung, khóa trạng thái đã hủy |
| `contracts/test/RoundPhase2.t.sol` | Test chức năng, fuzz và benchmark đúng 50 dự án |
| `contracts/test/RoundCancellationInvariant.t.sol` | Stateful invariant bảo toàn tiền và drain về 0 |
| `src/lib/contracts/abis/qfRound.ts` | ABI sinh từ artifact thật |
| `src/lib/contracts/roundReads.ts` | Probe getter Phase 2, cache khả năng hỗ trợ; giữ đọc round cũ |
| `src/hooks/useRound.ts` | Trạng thái canceled, khả năng Phase 2, cờ pool đã rút |
| `src/hooks/useRole.ts` | Chặn tham gia khi hủy |
| `src/hooks/useDonate.ts` | donateMany với tổng allowance/balance và receipt flow |
| `src/components/round/RoundCancellationPanel.tsx` | Banner, refund của ví, pool của admin, dialog xác nhận hủy |
| `src/components/project/BatchDonationForm.tsx` | Chia ngân sách, caps, preview matching theo mỗi input |
| `src/components/project/DonateBox.tsx` | Chuyển mode batch, preview BigInt chính xác, trạng thái đã hủy |
| `src/components/admin/DepositPoolForm.tsx` | Ẩn nạp pool khi hủy |
| `src/components/admin/FinalizeButton.tsx` | Chặn finalize khi hủy |
| `src/components/round/CountdownTimer.tsx` | Nhận trạng thái canceled |
| `src/components/rounds/RoundsList.tsx` | Round hủy thuộc tab đã kết thúc |
| `src/components/layout/Navbar.tsx` | Thông báo trạng thái hủy |
| `src/views/admin.tsx` | Gắn điều khiển cancel/refund/pool |
| `src/views/round-detail.tsx` | Gắn banner/refund/cancel |
| `src/views/project-detail.tsx` | Gắn banner/refund |
| `src/types/index.ts` | RoundStatus canceled |
| `src/lib/qf.ts` | Preview cập nhật tất cả allocation trước khi chia pool |
| `src/lib/txToast.ts` | Lấy phí chính xác từ receipt theo hash, cả receipt revert |
| `src/lib/context/toast.tsx` | Chuyển fee tới toast store |
| `src/components/ui/Toast.tsx` | Phí AVAX cùng link Snowtrace |
| `src/lib/copy.ts` | Copy EN/VI cho chức năng mới |
| `src/lib/errors.ts` | Thông báo EN/VI cho custom error mới, sửa wording batch |
| `__tests__/phase2-matching-fees.test.ts` | Matching batch, độ chính xác 6 decimals, receipt fee |
| `__tests__/phase2-cancellation-ui.test.ts` | Banner/refund/pool theo trạng thái và quyền |
| `__tests__/round-loading.test.ts` | Round legacy/Phase 1/Phase 2, lỗi RPC tạm thời |
| `__tests__/wallet-logout.test.ts` | Đồng bộ kỳ vọng test với logic logout đã có: giữ shimDisconnect, clear cờ trước explicit connect, cleanup kể cả provider lỗi; không sửa runtime wallet |
| `docs/phase2-redeploy-fuji.md` | Lệnh keystore deployer và kiểm tra thủ công |
| `docs/redeploy-fuji.md` | Cảnh báo deployment Phase 1, dẫn hướng Phase 2 |
| `docs/round-loading-fuji.md` | Cảnh báo deployment Phase 1, dẫn hướng Phase 2 |
| `README.md` | Cơ chế cancel/refund/batch/preview/phí; test/gas đo thật; địa chỉ cần redeploy và giới hạn quyền admin |

Các thay đổi song song trong `src/app/layout.tsx`, `src/app/providers.tsx`, `src/lib/context/locale.tsx` không thuộc triển khai Giai đoạn 2 và được giữ nguyên.

## Chưa kiểm chứng và công việc tiếp theo

Chưa deploy, không gửi mail, không ghi Supabase hay thử giao dịch bằng ví thật. UI được kiểm tra SSR và logic/mocks; chưa xác nhận popup ví, receipt Fuji hay bố cục tương tác trên trình duyệt với round mới.

Tự thực hiện theo [hướng dẫn redeploy](phase2-redeploy-fuji.md): deploy Factory mới bằng keystore, giữ registry/token; xác nhận broadcast/manifest, sync ABI; đổi local/Vercel public env, restart/redeploy bỏ cache; tạo round mới; chạy các tình huống donateMany, hủy/refund/pool và finalize/claim trên hai round thử riêng. Địa chỉ Factory Phase 2 và phí mạng thực tế chỉ có sau các giao dịch của bạn; README không bịa các giá trị này.
