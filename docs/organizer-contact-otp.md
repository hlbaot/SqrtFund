# Xác thực email liên hệ Organizer

## Luồng sử dụng

1. Kết nối ví, mở đơn đăng ký Organizer và nhập email liên hệ. Không yêu cầu email trường.
2. Bấm **Gửi mã OTP**, nhập mã 6 số rồi bấm **Xác thực mã**.
3. Khi email được xác thực, nút **Gửi đơn đăng ký** được mở. Đổi email hoặc ví sẽ yêu cầu xác thực lại.
4. Backend kiểm tra bằng chứng xác thực gắn với đúng email, ví và thời hạn trước khi tạo đơn. Cờ `emailVerified` hoặc thời gian do client tự truyền không có giá trị xác thực.
5. Platform Dashboard hiển thị nhãn **Email đã xác thực** cho đơn mới. Đơn cũ chưa qua OTP vẫn ghi **Email chưa xác thực**.

Xác thực email chỉ chứng minh quyền truy cập hộp thư. Không xác minh tư cách đại diện tổ chức, không xác minh sinh viên và không tự cấp quyền Organizer. Platform Owner vẫn phải duyệt và cấp quyền trên contract.

## Thành phần

- `POST /api/organizer-applications/email`, action `request`: kiểm tra đầu vào, giữ hạn mức trong database, lưu hash OTP rồi gửi email.
- Cùng endpoint, action `verify`: gọi RPC tiêu thụ OTP một lần, sau đó trả bằng chứng xác thực có chữ ký HMAC.
- `POST /api/organizer-applications`: bắt buộc `emailVerificationToken` hợp lệ. Chặn token sai email/ví, hết hạn hoặc bị sửa.
- OTP và token được tách mục đích khỏi luồng xác minh sinh viên. Không dùng attester hoặc tạo chữ ký on-chain trong luồng này.

## Thời hạn và hạn mức

- OTP hết hạn sau **10 phút**, tối đa **5 lần thử** cho mỗi mã.
- Gửi lại sau ít nhất **60 giây**, vô hiệu mã cũ của cùng ví/email.
- Mỗi email và mỗi ví được yêu cầu tối đa **5 mã/giờ**; mỗi IP tối đa **20 mã/giờ**.
- Bằng chứng sau khi xác thực hết hạn sau **15 phút** và chỉ dùng cho đúng email/ví đó.
- SQL giữ kiểm tra hạn mức và ghi yêu cầu trong cùng transaction; khóa hàng khi kiểm tra OTP để ngăn dùng mã đồng thời.
- Không lưu OTP thô hoặc email thô trong bảng OTP. Các RPC/bảng OTP chỉ dành cho service role. Lỗi database không được thay thế bằng bộ nhớ để bỏ qua xác thực.

## Cấu hình và migration cần thực hiện

Chạy các migration theo thứ tự, đặc biệt file mới:

`supabase/migrations/0003_organizer_contact_otp.sql`

Migration này thêm `email_verified_at` vào bảng đơn đăng ký, tạo bảng OTP và hai RPC dành cho service role. Chưa áp dụng migration lên database từ phiên sửa local này.

Dùng cấu hình gửi email đang có: `OTP_SECRET` ít nhất 32 ký tự, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_PROVIDER`, `SMTP_FROM`, cùng thông tin SMTP hoặc `RESEND_API_KEY`. Không cần `ATTESTER_PRIVATE_KEY` để xác thực email liên hệ. Không đưa các biến bí mật vào `NEXT_PUBLIC_*`.

Sau khi cấu hình hoặc đổi biến môi trường, khởi động lại dev server. Trước khi dùng thật, kiểm tra gửi/nhập mã bằng hộp thư của chính bạn.

## Kiểm chứng local

Test bao gồm mã đúng/sai/hết hạn/bị khóa, giới hạn gửi, lỗi SMTP/database, token sai email/ví/bị sửa/hết hạn, gọi API trực tiếp không qua OTP, trạng thái nút gửi đơn và nội dung email riêng cho Organizer. Test gửi email dùng mock, không gửi email thực ra ngoài.

Kết quả cuối: **515 tests pass**, **13 integration tests skipped**; ESLint, kiểm tra TypeScript và production build đạt. Bộ test tổng thể được chạy với `--maxWorkers=2` sau khi build kết thúc để tránh thiếu tài nguyên. Chưa kiểm tra RPC SQL mới trên Supabase thật hoặc gửi thư thật vì migration chưa được áp dụng trong phạm vi sửa local.
