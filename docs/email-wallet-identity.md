# Ràng buộc một email – một ví

## Quy tắc MVP hiện tại

- Lưu email trực tiếp ở backend, chuẩn hoá chữ thường, khoảng trắng đầu/cuối và alias `+tag`.
- Một email đã xác thực chỉ gắn với một ví. Một ví đã liên kết cũng không dùng email khác. Cùng cặp email–ví được dùng cho cả Sinh viên và Organizer.
- Yêu cầu gửi OTP chưa chiếm email hoặc ví. Chỉ liên kết sau khi xác nhận OTP hoặc kiểm tra token email hợp lệ.
- Từ chối/thu hồi Organizer không giải phóng email cho một ví khác.

## Cách lưu

Migration `0006_plain_email_wallet.sql` tạo bảng riêng tư `email_wallet_links`:

| Cột | Ý nghĩa |
| --- | --- |
| `email` | Email chuẩn hoá, khoá chính; không mã hoá |
| `wallet_address` | Ví duy nhất, để trống trước khi xác minh |
| `verification_id` | ID ngẫu nhiên 32 byte, duy nhất và ổn định qua các lần gửi lại OTP |
| `verified_at` | Thời điểm liên kết đã được xác minh |

RPC `enforce_plain_email_wallet` kiểm tra và liên kết theo transaction, khoá cả email và ví theo thứ tự cố định. PRIMARY KEY/UNIQUE tại database bảo đảm ràng buộc khi nhiều instance API xử lý cùng lúc. Bảng, RPC chỉ cho service role truy cập; không cung cấp danh sách email cho trình duyệt.

Luồng sinh viên lưu thêm email trực tiếp trong `otp_requests.email` và `verifications.email`. Email liên hệ Organizer vẫn được lưu trực tiếp trong đơn đăng ký.

## Tương thích contract và dữ liệu cũ

Contract StudentRegistry đã deploy vẫn có tham số `emailHash` kiểu `bytes32`. Với email mới, backend dùng ID ngẫu nhiên, không dùng hash email làm định danh mới. Giữ tên trường trong ABI/API để không phải deploy lại Registry, Factory và các Round.

Backend còn tính Keccak **chỉ để tìm bản ghi legacy** đã tồn tại từ phiên bản trước. Nếu có bản ghi cũ, dùng lại đúng ID cũ để giữ trạng thái xác minh trên contract. Không thể khôi phục email trực tiếp từ các bản ghi chỉ có hash: email được ghi khi người dùng quay lại với email hợp lệ, không tự đoán hay giải mã dữ liệu cũ.

OTP vẫn được hash; token email vẫn được ký chống sửa. Đây là cơ chế bảo vệ mã xác thực, không phải mã hoá email.

Các dữ liệu cũ mâu thuẫn (cùng email nhiều ví hoặc cùng ví nhiều email) bị chặn và cần kiểm tra thủ công. Không tự xoá hoặc chọn thay chủ sở hữu.

## Áp dụng

1. Đảm bảo migrations `0001`–`0005` đã áp dụng.
2. Chạy toàn bộ `supabase/migrations/0006_plain_email_wallet.sql` trên Supabase đúng môi trường.
3. Build và deploy code mới qua CI/CD; local khởi động lại dev server.
4. Gửi lại OTP nếu mã được tạo trước migration. OTP cũ được vô hiệu vì chưa có email trực tiếp/ID mới.

Migration thu hồi quyền gọi RPC legacy của service role để API cũ không tạo binding trái mô hình mới. Vì vậy cần triển khai migration và code mới cùng đợt: từ lúc migration xong đến lúc code mới hoạt động, các API xác minh cũ sẽ báo lỗi thay vì bỏ qua ràng buộc. Không chạy lại migration cũ để khôi phục quyền RPC legacy.

Chưa tự áp dụng migration lên Supabase thật hoặc deploy trong lần sửa local này.

## Kiểm chứng

- Unit/API: email trực tiếp, ID ngẫu nhiên, alias, chặn cả hai chiều, chỉ ký đúng ID của email, OTP legacy yêu cầu gửi lại và thiếu migration phải báo lỗi.
- Database: chạy migrations `0001`–`0006` trong PostgreSQL cục bộ PGlite, sau đó chạy `supabase/tests/plain_email_wallet.sql`; kiểm tra ID ổn định, ràng buộc hai chiều, Student/Organizer dùng cùng cặp email–ví, dữ liệu legacy, trigger và quyền truy cập.
- Không gửi email thật hoặc ký giao dịch bằng ví người dùng để kiểm thử.
