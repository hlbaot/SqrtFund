# Cải thiện hành trình tài trợ — 28/10/2026

## Phạm vi hoàn thành tại local

1. **Ba khoản tiền rõ ràng**: component FundingBreakdown dùng chung cho card dự án, trang chi tiết và My Dashboard. Tiền góp trực tiếp tách khỏi matching; tổng dự kiến bằng hai khoản cộng lại. Sau finalize dùng payoutOf đã ghi nhận; thiếu kết quả đọc hiện dấu —, không tự biến thành 0. Round hủy không hiển thị như một khoản được giải ngân. Bảng xếp hạng cũng không coi matching chưa đọc được là 0.
2. **Hướng dẫn người mới**: checklist mạng Fuji, xác thực Student, quyền vào round, số dư MockUSDC, AVAX trả phí. Có nút chuyển mạng, link xác thực, faucet token trong Dashboard và faucet AVAX Core. Lỗi đọc được phân biệt với thiếu tiền/quyền. Round chưa bắt đầu hoặc dự án chưa duyệt không cho gửi góp đơn/lô; vẫn giữ kiểm tra trần cộng dồn và ngân sách round. Số dư AVAX dương không được gọi là bảo đảm đủ mọi mức phí.
3. **Hồ sơ và cập nhật kết quả**: sau khi được duyệt, chủ ví bổ sung người phụ trách, mục tiêu/người hưởng lợi, ngân sách USDC, kế hoạch chi và mốc/kết quả đo được. Các nội dung này lưu trong PostgreSQL, không bị giới hạn bởi mô tả 280 byte on-chain. Không tự thêm thông tin giả cho dự án cũ. Ngân sách đề xuất không phải matching được hứa hoặc tiền đã nhận. Sau claim, chủ ví có thể đăng báo cáo và link minh chứng; tối đa 12 báo cáo, server đóng dấu thời gian và giữ lịch sử đã đăng. Nội dung là tự công bố của nhóm, không phải kết quả được bên thứ ba chứng thực.
4. **Claim/refund đúng người, đúng round**: snapshot thông báo đọc claimed và payoutOf cho dự án do ví sở hữu, đọc khoản đã góp cho hoàn tiền ở các round đã hủy. Các round trước cũng có thông báo; claim không dựa vào preview matching. Thông báo trỏ đến #claim trên đúng trang dự án hoặc #refund trên đúng round. Trang dự án có thao tác claim cho ví chủ, giải thích khi chưa thể nhận; Dashboard giải thích lý do nút bị khóa bằng văn bản luôn thấy. Hoàn tiền tách khỏi thu hồi matching pool của người tổ chức.

## Quyền lưu và dữ liệu

API `/api/project-profile` chỉ công khai hồ sơ dự án đã duyệt thuộc Factory được cấu hình trên Fuji. PUT yêu cầu chữ ký EOA của ví chủ dự án, ràng buộc origin, chain, round, project, revision, hash toàn bộ nội dung và thời hạn 10 phút. Server đọc quyền sở hữu từ contract và chỉ nhận báo cáo sau khi claimed=true. Không đổi contract hoặc cấp quyền Student/Organizer mới.

Database dùng revision tăng nguyên tử; request cũ/replay hoặc hai phiên ghi cùng revision chỉ có một phiên thành công. Report mới được nối vào lịch sử, không thay lịch sử cũ qua API. RLS và grant chặn anon/authenticated đọc/ghi trực tiếp; API server dùng service_role. Không có fallback lưu trong process và không trả success khi DB lỗi/acknowledgment thiếu.

UI thông báo nội dung hồ sơ sẽ công khai. Chỉ nên điền tên hoặc liên hệ đã đồng ý công bố. Không dùng email sinh viên, OTP hoặc chữ ký trong báo cáo này.

## Kiểm chứng

- 997 test ứng dụng đạt; 13 integration test bỏ qua theo cấu hình. Bao gồm chữ ký EOA thật, thay đổi nội dung sau khi ký, hết hạn/origin khác, ví không phải chủ, dự án ngoài Factory/chưa duyệt, báo cáo trước claim, lỗi DB, conflict và giữ dữ liệu nhập khi lỗi.
- Test SSR/DOM kiểm tra ba khoản tiền và thiếu dữ liệu, bước đóng góp tiếp theo, gas RPC lỗi, claim chỉ đúng ví, thông báo claim/refund cho round cũ.
- TypeScript và production webpack build đạt. ESLint không có lỗi; còn các warning đã có ở file khác.
- Database fixture local mới: migrations 0001–0010 và toàn bộ 6 SQL fixtures đạt. Hai yêu cầu tạo hồ sơ đồng thời nhận đúng 1 OK / 1 CONFLICT. Migration 0010 chạy lại và fixture vẫn đạt. Không thao tác DB production, provider hay giao dịch tiền thật.
- Không sửa Solidity nên không chạy lại Forge cho thay đổi này. Không tuyên bố đã kiểm thử ví thật end-to-end hoặc hình thức hiển thị đầy đủ trên production.

## Trước khi triển khai

Chạy **supabase/migrations/0010_project_profiles.sql** trên Supabase của môi trường đích, sau đó deploy ứng dụng. Không cần secret mới: dùng RPC/Factory Fuji và Supabase server configuration đang có. Migration này tạo thêm bảng/function, không backfill hồ sơ bịa cho dự án cũ. CI hiện quét mọi migration và SQL fixture nên tự bao gồm hai file mới khi người dùng push.

Chưa commit/push/deploy. Giữ chính sách open-edu hiện hành. Không thay đổi ảnh trong thư mục img/ của người dùng.

## Bổ sung sau phản hồi không thấy hướng dẫn

Đã đưa checklist vào cả trạng thái chưa kết nối ví; dữ liệu ví/token cache không được tính là sẵn sàng khi đã ngắt kết nối. Trên mobile, trang chi tiết của dự án đang nhận góp có khối “Bạn mới tham gia? Bắt đầu từ đây” với các bước luôn hiển thị và nút mở khung hướng dẫn/đóng góp. Đây là thay đổi local, chưa deploy. 20 test liên quan đạt, thêm hai trường hợp chưa kết nối ví và lối mở hướng dẫn mobile; typecheck/lint các file sửa đạt. Hướng dẫn không phụ thuộc migration; migration 0010 chỉ phục vụ lưu hồ sơ/báo cáo.

## Kiểm tra trình duyệt sau khi migration đã chạy

Người dùng xác nhận migration 0010 chạy thành công; API local đọc được bảng và trả 200 cho hồ sơ chưa công bố. Đã kiểm tra desktop/mobile, sửa cấu hình hai địa chỉ public local, bổ sung /guide có lối vào từ menu/trang chủ, sửa CTA round đã chốt và thêm regression tests. 1004 test ứng dụng qua, typecheck/lint qua (còn warning cũ). Chỉ kiểm tra đọc trên dữ liệu Fuji/DB thật; chưa ký ví/giao dịch/lưu hồ sơ thật. Chi tiết: local-ui-test-2026-10-28.md. Không cần chạy lại migration 0010 chỉ vì bổ sung trang hướng dẫn.
