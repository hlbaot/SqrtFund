# Báo cáo thay đổi StudentRegistry và README

## Kết quả và nguyên nhân lỗi gửi mã

Luồng cuối là email trường → OTP → attestation → StudentRegistry.verifyStudent → Student dùng chung. Không lấy danh tính theo round.

Lỗi 503 ban đầu xảy ra trước bước SMTP: log do người dùng cung cấp và kiểm tra RPC chỉ đọc trước đó cho thấy round cũ gọi `attester()` revert trong khi `admin()` có kết quả. Đây là bytecode không hỗ trợ hàm mà signer cũ gọi, không chứng minh lỗi Gmail/Supabase. Code mới kiểm tra registry tại `src/app/api/verify/request-otp/route.ts:30`, chỉ gửi thư ở dòng 54. `src/lib/verify/signer.ts:17` lấy địa chỉ registry cấu hình; dòng 27 đọc attester; dòng 38 so với signer backend. Manifest hiện đã có registry/factory mới và đã đối chiếu getter qua RPC trong lần sửa /round; xem docs/round-loading-fuji.md. Không kiểm tra hay thay giá trị `.env.local`; chưa đủ bằng chứng kết luận cấu hình SMTP thực tế đúng/sai.

## Tệp đã sửa/tạo theo chức năng

