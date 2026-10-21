# Báo cáo sửa phân quyền frontend và hai Dashboard

## Phạm vi

Sửa code local cho MVP Multi-Organizer. Không ký giao dịch, deploy mới hoặc tự ghi địa chỉ Factory chưa xác minh vào cấu hình.

## Thay đổi

- Nhận diện quyền quản trị từ Factory và danh sách vòng thuộc ví, thay vì chỉ dựa vào vòng mới nhất. Organizer bị thu hồi vẫn vào Dashboard và quản lý các vòng cũ; không được tạo vòng mới.
- Tách trạng thái tải/lỗi của quyền quản trị khỏi xác minh sinh viên. Dashboard đợi truy vấn quản trị hoàn tất; lỗi RPC hiển thị thông báo và nút thử lại, không kết luận ví không có quyền.
- Menu ví hiển thị trạng thái chưa đọc được quyền. Ví có vòng cũ vẫn thấy đường dẫn Organizer Dashboard.
- Menu hiển thị riêng `Sinh viên` và `Organizer`, mỗi quyền có trạng thái đang kiểm tra, đã xác nhận, chưa có hoặc chưa kiểm tra được. Lỗi Factory không che trạng thái sinh viên đã xác minh.
- Nút xác minh email được giải thích là tùy chọn cho sinh viên; kết nối ví hoặc xác minh email không tự cấp quyền Organizer. Một ví có thể có đồng thời cả hai quyền.
- Dashboard Organizer chọn mặc định vòng mới nhất thuộc ví và giới hạn danh sách lựa chọn trong các vòng của ví đó. Quyền thao tác vẫn kiểm tra theo `admin()` của vòng và được contract bảo vệ.
- Tab Platform/Organizer đồng bộ trực tiếp với query parameter `tab`, bao gồm điều hướng từ menu ví.
- Danh sách Organizer lấy địa chỉ từ sự kiện `OrganizerUpdated` và admin của các vòng; đọc lại mapping để xác định quyền hiện tại. Không phụ thuộc dữ liệu lưu trong trình duyệt.
- Nếu RPC giới hạn khoảng block, bộ đọc tìm block triển khai và chia nhỏ truy vấn sự kiện. Lần làm mới sau chỉ đọc phần lịch sử mới. Lỗi đọc quyền được hiển thị là chưa xác định, không phải đã thu hồi.
- Factory thiếu giao diện Multi-Organizer hoặc lỗi truy vấn quyền sẽ có cảnh báo và khóa thao tác tạo vòng/cấp quyền chưa xác minh. Các vòng cũ vẫn có thể quản lý nếu đã xác định đúng admin.
- Thêm comment tiếng Việt tại các nhánh phân quyền và bộ đọc lịch sử.

## Kiểm chứng

- Frontend: **478 tests pass**, **13 integration tests skipped**.
- TypeScript và ESLint: đạt.
- Production build: đạt.
- Test hồi quy bao gồm Organizer bị thu hồi nhưng còn vòng cũ, RPC chậm/lỗi, ví có nhiều vai trò, Factory cũ, đổi tab bằng URL, giới hạn lựa chọn vòng, lịch sử Organizer không có localStorage và RPC giới hạn khoảng block.

Các test dùng dữ liệu mô phỏng để xác nhận logic; chưa xác nhận giao dịch cấp/thu hồi quyền bằng hai ví thật trên Factory mới.

## Cấu hình Fuji còn cần hoàn tất

`.env.local` vẫn ghi đè Factory bằng `0x04E59D34eCb2e82cBB441E20C2A42A91105d671d`. Getter `authorizedOrganizers()` của Factory này đã trả revert khi kiểm tra trước đó. Không đổi sang địa chỉ dự đoán hoặc một Factory khác chưa xác minh.

Chưa có receipt deploy mới được lưu trong `tmp/fuji-factory-deploy/result.json`. Cần hoàn tất và xác minh giao dịch deploy, sau đó đồng bộ `.env.local`, `.env` và file deployment, rồi khởi động lại dev server hoặc build lại. Quy trình và ví Platform Owner đã chọn được ghi trong [hướng dẫn triển khai Fuji](multi-organizer-fuji-deploy.md).
