# SF-04 — Chỉ xác nhận đơn đã được database lưu

## Kết quả

Đã sửa code local. Không còn fallback Organizer trong globalThis/Map của process ở bất kỳ môi trường nào. Database là nguồn dữ liệu duy nhất. Không commit, push, deploy, chạy workflow từ xa hoặc làm lỗi database production trong tác vụ này.

Cần áp dụng migration **0009_organizer_review_atomic.sql** trước khi triển khai code mới. Migration chỉ tạo function và quyền thực thi, không xóa/sửa các đơn hiện có. Migration 0008 vẫn giữ nguyên.

## Sai ở đâu và cách sửa

| Luồng | Trước | Sau |
|---|---|---|
| Tạo đơn | Insert lỗi/mất kết nối vẫn trả đơn pending từ memory | Trả 503; không dựng ID/timestamp/đơn thay thế; chỉ 201 khi DB trả đầy đủ bản ghi đã lưu |
| Đọc đơn | DB lỗi trả [] hoặc ghép dữ liệu memory | Trả 503; [] chỉ khi truy vấn DB thành công và thực sự rỗng |
| Gửi lại đơn | Có nhánh cập nhật bản sao trong memory | Chỉ cập nhật đúng id/ví/status/updated_at đã được ký trong DB; lỗi DB 503, revision đổi 409 |
| Review | Lỗi update bị nuốt và có thể bị báo thành không tìm thấy/xung đột | Lỗi DB trả 503; chỉ status CHANGED từ transaction mới trả 409 |
| Thu hồi | Ghi target rồi ghi các approved khác của ví bằng hai request; lần ghi thứ hai chưa được kiểm tra | Một RPC transaction kiểm tra revision, khóa và thu hồi toàn bộ các approved cùng ví; tất cả thành công hoặc rollback |
| Giao diện | Có thể hiển thị success khi chỉ nhận ok=true; lỗi DB hiện mã thô | Phải có acknowledgment đúng id/ví/status pending. Lỗi/mất xác nhận giữ nguyên form, không success; hướng dẫn kiểm tra lại trạng thái trước khi thử lại |

Repository không tự điền thời gian hiện tại hoặc chuỗi "undefined" khi DB trả thiếu dữ liệu. Lỗi schema được ánh xạ DB_SCHEMA_MISMATCH, lỗi kết nối/dữ liệu bất thường thành SERVICE_UNAVAILABLE. Không đưa thông báo DB, email hoặc nội dung đơn vào HTTP response/log lỗi. Các response API đều no-store.

Thông báo realtime chỉ được phát sau khi có dữ liệu lưu thành công. Email–ví đã xác minh từ trước được giữ nguyên nếu lưu đơn thất bại, không tự giải phóng hoặc chuyển liên kết khi lỗi.

## Transaction review và migration

`review_organizer_application` chỉ service_role được execute; public/anon/authenticated bị revoke. API vẫn phải xác minh chữ ký owner hiện tại trên chain bằng logic hiện có trước khi gọi RPC. Function không thay thế bước xác thực owner.

Function tuần tự hóa các review của cùng ví, khóa và đọc lại revision sau khi chờ; so sánh expected_updated_at. Review cũ hoặc revoke một đơn chưa approved trả CHANGED và không ghi dữ liệu. Revision được tăng; revoke chỉ cập nhật các approved của cùng ví, không đụng pending hoặc ví khác. Tất cả thuộc một transaction.

Không cần migration dữ liệu cho fallback: các đơn trước đây chỉ ở memory không tự biến thành bản ghi bền vững. Chưa xác nhận có đơn production bị mất; không tuyên bố đã khôi phục các đơn memory cũ.

## Kiểm thử

Năm test regression ban đầu đều thất bại trên code cũ, rồi qua sau khi bỏ fallback: insert lỗi schema/constraint/connection vẫn bị báo 201, list lỗi bị báo rỗng, update lỗi bị báo thành conflict.

