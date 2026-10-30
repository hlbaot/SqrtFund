# Mốc khuyến nghị nhận tiền sau finalize

## Hành vi

Mốc khuyến nghị là 30 ngày sau thời điểm finalize thực tế, không phải sau endTime hay lúc ứng dụng lần đầu nhìn thấy round. Dashboard và khối claim hiển thị ngày/giờ GMT+7, số ngày còn lại và giải thích vẫn được claim muộn. Các thông báo trong ứng dụng có mốc 7 ngày, 3 ngày, 1 ngày và quá hạn; khóa mỗi mốc riêng giúp lần nhắc mới chưa đọc sau khi mốc trước đã được xem. Không gửi email/push hoặc tạo tác vụ nhắc bên ngoài ứng dụng; thông báo được tính khi ứng dụng đọc lại trạng thái.

Dự án quá hạn chỉ bị thay đổi hiển thị khi đã xác nhận đủ: được duyệt, round đã finalize và chưa hủy, claimed=false, khoản nhận cuối cùng đã đọc được và lớn hơn 0, thời điểm finalize đã xác minh. Dự án bị đưa cuối danh sách mặc định theo người ủng hộ và không vào podium. Bộ lọc lĩnh vực vẫn áp dụng; nếu người dùng chọn sắp xếp theo số tiền, thứ tự số tiền vẫn đúng. Hạng supporter, matching, tổng tiền và kết quả lịch sử không đổi. Claim muộn vẫn được phép; khi claimed=true, nhãn quá hạn biến mất và thứ tự mặc định/podium được khôi phục.

## Nguồn thời gian

API chỉ đọc `/api/round-finalization?round=...` xác minh round thuộc Factory cấu hình trên Fuji. Vì contract hiện không có finalizedAt, resolver tìm block đầu tiên có finalized=true bằng tìm kiếm nhị phân trạng thái lịch sử, rồi xác minh đúng sự kiện Finalized ở block đó và lấy block timestamp. Zero-data trước triển khai chỉ được hiểu là false khi bytecode tại block đó trống. Không đổi endTime thành finalizedAt và không đoán thời điểm khi RPC lỗi.

Đọc lần đầu cần RPC hỗ trợ historical eth_call/bytecode, block và event logs. Chi phí tìm block tăng theo log2 chiều cao chain. Kết quả thành công được cache có giới hạn ở server và dùng chung qua React Query; yêu cầu đồng thời được gộp. Kết quả chưa finalize/lỗi không được cache thành một timestamp. Nếu archive RPC không đáp ứng, giao diện báo chưa xác minh được thời gian, vẫn cho claim và không hạ vị trí. Claim timing không làm hỏng thông báo tài chính hiện có nếu nguồn thời gian lỗi.

## Triển khai và kiểm chứng

Không sửa smart contract, ABI, quyền claim hay thêm migration database/secret. Chỉ deploy ứng dụng/API; các migration của chức năng hồ sơ/danh mục trước đó vẫn là yêu cầu riêng.

1094 test ứng dụng đạt, 13 integration test bỏ qua theo cấu hình. Có kiểm thử biên 30 ngày, các mốc nhắc, claimed/cancelled/zero/unknown, xác minh block/event, lỗi archive RPC, cache API, claim muộn giữ đúng payout, hạ vị trí và khôi phục sau claim. Typecheck và ESLint các file thay đổi đạt. Production build đạt, còn warning dependency ox/viem đã có.

Không thực hiện giao dịch ví thật, đổi database production hay deploy trong tác vụ này. Resolver thời gian mới chưa được kiểm chứng với RPC Fuji thật trong tác vụ; kiểm thử nguồn chain sử dụng fixtures và lỗi giả lập.
