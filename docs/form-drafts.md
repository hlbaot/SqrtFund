# Lưu nháp tạo dự án và tạo Round

- Form tự lưu nội dung ngay khi nhập vào localStorage của trình duyệt. Điều hướng, đóng tab, reload hoặc quay lại vẫn khôi phục được trên cùng trình duyệt/origin.
- Nháp Round gồm tên, đơn vị tổ chức, ngày bắt đầu/kết thúc, trần matching và số tiền quỹ dự kiến.
- Nháp dự án gồm tên, danh mục, mô tả, liên hệ và URL ảnh sau khi upload thành công. File ảnh chưa upload xong không thể phục hồi chỉ từ localStorage.
- Mỗi nháp tách theo chain mục tiêu, Factory và ví. Dự án tách thêm theo Round; lưu lựa chọn Round gần nhất khi chọn hoặc nhập nội dung. Round trên URL được ưu tiên khi có.
- Nếu Round đã hết đăng ký, không tự chuyển nháp sang Round khác. Có thể chọn Round mở khác và nhập nháp riêng của Round đó.
- Chỉ xóa nháp sau receipt tạo dự án/tạo Round thành công, hoặc khi người dùng bấm **Bỏ bản nháp**. Hủy ký, revert, lỗi upload, validation hoặc nạp quỹ thành công chưa xóa nháp.
- Giao dịch cũ xác nhận muộn chỉ xóa phiên bản đã gửi; nếu người dùng sửa nội dung trong lúc chờ thì giữ lại nội dung mới. Callback giữ key gốc nên không xóa nháp ví/Round mới sau khi đổi tài khoản.
- Bỏ nháp chỉ xóa nội dung form. Nó không rút tiền credit đã nạp vào Factory, hủy Round hoặc xóa ảnh trên dịch vụ lưu ảnh.
- Nháp không tự gửi giao dịch, không cấp quyền, không đưa lên Supabase hoặc blockchain. Khi bấm tạo vẫn chạy đầy đủ validation, kiểm tra quyền, lịch và ký ví như trước.
- Nháp chưa đồng bộ giữa thiết bị hoặc giữa localhost và domain production. Xóa dữ liệu trình duyệt cũng xóa nháp. Nếu localStorage bị chặn/đầy, UI báo lưu không thành công và chỉ giữ tạm trong phiên ứng dụng.
- Không lưu private key, OTP, chữ ký hoặc transaction state vào bản nháp.

## Code

- `src/lib/formDrafts.ts`: key theo phạm vi, schema/version, lưu/khôi phục/xóa, bảo vệ phiên bản khi giao dịch trả về muộn. Có comment tiếng Việt.
- `src/hooks/useFormDraft.ts`: đọc storage sau mount, snapshot SSR ổn định; lắng nghe cập nhật/xóa nháp từ tab khác.
- `src/components/common/FormDraftStatus.tsx`: trạng thái nháp và nút bỏ nháp.
- `src/components/project/ProjectForm.tsx`, `src/components/admin/CreateRoundForm.tsx`: tích hợp form và thời điểm xóa sau thành công.

Ngày giờ mặc định của Round mới được tạo sau mount nếu không có nháp. Ngày giờ trong nháp được giữ nguyên, kể cả đã qua hạn, để người dùng xem và sửa trước khi tạo. Không tự dời lịch đã nhập.

## Kiểm tra

Test local kiểm tra khôi phục toàn bộ nội dung; tách ví/chain/Factory/Round; không ghi đè nháp lúc hydrate; lỗi storage; dữ liệu cũ/hỏng; đồng bộ xóa giữa tab; receipt thành công/thất bại; nạp quỹ chưa xóa; giao dịch trễ không xóa nội dung mới; SSR không đọc localStorage.

Kết quả: toàn bộ suite 724 test đạt, 13 integration test không bật. Production build và TypeScript đạt; ESLint không có lỗi, còn các warning unused đã có trước ở những file khác/phần code cũ. Chưa deploy website hoặc gửi giao dịch thật cho thay đổi lưu nháp.