Bộ test liên quan gồm 55 test qua: 26 test persistence/HTTP failure; 14 test API nghiệp vụ; 3 test versioned review; 5 test reapplication; 7 test giao diện reapplication. Có test insert/read/RPC response thiếu hoặc sai schema; exception khởi tạo client ở mọi đường đi; read thất bại không tạo đơn; insert thất bại không lộ phantom qua read; không phát notification/success khi ghi lỗi; giữ form và chặn success nếu acknowledgment thiếu/sai ví/sai trạng thái.

Các test API cũ trước đây vô tình dựa vào fallback khi không có Supabase. Chúng nay dùng adapter database chỉ nằm trong test và reset mỗi case; code production không dùng adapter/memory đó. Test lỗi mới dùng repository thật, giả lập DB lỗi tại boundary, không mock repository để che lỗi.

PostgreSQL 17.9 fixture mới: áp dụng migrations 0001–0009 và toàn bộ SQL test script, tất cả qua. Test review thật kiểm tra quyền execute, revision cũ, pending không được revoke, không thay ví khác và cùng timestamp cho các peer bị thu hồi. Trigger test buộc lỗi ở lần cập nhật dòng thứ hai; xác nhận dòng đầu và mọi revision đã rollback. Fixture dùng ví/ID riêng biệt.

Hai kết nối review cùng revision: một OK, một CHANGED. CI đã có thêm script check-organizer-review-concurrency.py chạy trên database fixture, không trỏ production. Workflow YAML và syntax script được kiểm tra local; chưa chạy workflow từ xa.

Kiểm tra cuối toàn bộ working tree: **955 test qua, 13 integration test bỏ qua theo cấu hình**. TypeScript typecheck và webpack production build qua. ESLint các file SF-04: 0 lỗi/0 warning; toàn repo còn 5 warning unused hiện có. Không thay smart contract.

## Triển khai và giới hạn

1. Chạy toàn bộ nội dung supabase/migrations/0009_organizer_review_atomic.sql trong SQL Editor của đúng Supabase project, sau migrations 0001–0008. Không chạy supabase/tests trên production.
2. Người dùng tự commit/push và triển khai code khi sẵn sàng. Thiếu function mới thì review trả 503 DB_SCHEMA_MISMATCH, không fallback sang cách ghi cũ.
3. Kiểm tra tạo/đọc/gửi lại/review bằng ví và dữ liệu fixture do team kiểm soát. Không mô phỏng DB outage trên live. Test dương tính DB qua fixture local không được coi là đã kiểm tra bản mới trên production.

Nếu request mất kết nối sau khi DB đã commit, HTTP lỗi có nghĩa chưa xác nhận được lưu, không khẳng định chưa lưu. UI giữ form và nhắc kiểm tra trạng thái; đọc lại có thể thấy đơn đã tồn tại. Không tuyên bố exactly-once cho việc gửi đơn đồng thời hoặc retry mạng.

Transaction SQL không rollback một giao dịch cấp/thu hồi quyền đã thành công trên Avalanche. Nếu chain thành công nhưng đồng bộ DB lỗi, phải kiểm tra receipt và đồng bộ lại có xác thực; không coi status DB là nguồn cấp quyền thay cho contract.

## Chạy lại migration 0009

Migration dùng CREATE OR REPLACE FUNCTION để chạy lại khi cùng signature đã tồn tại, không cần DROP FUNCTION. Đã kiểm tra hai lần liên tiếp trên database fixture có đơn sẵn: dữ liệu đơn và function OID giữ nguyên, quyền execute vẫn chỉ cho service_role; fixture review/rollback vẫn qua. Lỗi 42723 từ bản CREATE FUNCTION trước chỉ chứng minh hàm đã tồn tại, không chứng minh definition đang chạy đã đúng bản mới. Chạy lại toàn bộ file mới để cập nhật definition và quyền trong cùng transaction.
