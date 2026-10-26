# SF-02 — Chứng minh quyền ví trước liên kết email

## Nguyên nhân và thay đổi

OTP chứng minh quyền truy cập email, không chứng minh quyền điều khiển địa chỉ ví trong request. Trước bản sửa, người đọc được email có thể yêu cầu liên kết với một ví chưa thuộc email khác, gây chặn xác minh hợp lệ sau này.

Student và Organizer hiện phải ký thông điệp EIP-191 trước khi gửi mã. API kiểm chứng chữ ký ở request và confirm, trước mọi claim và trước consume OTP. Student resume `ALREADY_VERIFIED` cũng phải chứng minh quyền ví. Chữ ký gắn với email chuẩn hóa (bỏ `+tag` như SQL hiện hành), ví, purpose Student/Organizer, origin, deployment (StudentRegistry cho Student, Factory cho Organizer), Fuji 43113, thời gian và nonce. Hạn 10 phút; OTP vẫn 5 phút, dùng một lần. Chữ ký được giữ trong bộ nhớ trình duyệt; không đặt trong URL, localStorage, sessionStorage hoặc báo cáo.

Đây là giấy phép ngắn hạn cho đúng một cặp email–ví và mục đích, có thể dùng lại trong thời hạn đó. Nonce không phải challenge một lần phía server; cơ chế này không tuyên bố chặn replay cùng cặp trong thời hạn. Replay không cho phép đổi ví/email và vẫn cần OTP hợp lệ chưa dùng để claim mới. Đổi email/ví hoặc đóng phiên khiến proof cũ không còn dùng trong UI. Từ chối ký không gửi mail.

Token Organizer đổi purpose sang `organizer-contact-email-wallet-v2`, khiến token trước bản sửa hết hiệu lực ngay. Tạo đơn mới dùng token v2 đã qua OTP + wallet proof; gửi lại đơn dùng chữ ký ví hiện có và không tạo binding mới. OTP cũ muốn confirm cũng cần proof hợp lệ. Bản sửa không tự xác nhận lại quyền sở hữu cho dữ liệu lịch sử.

Phạm vi hiện tại: ví EOA/Core, chữ ký 65 byte. Chưa hỗ trợ ERC-1271/smart-contract wallet. Cần bổ sung verifier phù hợp khi triển khai account abstraction.

## SQL và ranh giới tin cậy

Không cần thay schema production. SQL tiếp tục giữ uniqueness, khóa đồng thời và quyền server-only trong migrations 0001–0007. PostgreSQL không tự xác minh EIP-191; server kiểm chứng ví trước khi gọi RPC bằng service role. Người giữ service-role key/DB owner vẫn thuộc miền tin cậy. Không cấp key này cho trình duyệt.

Đã chạy toàn bộ migrations trên PostgreSQL 17.9 độc lập qua Unix socket trong `/tmp`, không kết nối Supabase production. Ba script `otp_lifecycle.sql`, `plain_email_wallet.sql`, `sf02_recovery.sql` đều qua và rollback dữ liệu fixture. Kiểm tra: chuẩn hóa alias, ID ổn định, unique email/ví, chặn claim xung đột, bảo vệ legacy Student/Organizer, trigger verifications, quyền anon/service role, OTP hết hạn/dùng lại và recovery.

## Recovery có kiểm soát

`supabase/recovery/sf02_orphan_recovery.sql` là công cụ SQL cho operator, tạo function chỉ tồn tại trong session `pg_temp`. Không có HTTP recovery endpoint và không được tự động chạy trên dữ liệu thật. Không phải migration deployment.

Quy trình cho một trường hợp thật:

1. Xác minh người yêu cầu điều khiển ví và email đúng mà họ muốn dùng, bằng chữ ký mới + OTP mới; không yêu cầu họ điều khiển email đã bị gắn sai. Lưu chứng cứ và lý do ở kênh hạn chế quyền đọc, không trong issue/screenshot công khai.
2. Đọc trạng thái StudentRegistry, Factory và các round liên quan đúng deployment. Nếu có quyền/hoạt động on-chain, lịch sử xác minh hoặc đơn Organizer, dừng quy trình giải phóng mồ côi và đánh giá riêng. SQL không thể biết trạng thái on-chain.
3. Bảo đảm production đã chạy bản sửa, phiên cũ không còn quyền tạo binding; chờ hết cửa sổ attestation đã cấp (Student hiện 1 giờ), token Organizer cũ hết hiệu lực do version. Kiểm tra lại chain sau thời gian chờ. Không thể thu hồi một attestation đã phát chỉ bằng xóa DB.
4. Trong transaction riêng, load script bằng `\ir`; gọi function với email đang gắn sai, ví, verification ID dự kiến và ba cờ xác nhận đã kiểm tra bằng chứng, chain, cửa sổ cấp chữ ký. Những cờ này là xác nhận của operator, không phải bằng chứng tự động. Function khóa các bảng liên quan, kiểm tra dữ liệu dự kiến, từ chối mọi lịch sử verifications/Organizer hoặc legacy identity khác, vô hiệu OTP rồi đặt binding mồ côi về chưa gắn ví. Giữ nguyên stable ID, không chuyển thẳng sang danh tính mới.
5. Kiểm tra kết quả trong transaction; mặc định thử bằng ROLLBACK. Chỉ COMMIT sau khi case được duyệt. Người dùng sau đó xác minh lại qua giao diện bằng ví + email đúng. Không công khai tham số SQL hoặc kết quả chứa danh tính.

