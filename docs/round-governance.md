# Quy định và tiêu chí xét duyệt

## Phần đã triển khai

- `/rules`: quy định chung tiếng Việt/Anh, điều kiện Student, giới hạn dự án, tiêu chí đánh giá, nên làm/không được làm, tính cuối cùng của từ chối và phạm vi Fuji.
- Menu có lối vào Quy định; form đăng ký có phần đọc quy định/tiêu chí tại chỗ và link mở tab mới để giữ dữ liệu đang nhập.
- Trang round và dashboard Organizer có tiêu chí riêng: chủ đề, đối tượng, phạm vi chi, cách đánh giá. Chỉ ví admin của round trên Fuji được ký công bố khi round còn nhận đăng ký, chưa có dự án, chưa chốt/hủy. Công bố một lần và không sửa sau khi lưu.
- Round cũ không tự sinh tiêu chí. Chưa công bố, đang tải và lỗi dịch vụ là ba trạng thái khác nhau.
- Dialog duyệt/từ chối yêu cầu ít nhất một tiêu chí và lý do công khai trước khi gửi giao dịch. Sau receipt thành công, Organizer ký thêm để lưu lời giải thích.
- Lý do chỉ được API ghi khi receipt thành công, người gửi/to/event contract/project ID/action đều khớp. API kiểm tra ví ký đúng admin của round thuộc Factory cấu hình trên Fuji.
- Nếu lưu lý do thất bại, quyết định blockchain giữ nguyên, dashboard giữ lời giải thích/hash trong cảnh báo. Chủ round có thể bổ sung ở chi tiết dự án hoặc thẻ xét duyệt đã mở bằng hash giao dịch cũ, không gửi lại approve/reject. Lý do được ghi một lần, không sửa/xóa qua API.
- Chi tiết dự án hiển thị lý do, tiêu chí, thời gian và link receipt. Dashboard sinh viên có link đến hồ sơ/lý do xét duyệt. Dự án chưa duyệt/bị từ chối vẫn theo quyền xem UI hiện hành.

## Triển khai

1. Chạy `supabase/migrations/0011_round_governance.sql` trên database môi trường đích, sau migration 0010.
2. Deploy ứng dụng. Không cần secret mới, redeploy contract hay sửa ABI.

Migration bổ sung bảng `round_governance`, khóa duy nhất theo chain/round/entry, RLS và trigger chặn sửa/xóa. `anon` và `authenticated` không đọc/ghi trực tiếp; `service_role` chỉ đọc/thêm. Chạy lại migration được. Không tự áp dụng vào database production trong tác vụ này.

## Phạm vi và giới hạn

Quy định nội dung và yêu cầu lý do là cơ chế của ứng dụng/API. Contract hiện tại không bắt buộc có tiêu chí hay lý do: giao dịch trực tiếp ngoài ứng dụng vẫn có thể xảy ra. Xác minh round rỗng trước công bố và ghi DB là hai bước trên hai hệ thống, không có giao dịch nguyên tử cùng blockchain; không tuyên bố loại bỏ hoàn toàn race với đăng ký trực tiếp. Nội dung do Organizer công bố, không phải kết quả thẩm định độc lập. Không backfill lý do hoặc tiêu chí giả cho dữ liệu cũ.

Luồng yêu cầu bổ sung hồ sơ và quy trình khiếu nại chưa thuộc bước triển khai này. Từ chối on-chain vẫn không thể duyệt lại. Trước khi triển khai, cần kiểm tra thêm ví thật cho publish policy, moderation + signature, và phục hồi sau lỗi DB. Tác vụ chưa ký/lưu lên DB thật hoặc thay đổi tiền/quyền thật.

## Kiểm chứng

- 1060 test ứng dụng đạt, 13 integration test bỏ qua theo cấu hình.
- Typecheck đạt; ESLint các file thay đổi không có lỗi (2 warning cũ trong admin.tsx).
- Production webpack build đạt; còn warning dependency ox/viem.
- PostgreSQL 17 local fixture cô lập: toàn bộ migrations 0001–0011 và 7 SQL fixtures đạt, bao gồm khóa bản ghi, chống đăng trùng và quyền service/public.
- Kiểm tra DOM cho policy công bố/chưa công bố/lỗi, quyền Organizer, lý do khớp trạng thái và yêu cầu đủ tiêu chí/lý do trước xác nhận.
- Trình duyệt xem trước chưa xác minh được do máy chủ local bị từ chối kết nối. Không tuyên bố đã kiểm thử ví thật end-to-end.