| Tệp | Thay đổi / lý do |
| --- | --- |
| `contracts/src/StudentRegistry.sol` | Thêm registry toàn cục, EIP-712, emailOwner/walletEmail, expiry, replay idempotent, owner xoay attester |
| `contracts/src/QFRound.sol` | Chỉ dùng quyền registry; maxPerRound, spentInRound, remainingBudget; bỏ hàng chờ/cấp Student thủ công |
| `contracts/src/RoundFactory.sol` | Registry immutable, truyền ngân sách và registry khi tạo round |
| `contracts/script/DeployStudentRegistry.s.sol` | Script deploy registry độc lập, chỉ in địa chỉ công khai |
| `contracts/script/DeployFactory.s.sol` | Dùng STUDENT_REGISTRY_ADDRESS, tái sử dụng token trong manifest |
| `contracts/script/Deploy.s.sol` | Cài mới token + registry + factory; không chạy trong lần sửa này |
| `contracts/foundry.toml` | Bật via_ir cho constructor/phần triển khai mới |
| `contracts/test/QFRound.t.sol` | Fixture xác thực qua chữ ký registry; cập nhật giả định quyền cũ và constructor |
| `contracts/test/StudentVerification.t.sol` | Global identity, EIP-712, ngân sách, nhiều dự án, reset round, fuzz |
| `scripts/sync-abis.mjs` | Sinh thêm ABI registry |
| `src/lib/contracts/abis/index.ts`, `qfRound.ts`, `roundFactory.ts`, `studentRegistry.ts` trong cùng thư mục | Đồng bộ ABI từ artifacts |
| `src/lib/contracts/addresses.ts` | Địa chỉ registry công khai, kiểm tra cấu hình |
| `supabase/migrations/0001_verification.sql` | Migration sạch duy nhất, bảng global, RPC nguyên tử, unique hai chiều, RLS/REVOKE; SQL reset trong comment |
| `src/lib/verify/config.ts` | Phân biệt cấu hình thiếu/sai, Gmail From/App Password |
| `src/lib/verify/domain.ts` | Allowlist bắt buộc, khớp chính xác domain; thiếu/sai cấu hình thì chặn xác minh; blocklist ưu tiên chặn; trim/lowercase/bỏ +tag khi định danh |
| `src/lib/verify/otp.ts` | OTP crypto/HMAC gắn request, helper thời hạn/lỗi/IP |
| `src/lib/verify/rateLimit.ts` | Reserve nguyên tử theo registry và đủ trạng thái |
| `src/lib/verify/supabaseAdmin.ts` | Client service role chỉ server |
| `src/lib/verify/signer.ts` | Đọc registry attester, EIP-712 global, target do server cấu hình |
| `src/lib/verify/errors.ts` | Diagnostic chỉ stage/name/code/message đã lọc/rút gọn; phân loại lỗi schema |
| `src/lib/verify/http.ts` | JSON không cache, lỗi an toàn, kiểm tra body/origin |
| `src/lib/verify/mailer.ts` | SMTP STARTTLS/timeouts, kiểm tra acceptance; lỗi không bị nuốt |
| `src/lib/verify/emailTemplate.ts` | Email multipart text/HTML đỏ đen, gradient, hướng dẫn tiếp tục giao dịch ví |
| `src/app/api/verify/request-otp/route.ts` | Global identity, lỗi phân biệt, không log OTP/email, resume cùng danh tính không gửi thư |
| `src/app/api/verify/confirm/route.ts` | Consume OTP một lần, kiểm tra registry, lưu uniqueness trước khi trả proof |
| `src/app/api/verify/stats/route.ts` | Thống kê global, diagnostic an toàn |
| `scripts/test-mail.ts` | Import trực tiếp mailer thật; không ghi DB hay log mã/email |
| `scripts/preview-verification-email.mjs` | Tạo preview từ template thật |
| `docs/previews/student-verification.html`, `student-verification.png`, `student-verification-mobile.png` | Preview email desktop/mobile |
| `src/app/verify/page.tsx` | Trang xác thực độc lập factory/round |
| `src/components/verify/StudentVerifyBox.tsx` | Modal OTP, toast EN/VI, retry ví với ALREADY_VERIFIED, refetch sau receipt |
| `src/components/verify/StudentAccessGate.tsx` | Gate tới /verify cho người chưa là Student |
| `src/components/verify/VerificationStats.tsx` | Hiển thị thống kê global |
| `src/hooks/useStudentStatus.ts` | Đọc isStudent trực tiếp registry |
| `src/hooks/useRole.ts` | Role Student không phụ thuộc round; participation yêu cầu round cùng registry |
| `src/lib/studentAccess.ts` | Helper gate, ngân sách, kiểm tra giới hạn BigInt |
| `src/hooks/useRound.ts` | Đọc maxPerRound |
| `src/hooks/useDonate.ts` | Bind donate với round được chọn |
| `src/hooks/useNotificationCounts.ts` | Bỏ số lượng hàng chờ xác thực sinh viên |
| `src/components/admin/CreateRoundForm.tsx` | Input và validate maxPerRound |
| `src/components/project/DonateBox.tsx` | Đọc remainingBudget, khóa quyền/ngân sách, giới hạn chính xác 6 decimals |
| `src/components/project/ProjectForm.tsx` | Gate Student và guard trước submit |
| `src/components/layout/ConnectWalletButton.tsx` | Badge global và link /verify |
| `src/views/register.tsx` | Chặn form cả khi mở URL trực tiếp |
| `src/views/admin.tsx` | Bỏ whitelist/hàng chờ cấp Student thủ công |
| `src/views/my.tsx`, `src/views/home.tsx`, `src/views/round-detail.tsx` | Tích hợp hộp xác thực global tại các điểm truy cập |
| `src/views/project-detail.tsx` | DonateBox dùng đúng round của trang chi tiết |
| `src/lib/copy.ts`, `src/lib/errors.ts` | Thông báo EN/VI cho registry, config, schema, OTP và budget |
| `src/components/ui/Dialog.tsx`, `Toast.tsx` | Hỗ trợ dialog OTP và trạng thái toast |
| `src/components/home/HowItWorksTimeline.tsx`, `NetworkStats.tsx`, `src/components/ui/AeroShards.tsx` | Sửa lỗi lint gặp trong kiểm tra toàn repo |
| `package.json`, `pnpm-lock.yaml` | Dependency SMTP/Supabase/server-only và typings |
| `tsconfig.json` | Cho phép import đuôi .ts để script dùng đúng mailer |
| `.env.example` | Placeholder secret, tên biến đúng, allowlist/blocklist tùy chọn, env deploy/test |
| `__tests__/email-otp-api.test.ts`, `email-registry-validation.test.ts`, `email-attestation.test.ts`, `email-otp.test.ts` | API global, getter lỗi, signer lệch/khớp, canonical alias, schema/config và resume |
| `__tests__/verification-diagnostics.test.ts`, `verification-mailer.test.ts`, `verification-email.test.ts` | Log không lộ dữ liệu, cấu hình SMTP, template email |
| `__tests__/global-student-role.test.ts`, `student-access.test.ts` | Role global, gate và giới hạn ngân sách |
| `__tests__/email-otp.integration.test.ts` | Schema global và trạng thái reserve; opt-in DEV riêng |
| `__tests__/verification.test.ts` | Bỏ test pending/admin whitelist không còn thuộc thiết kế |
| `docs/redeploy-fuji.md` | Deploy/migration/env/cast/curl theo code cuối |
| `README.md` | Viết sau cùng, nội dung và số liệu từ code/lệnh thật |

