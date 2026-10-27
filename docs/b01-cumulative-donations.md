# B-01 — Thống nhất đóng góp cộng dồn

Ngày: 27/10/2026. Không commit/push hoặc chạy GitHub workflow.

## Nghiệp vụ và thay đổi

Cho phép một ví Student góp nhiều lần vào cùng dự án. `donationOf(wallet, project)` là tổng cộng dồn; `maxDonation` giới hạn tổng của ví trên từng dự án, `maxPerRound` giới hạn tổng trong round. Round không đặt trần vẫn không có giới hạn giả do UI tự thêm. Vẫn áp dụng minimum mỗi giao dịch, số dư, quyền tham gia, thời gian round và cấm tự góp dự án của mình.

Contract hiện tại đã tính đúng: donorCount chỉ tăng khi tổng cũ bằng 0, sumSqrt thay bằng căn của tổng mới. Không sửa contract nguồn, ABI, địa chỉ hoặc triển khai lại contract. Một ví chỉ tính một supporter trên mỗi dự án; đây không phải bảo đảm một ví tương ứng một con người, cũng không phải cơ chế chống thông đồng.

- ProjectCard giữ huy hiệu đã góp và cho mở luồng góp thêm.
- DonateBox hiển thị lịch sử song song với form. Sau receipt thành công, refresh dữ liệu và chỉ mở form lại qua nút Ủng hộ thêm. Đọc tổng đã góp/ngân sách bị lỗi hoặc chưa có kết quả thì không cho gửi.
- BatchDonationForm cho cấp thêm vào dự án đã góp, kiểm tra tổng cũ + khoản mới và ngân sách chung. Khóa trong lúc gửi/refresh và xóa allocation sau thành công. Đổi ví/chain/round khởi tạo phiên form mới; form đơn cũng tách theo project.
- Cập nhật hướng dẫn tiếng Việt/Anh và README.

## Kiểm chứng

- Bộ test ứng dụng trước nâng Next.js: 965 đạt, 13 bỏ qua theo cấu hình.
- 182 test Solidity đạt, gồm regression mới góp đơn rồi batch rồi đơn: donorCount = 1, căn theo tổng 5 USDC, không tự sinh matching; batch vượt trần rollback.
- Test DOM dùng component thật và mock ranh giới RPC/wallet: gửi top-up, reset sau success, trần cộng dồn, ngân sách round chung, failed reads, self-donation, đổi ví.
- Test QF preview: chia khoản góp của một ví qua nhiều lần cho cùng kết quả như góp tổng một lần; một supporter vẫn không có raw matching.
- Bản snapshot deploy dùng lại chính sách email hiện hành; 110 test email/OTP theo chính sách này đạt. Chỉnh sửa strict-domain chưa chốt vẫn chỉ ở workspace.

## Dependency phát hiện khi build

Build có mạng báo advisory cho Next.js 16.4.0; nâng Next.js và eslint-config-next cùng bản vá 16.4.1. Tham chiếu: https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw . Đây là cảnh báo dependency, không phải bằng chứng hệ thống đã bị khai thác. Audit cũng báo các dependency khác, gồm dev tooling và nhánh WalletConnect/email; chưa xử lý toàn bộ audit trong B-01 và không kết luận codebase hết lỗ hổng.

## Phạm vi deploy

Deploy SF-01–SF-04 và B-01, giữ chính sách email Student đang chạy. Người dùng xác nhận đã chạy migrations 0008 và 0009. Không đưa env/secret, test, docs hoặc dữ liệu review vào source deploy. Không thử giao dịch tiền hoặc upload provider thật trên production. Kết quả deploy/HTTP bổ sung sau khi hoàn thành.

Sau nâng Next.js: toàn bộ 965 test ứng dụng đạt, 13 test integration bỏ qua; typecheck đạt; ESLint 0 lỗi/4 cảnh báo unused cũ; frozen lockfile đạt; production snapshot build đạt. Audit không còn advisory cho Next.js. Các advisory dependency còn lại: 10 moderate, 4 high, 2 critical (hai advisory critical thuộc dev dependency tinypool). Chưa đánh giá đầy đủ khả năng khai thác từng nhánh; không coi số test đạt là chứng nhận an toàn tuyệt đối.

## Kết quả production

Deploy READY lúc khoảng 12:13 ngày 27/10/2026 (UTC+7), deployment `dpl_AEStqHsgerpdoSEa36fM1JBsSfYE`, alias https://www.sqrtfund.tech . Nguồn snapshot `/tmp/sqrtfund-b01-deploy`, giữ bốn file chính sách Student từ HEAD và chỉ đưa các thay đổi B-01 của `copy.ts` vào snapshot. Không commit/push; HEAD workspace vẫn `25afba7`.

Kiểm tra HTTP live sau deploy:

- 10 kiểm tra SF-01 đạt: anonymous/credential hỏng/hết hạn 401, ví thử có chữ ký đọc danh sách của mình 200 với 0 đơn, đọc ví khác/toàn bộ bằng non-owner 403; response API no-store. Không đọc dữ liệu đơn của người thật.
- 8 kiểm tra SF-02 đạt: request thiếu proof hoặc proof giả đúng cấu trúc mới bị chặn 401 cho Student/Organizer; confirm Student bằng request ID fixture không tồn tại trả OTP_EXPIRED. Không gửi email, không cấp quyền Student/Organizer hoặc tạo binding.
- Trang chủ 200; client bundle production có hướng dẫn góp cộng dồn mới. API policy vẫn `open-edu` như phạm vi deploy; upload anonymous trả 401/no-store.

Không chạy giao dịch donate thật hoặc upload ảnh thật trên production; luồng gửi/top-up được kiểm thử bằng DOM mock và Solidity local. Không kết luận đã test positive wallet end-to-end trên live. SF-04 atomic review được kiểm chứng trên fixture local; không review/thu hồi đơn thật để thử trên production.

**Lưu ý lần push sau:** workspace vẫn chứa các chỉnh sửa strict-domain chưa chốt (domain.ts, request-otp, confirm, StudentVerifyBox, copy.ts, helper mới và tests/docs). Push toàn bộ rồi auto-deploy sẽ khác snapshot vừa deploy và có thể khóa xác minh Student mới khi thiếu ALLOWED_EMAIL_DOMAINS. Cần chốt/tách thay đổi đó trước khi push.