Fixture đã kiểm tra: từ chối thiếu xác nhận review, sai expected ID, bảo vệ attestation và hồ sơ Organizer; giải phóng orphan hợp lệ; OTP cũ bị vô hiệu; ví có thể liên kết email đúng sau recovery. Không có liên kết thật nào được xóa, di chuyển hoặc sửa trong tác vụ này.

## Kiểm thử ứng dụng

- 27 test với chữ ký EOA thật và dependency giả cho DB/mail/attester: chữ ký đúng; chữ ký ví khác; sửa email/ví/purpose/origin/Factory/chain/nonce/hạn; hết hạn, ngày tương lai, TTL sai; từ chối request không có proof trước claim/consume/mail/attestation; Student confirm/resume và Organizer confirm hợp lệ; từ chối token HMAC trước bản sửa.
- 8 test UI: chỉ ký sau thao tác người dùng, dùng lại proof cho confirm, hủy ký không gửi mail, đổi email ký lại, đổi ví khi hộp thoại ký đang mở loại kết quả cũ, reset phiên xóa credential.
- Bộ test sẵn có giữ nguyên nghiệp vụ OTP/registry; dependency xác thực ví được mock ở các bài unit chuyên OTP. Bài security mới dùng verifier thật để tránh dựa vào mock cho kết luận về quyền ví.

## Production

Đã triển khai thành công lên https://www.sqrtfund.tech ngày 26/10/2026. Deployment `dpl_DkUfksmG2bJa3dpDMR4fnJDAmDtD`, trạng thái READY. Không cần migration production.

8/8 kiểm tra HTTP production bằng fixture đã qua: thiếu/giả chữ ký ở Student request và Organizer request/confirm trả 401 với đúng mã WALLET_PROOF_REQUIRED/INVALID; Student confirm với UUID không tồn tại trả OTP_EXPIRED 400; SF-01 anonymous read tiếp tục bị chặn 401; trang chủ 200. Kiểm tra Student confirm dương tính và luồng claim hợp lệ dùng chữ ký thật được thực hiện local với DB/mail/attester giả, không dùng ví/email thật trên production. Không gửi email, consume OTP thật, tạo binding hoặc chạy recovery trên production. Bằng chứng đã lược dữ liệu danh tính lưu trong `docs/evidence/sf02-production-verification-2026-10-26.json` (gitignored).

Kiểm tra tại lần triển khai SF-02 trước đó: 869 test qua, 13 integration test bỏ qua theo cấu hình; typecheck và Next.js webpack build qua. ESLint không có lỗi, 6 warning (5 warning unused hiện có và 1 warning heuristic cho ref counter trong cleanup). Không thay smart contract. Các thay đổi vẫn ở working tree, chưa commit/push; cần đưa bản vá vào repository để lần deploy từ Git sau không ghi đè bản sửa.

## Rà soát local bổ sung ngày 27/10/2026

Student proof hiện gắn với StudentRegistry thay vì Factory, giữ đúng kiến trúc xác minh Student độc lập với round/factory. Test dùng verifier thật chứng minh vẫn xác thực được khi Factory không cấu hình. Signature schema mới dùng trường `deployment`; không nhận lại proof schema cũ sau khi deploy. Phiên frontend cũ cần tải lại và ký mới.

Hook OTP xóa challenge/token/code khi đổi danh tính, không khôi phục token khi đổi email rồi quay lại. Request bị rate limit không được ghép requestId/expiry từ email trước. Verify thiếu challenge hoặc chưa đủ sáu số không mở ví/gửi request. Test đã bao phủ các trường hợp này. Bản bổ sung chỉ ở local, chưa commit/push/deploy theo yêu cầu mới nhất.