`contracts/src/MockUSDC.sol` và `contracts/deployments/fuji.json` được đọc làm nguồn đối chiếu, không redeploy token hay thay địa chỉ bằng số giả. Những thay đổi khác đã có trong working tree được giữ nguyên; bảng này mô tả phạm vi chức năng đã xử lý, không coi toàn bộ diff có sẵn là thay đổi mới của lượt cuối.

## Tệp đã xóa

Đã tìm caller trước khi xóa và kiểm tra lại không còn import runtime:

- `supabase/migrations/0002_global_student_registry.sql`: thay bằng migration sạch duy nhất theo yêu cầu project rỗng.
- `src/components/admin/WhitelistTable.tsx`: bỏ cấp Student thủ công.
- `src/hooks/usePendingRequests.ts`: hàng chờ xác minh đã bỏ.
- `src/hooks/useVerificationRequest.ts`: bỏ yêu cầu admin xác minh theo round.
- `src/lib/verification.ts`: helper pending/whitelist chỉ còn được test cũ gọi; bỏ test lỗi thời rồi xóa helper.

## Từng mục README đã đổi và lý do (PHẦN H)

1. Mô tả/QF: global Student, nhiều dự án, ba hạn mức, cộng dồn trước căn, round mới reset; khớp contract cuối.
2. Luồng xác thực: sơ đồ OTP → backend EIP-712 → registry transaction; tránh hiểu OTP thành công là đã có quyền on-chain.
3. Sybil/spam: ghi đúng ba lớp, số giới hạn lấy từ SQL/RPC; không hứa một người duy nhất tuyệt đối.
4. Kiến trúc: bảng bốn contract, route/lib/UI và migration duy nhất; bỏ mô hình queue cũ.
5. Deployment: token/factory đọc từ manifest; ghi registry cần deploy và factory cần redeploy, không giả địa chỉ mới.
6. Cài đặt: bảng từng env khớp .env.example, reset/SQL, Gmail 2FA/App Password, sender, attester riêng, script thật, Vercel Sensitive/redeploy.
7. Kiểm thử/gas: 67 Foundry, 204 Vitest pass/13 skip; finalize bounded O(N), 50 dự án chưa đo; bỏ số liệu cũ.
8. Pitch/pháp lý: giải thích quyền và tiền on-chain, lựa chọn EVM/Fuji, nguồn pool/donations; giới hạn demo testnet và nguồn Công báo cần đối chiếu trước vận hành thật.
9. Bonus: cap matching và backend attestation đã làm; không gọi là ZK email.
10. Limitations: trusted signer, nhiều email, ảnh hưởng tài chính/collusion, duyệt dự án, pool động, dịch vụ ngoài/quota mail, audit và roadmap chưa làm.
11. Rà soát: kiểm tra không còn trường round trong luồng xác thực README, không migration bổ sung/bảng cũ, đủ env/path; liệt kê link explorer/faucet để tự kiểm tra.
12. Báo cáo: tách điều đã kiểm tra khỏi việc cần người dùng chạy; không ghi thông tin bí mật.

## Kiểm tra thực tế

- TypeScript, ESLint, production build: exit 0. Build có warning dependency động ox/viem.
- Vitest hiện tại: 204 passed, 13 skipped; 25 file pass, 2 file integration skip. Test Fuji chỉ đọc đã chạy riêng và pass.
- Foundry: 67 passed, 0 failed, 0 skipped.
- ABI: đồng bộ đủ 4 contract.
- Migration: chạy trên Postgres WASM cục bộ, kiểm tra đủ reserve statuses, OTP một lần/5 sai, unique, RLS/REVOKE. Không chạy vào Supabase thật.
- RPC Fuji read-only: đã kiểm tra registry attester, factory cũ/mới và từng getter round; factory mới chưa có round.
- Script mail: kiểm tra nhánh usage không recipient, import thật thành công, exit 1 đúng dự kiến. Chưa gửi SMTP thật trong lần sửa.
- Gas finalize 50 dự án chưa đo. Chưa audit; không claim end-to-end với ví/mail thật đã pass.

