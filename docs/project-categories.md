# Danh mục dự án và round

## Trải nghiệm

Năm lĩnh vực chính: Công nghệ và nghiên cứu; Giáo dục và học thuật; Cộng đồng và thiện nguyện; Môi trường và phát triển bền vững; Văn hóa và nghệ thuật. Mỗi lĩnh vực có ví dụ, yêu cầu minh chứng phù hợp trong form đăng ký, chi tiết dự án và thẻ xét duyệt của Organizer.

Chủ dự án chọn một lĩnh vực chính. Sau receipt đăng ký thành công, ví ký thêm để lưu danh mục công khai vào database. Bản ghi không thể sửa sau khi lưu; biểu mẫu giải thích rõ trước xác nhận. Nếu lưu thất bại, giao dịch đăng ký vẫn thành công và UI hướng dẫn vào chi tiết dự án để ký bổ sung mà không đăng ký lại. Dự án cũ cho phép chủ ví bổ sung danh mục theo cùng luồng; không tự suy luận từ mô tả.

Đã bỏ việc gán mặc định tất cả dữ liệu đọc từ chain thành `technology`. Hook chung ghép danh mục đã ký với dự án theo round/project ID nên giữ đúng khi tải lại và sau chain sync. Dự án chưa có bản ghi hiện “Chưa phân loại”; khi dịch vụ danh mục lỗi, trang chi tiết và trang round hiển thị cảnh báo phù hợp.

Bộ lọc lĩnh vực bao gồm năm nhóm và “Chưa phân loại”, áp dụng cả bảng/mobile và podium. Nhãn lĩnh vực xuất hiện trên card, danh tính trên bảng xếp hạng, podium và chi tiết dự án. Bộ lọc không tính lại matching hoặc hạng toàn vòng.

Organizer chọn một/nhiều danh mục trong phần ký công bố tiêu chí round, trước khi có dự án đầu tiên. Một lĩnh vực là round chuyên đề; nhiều lĩnh vực là round tổng hợp. Policy cũ không có danh sách được hiểu là chưa hạn chế lĩnh vực (tất cả năm nhóm). Policy đã công bố vẫn bất biến, không backfill hay sửa policy cũ.

## Lưu trữ và quyền

Tái sử dụng `round_governance` với kind `category` và khóa `category:<projectId>`. API xác minh chữ ký, origin, Fuji, Factory và quyền sở hữu dự án trên chain; danh mục/project ID/round được ràng buộc trong chữ ký. Probe phiên bản bảo toàn khả năng đọc các round cũ; lỗi RPC không bị coi là round legacy. API kiểm tra danh mục nằm trong danh sách policy round, không ghi nếu đọc policy lỗi. Unique constraint và trigger sẵn có chống ghi đè/sửa/xóa. API không nhận `uncategorized` như một lựa chọn công bố.

Không đổi contract, ABI, công thức QF hoặc phân bổ ngân sách theo nhóm. Ràng buộc lĩnh vực là quy tắc của ứng dụng/API; contract cũ vẫn cho phép đăng ký trực tiếp bên ngoài ứng dụng. Các lĩnh vực trong cùng round chia sẻ quỹ matching; cần round riêng để có ngân sách độc lập. Hai bước giao dịch chain và lưu database không nguyên tử.

## Triển khai

Chạy migrations đến `0011_round_governance.sql` nếu chưa có, rồi `0012_project_categories.sql`, sau đó deploy frontend/API. Không cần secret mới. Migration mới mở rộng các constraint, không sửa dữ liệu đã công bố. Tác vụ chỉ chạy migrations trong PostgreSQL local cô lập, không thay đổi database production hoặc ký ví thật.

## Kiểm chứng

- Kiểm thử quyền chủ dự án, chữ ký bị thay đổi, danh mục hợp lệ/ngoài policy, lỗi database, tải lại dữ liệu, recovery sau đăng ký và bộ lọc cả podium/danh sách.
- TypeScript và ESLint các file thay đổi đạt.
- PostgreSQL 17 local: migrations 0001–0012, 8 SQL fixtures đạt; chạy lại migration 0012 thành công.
- Chưa kiểm thử lưu danh mục bằng ví thật end-to-end.
