# Admin nền tảng và quyền duyệt Organizer

Nguồn xác định Admin duy nhất là `RoundFactory.owner()` trên mạng Fuji và Factory đang cấu hình qua `NEXT_PUBLIC_FACTORY_ADDRESS`. Không thêm danh sách ví Admin hoặc role Admin tự khai báo trong localStorage/Database.

- Organizer quản lý các round thuộc ví của mình. Organizer không thấy tab Cấp quyền Organizer; URL `?tab=platform` được đưa về giao diện Organizer.
- Sinh viên không được hiển thị dashboard cấp quyền.
- Chỉ owner hiện tại của Factory thấy dashboard cấp/thu hồi quyền và duyệt/từ chối đơn.
- Hợp đồng `setOrganizer` vẫn kiểm tra `onlyOwner`; lựa chọn hồ sơ ví không cấp quyền này.

## API cập nhật đơn

`PATCH /api/organizer-applications` yêu cầu chữ ký thông điệp của owner hiện tại. Thông điệp chứa chain, Factory, ID đơn, quyết định, hash giao dịch nếu có, người duyệt, phiên bản `updatedAt` của đơn và thời điểm ký.

Backend đọc `owner()` từ RPC trên mỗi lần xác thực và kiểm tra chữ ký. Thông điệp có hiệu lực 5 phút, không dùng được cho Factory/chain hoặc quyết định khác. Cập nhật DB có điều kiện `id` và `updated_at` để bản ký cũ không ghi đè quyết định mới. Không cần migration DB mới.

Khi duyệt đơn: xác nhận giao dịch `setOrganizer` trên Fuji → ký thông điệp quyết định → API cập nhật trạng thái đơn. Từ chối đơn chỉ cần ký thông điệp, không có giao dịch cấp quyền. Người duyệt phải hoàn tất bước ký; nếu hủy ký sau khi cấp quyền on-chain, quyền on-chain đã cấp vẫn tồn tại còn đơn chưa được cập nhật.

Nếu muốn đổi ví Admin, owner hiện tại cần gọi `transferOwnership(newOwner)` trên Factory. Sau khi chuyển, ví cũ không còn quyền Admin. Đổi địa chỉ ví trong `.env` không thay thế được bước chuyển quyền trên contract.