## Bạn cần tự làm, theo thứ tự

1. Trên project Supabase rỗng đã chọn: chạy SQL reset comment, rồi migration 0001 duy nhất.
2. Điền env bắt buộc, chọn policy email (mặc định mở .edu/.edu.vn), Gmail App Password và sender khớp; dùng attester riêng khác deployer/admin.
3. Theo `docs/round-loading-fuji.md`: ưu tiên registry/factory mới hiện đã có trong manifest; đổi public env và tạo round mới với ngân sách hợp lệ. Nếu chọn deploy factory khác thì dùng keystore deployer như hướng dẫn, giữ token/registry hiện có.
4. Đối chiếu broadcast/getter on-chain, cập nhật manifest và địa chỉ public env, chạy pnpm abi; cập nhật bảng deployment README với địa chỉ mới thật.
5. Restart dev server, hoặc thêm env Sensitive phù hợp và redeploy Vercel.
6. Chạy script test-mail tới hộp thư kiểm soát; kiểm tra Inbox/Spam. Sau đó kiểm tra luồng /verify với mail trường thật, receipt verifyStudent, register/donate và cùng ví ở hai round.

Địa chỉ registry/factory mới đã có trong manifest và đã kiểm tra chỉ đọc. Chưa xác nhận mail trường nhận thư, dữ liệu Supabase thật hay giao dịch tạo round/donate mới. Không dùng private key hay tự deploy trong lần sửa này.

## Cập nhật policy email nhiều trường

ALLOWED_EMAIL_DOMAINS là bắt buộc để xác minh Student; chỉ domain được duyệt chính xác mới được chấp nhận, không tự mở quyền cho subdomain. Thiếu/sai cấu hình thì mode=unconfigured và API không gửi OTP/cấp attestation. BLOCKED_EMAIL_DOMAINS vẫn tùy chọn, chặn cả subdomain và ưu tiên hơn allowlist. Request OTP, confirm OTP và resume attestation đều kiểm tra chính sách hiện hành. GET công khai chỉ trả mode/allowedDomains/blockedDomains cho UI. Đuôi .edu/.edu.vn, bản ghi DNS/MX hoặc OTP thành công không tự chứng minh đang là sinh viên. Cần duyệt namespace sinh viên cùng trường; muốn xác minh tình trạng đang học cần đối chiếu roster hoặc xác nhận từ trường. Xem docs/student-domain-policy.md.

## Cập nhật lỗi danh sách /round

Chẩn đoán đầy đủ, từng kết quả cast, file/dòng trước sửa, số getter và lệnh vận hành hiện có trong `docs/round-loading-fuji.md`. Loader nhận diện legacy, multicall allowFailure, lỗi từng thẻ, batch/retry/fallback. ABI QFRound/RoundFactory khớp artifacts đã compile; không thay contract hay ABI cho sửa lỗi UI này. Manifest đã có thay đổi trước lượt sửa này và được giữ nguyên.

## SF-04 — lưu đơn bền vững

Organizer repository chỉ trả dữ liệu đã được database xác nhận; đã bỏ global process-memory fallback ở create/list/resubmit/update. Lỗi DB 503, revision conflict 409; thông báo realtime và UI success chỉ sau acknowledgment hợp lệ. Thu hồi nhiều đơn approved cùng ví dùng transaction trong migration 0009_organizer_review_atomic.sql. Cần chạy migration trước khi triển khai; chưa chạy production. Xem [báo cáo SF-04](sf04-durable-organizer-applications.md).

## Quyết định MVP open-edu — 27/10/2026

Theo yêu cầu người dùng, bỏ trạng thái khóa Student khi ALLOWED_EMAIL_DOMAINS trống: dùng open-edu cho .edu/.edu.vn, vẫn áp dụng blocklist, OTP và wallet ownership. Cấu hình allowlist tường minh vẫn khớp chính xác; cấu hình sai vẫn fail closed. Xem docs/student-domain-policy.md. Đây thay thế hướng strict-domain bắt buộc trong các mục trước.
