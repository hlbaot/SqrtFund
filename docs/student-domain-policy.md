# Chính sách email Student — MVP open-edu

## Quyết định hiện hành

Ngày 27/10/2026, người dùng chọn giữ `open-edu` cho MVP. Bản strict-domain đã merge trước đó trả `unconfigured` khi chưa có allowlist, làm khóa xác minh Student mới; thay đổi hiện tại khôi phục open-edu khi danh sách trống.

- `ALLOWED_EMAIL_DOMAINS` trống hoặc chưa đặt: `mode=open-edu`, nhận địa chỉ hợp lệ có domain kết thúc bằng `.edu` hoặc `.edu.vn`. Không nhận domain gốc `edu.vn`, địa chỉ lỗi hoặc domain giả dạng như `school.edu.vn.evil.com`.
- Nếu có allowlist hợp lệ: `mode=allowlist`, chỉ nhận domain khớp chính xác; subdomain cần liệt kê riêng. Giữ cơ chế này để có thể giới hạn pilot sau này.
- Nếu cấu hình domain không hợp lệ: `mode=unconfigured`, khóa gửi mã và trả `STUDENT_DOMAIN_POLICY_UNCONFIGURED` (503). Không tự mở rộng điều kiện khi cấu hình sai.
- `BLOCKED_EMAIL_DOMAINS` ưu tiên chặn domain và các subdomain, áp dụng cho cả hai chế độ.
- API request OTP, confirm OTP và resume attestation đều kiểm tra chính sách hiện hành. UI dùng cùng validator và hiển thị chế độ open-edu rõ ràng.

## Những kiểm tra vẫn bắt buộc

Chữ ký ví đúng identity, origin và deployment; OTP đúng/hợp lệ/chưa dùng; ràng buộc email–ví và uniqueness; rate limit; kiểm tra registry. Không thay đổi quyền đọc Organizer, upload auth/quota, lưu trữ Organizer hoặc cơ chế góp cộng dồn. Không cần migration mới, không sửa smart contract.

OTP chứng minh quyền đọc hộp thư, chữ ký chứng minh quyền điều khiển ví. Open-edu không xác nhận trường phát hành hộp thư hay người dùng thực sự đang học. Do đó trường hợp người dùng kiểm soát một mailbox có hậu tố giáo dục vẫn có thể đáp ứng chính sách MVP; đây là giới hạn nghiệp vụ được giữ theo yêu cầu.

## Cấu hình

Để dùng open-edu, để trống ALLOWED_EMAIL_DOMAINS; blocklist có thể để trống hoặc chứa domain muốn loại. Khi pilot cần allowlist, đặt danh sách domain chính xác, cách nhau bằng dấu phẩy. Không đưa secret/email/ví người thật vào tài liệu.

## Kiểm thử

Test validator gồm open-edu, hậu tố giả dạng, địa chỉ sai, blocklist, allowlist chính xác và cấu hình sai. Test API gồm request/confirm open-edu, OTP lỗi và proof ví sai/thiếu; test UI xác nhận form mở khi allowlist trống và khóa khi cấu hình lỗi. Các test dương tính dùng DB/mail/registry fixture; không gửi OTP thật trong kiểm thử production.

## Kết quả triển khai 27/10/2026

- 972 test ứng dụng đạt; 13 integration test bỏ qua theo cấu hình. Typecheck, lint các file sửa và build snapshot production đạt. Không thay Solidity nên không chạy lại test contract trong thay đổi này.
- Deployment `dpl_FYT3yLCy1JYCswyE3J3MyFfzKcgU` READY, alias https://www.sqrtfund.tech . Snapshot source tại /tmp/sqrtfund-openedu-deploy, không có env/secret.
- Kiểm tra live lúc 13:46 (UTC+7): API public trả mode=open-edu; trang chủ 200; thiếu/giả proof Student và Organizer bị chặn 401; request OTP fixture không tồn tại trả OTP_EXPIRED; đọc đơn anonymous và upload anonymous vẫn 401. Nội dung góp cộng dồn B-01 vẫn có trên live.
- Không gửi OTP/email thật, không tạo binding hoặc cấp quyền on-chain để thử trên production. Dương tính request/confirm được kiểm tra qua fixture local.
- Chưa commit/push, chưa chạy workflow từ xa. Cần đưa thay đổi hiện tại lên Git để lần auto-deploy sau giữ cùng chính sách; main từ lần merge trước vẫn là strict-domain.
