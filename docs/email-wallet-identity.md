# Một email chỉ gắn với một tài khoản ví

## Quy tắc MVP

- Một email đã xác thực chỉ thuộc một ví. Ví khác không được dùng email đó để xác minh sinh viên hoặc đăng ký Organizer.
- Cùng một ví vẫn có thể vừa là sinh viên vừa là Organizer. Gửi lại mã hoặc đăng ký lại bằng đúng ví đó không tạo danh tính email thứ hai.
- Chuẩn hóa khoảng trắng đầu/cuối, chữ hoa/thường và alias `+tag` theo chính sách email đang có. Cả hai luồng dùng cùng định danh Keccak của email chuẩn hóa; không phụ thuộc `OTP_SECRET` để xác định quyền sở hữu email.
- Chỉ nhập email hoặc yêu cầu gửi mã chưa chiếm quyền email. Ràng buộc được ghi sau khi OTP đúng, hoặc sau khi backend kiểm tra token xác thực hợp lệ.
- Từ chối đơn Organizer hoặc thay đổi vai trò không chuyển email sang ví khác.

## Thực hiện

Migration `0004_email_wallet_identity.sql` tạo bảng `email_wallet_bindings` với `email_hash` làm khóa chính, chỉ service role truy cập. RPC `enforce_email_wallet` dùng unique key để phân xử hai yêu cầu xác thực đồng thời; chỉ một ví được sở hữu email.

Dữ liệu sinh viên đã xác thực được chuyển vào bảng binding trong migration. Trigger trên `verifications` duy trì ràng buộc ở DB. Backend cũng kiểm tra các đơn Organizer cũ có `email_verified_at`, theo từng trang để không bỏ sót giới hạn 1.000 dòng của Supabase.

Backend kiểm tra trước khi gửi OTP và sau khi OTP đúng; kiểm tra lại trước khi tạo đơn để token cũ không bỏ qua ràng buộc mới. Nếu DB hoặc migration lỗi, backend từ chối xác thực/tạo đơn thay vì dùng fallback memory để bỏ qua việc kiểm tra.

UI hiển thị `EMAIL_ALREADY_USED` khi email đã thuộc ví khác. Mã lỗi này không bị hiểu nhầm thành trạng thái đơn đang chờ duyệt.

## Áp dụng

1. Đảm bảo migration `0001`, `0002`, `0003` đã chạy.
2. Trong Supabase SQL Editor, chạy toàn bộ `supabase/migrations/0004_email_wallet_identity.sql`.
3. Đưa code mới lên `main`, chạy workflow CI/CD để build và deploy phiên bản mới.
4. Thử email với ví A, rồi thử lại email đó với ví B: ví B phải bị từ chối. Thử tiếp vai trò khác bằng ví A: vẫn được phép theo các điều kiện của vai trò đó.

Không tự áp dụng migration lên Supabase thật trong phiên sửa local này. Không tự xóa tài khoản, thu hồi quyền on-chain hoặc chọn thay chủ sở hữu cho dữ liệu cũ đã trùng. Nếu lịch sử có cùng email đã xác thực cho nhiều ví, backend chặn tái sử dụng và quản trị viên cần xác minh để xử lý dữ liệu đó.

## Kiểm chứng

Đã chạy migration `0001` đến `0004` bằng PostgreSQL cục bộ (PGlite), kiểm tra giữ binding sinh viên cũ, chặn email giữa hai vai trò, cho phép cùng ví có hai vai trò, claim cạnh tranh, trigger và quyền RPC của role `anon`. Không sử dụng Supabase thật cho phép thử này.

Test API kiểm tra từ chối trước khi gửi email, không cấp token/chữ ký khi email bị ví khác claim, token cũ không tạo được đơn và lỗi database không chuyển sang fallback. Test helper bao gồm alias `+tag`, chữ hoa/thường, dữ liệu cũ và phân trang.

Kết quả local: **534 tests pass**, **13 integration tests skipped**; TypeScript, ESLint và production build đạt.
