# Chính sách domain khi xác minh Student

## Nguyên nhân

Chế độ open-edu trước đây nhận mọi địa chỉ hợp lệ có đuôi .edu/.edu.vn. OTP chỉ chứng minh người dùng đọc được hộp thư; ký ví chỉ chứng minh họ điều khiển ví. Cả hai điều kiện này không chứng minh hộp thư do trường được SqrtFund tin cậy cấp cho sinh viên đang học.

Kiểm tra chỉ đọc production ngày 27/10/2026 xác nhận API public dùng mode=open-edu, allowlist/blocklist trống. Với đúng trường hợp người dùng báo, có bản ghi xác minh và quyền Student on-chain khớp identity; người dùng xác nhận có nhận và nhập OTP. Không tìm thấy bằng chứng bypass OTP từ trường hợp này. Không lưu email, ví, OTP, hash, chữ ký hoặc response riêng tư trong báo cáo.

## Thay đổi code local

- Loại bỏ fallback dựa trên hậu tố .edu/.edu.vn. ALLOWED_EMAIL_DOMAINS bắt buộc là danh sách domain email sinh viên đã được quản trị duyệt.
- So khớp domain chính xác sau trim/lowercase. Duyệt school.example.edu không tự duyệt student.school.example.edu, alumni.school.example.edu hoặc tên gần giống. Mỗi namespace cần được ghi rõ.
- Thiếu allowlist hoặc có cấu hình domain không hợp lệ: GET trả mode=unconfigured; UI hiển thị chưa cấu hình và khóa gửi mã. POST trả STUDENT_DOMAIN_POLICY_UNCONFIGURED (503), không gửi mail/truy vấn identity/cấp attestation.
- Domain không nằm trong danh sách: INVALID_DOMAIN (400) trước khi ghi dữ liệu hoặc gửi mail.
- Confirm OTP kiểm tra lại chính sách hiện hành trước khi consume OTP, claim email–ví hoặc ký attestation. Vì vậy OTP được gửi theo chính sách cũ không vượt qua chính sách mới khi xác nhận.
- Resume ALREADY_VERIFIED cũng phải vượt qua domain policy trước khi cấp chữ ký mới.
- Blocklist vẫn ưu tiên chặn domain và các subdomain của nó. Không thay cơ chế email liên hệ Organizer, vì email liên hệ không cấp Student.

## Cấu hình khi triển khai

Đặt ALLOWED_EMAIL_DOMAINS ở server/Vercel Production bằng các domain do trường xác nhận, phân cách dấu phẩy. Liệt kê riêng domain cấp cho sinh viên thay vì tự tin cậy mọi mailbox của trường. Không tự thêm một trường vào danh sách chỉ vì có DNS/MX hoặc tên miền trông giống giáo dục.

Hiện đang chờ người quản trị cung cấp tên trường và danh sách domain hợp lệ. Không đặt danh sách giả định trong .env hoặc production; cấu hình thiếu sẽ khóa xác minh mới theo thiết kế. Cần deploy code mới và cấu hình danh sách để thay đổi có hiệu lực trên production. Không có migration SQL mới.

Allowlist + OTP vẫn chỉ là chính sách đủ điều kiện dựa trên email đã được duyệt. Nếu yêu cầu là xác minh thực sự đang theo học, cần trường đối chiếu danh sách sinh viên/SSO hoặc duyệt danh tính; không nên tuyên bố OTP đã chứng minh tình trạng đang học. Staff/alumni có thể vẫn giữ mailbox thuộc domain trường nếu chính sách chọn domain quá rộng.

## Quyền đã cấp

Thay đổi này ngăn cấp chữ ký mới cho email không được duyệt; không tự thu hồi attestation đã ký còn hạn hoặc quyền Student đã ghi lên chain. StudentRegistry hiện không có hàm revoke/expiry cho quyền isStudent. Chỉ xóa DB hoặc chặn domain không làm isStudent=false.

Không tự sửa liên kết thật, xoay attester, triển khai registry mới hay gửi giao dịch quản trị trong tác vụ này. Thu hồi quyền đã cấp cần quyết định riêng về thiết kế contract và xử lý quyền cũ, đồng thời tính cả các round đang trỏ tới registry hiện hành.

## Kiểm thử

Thay test cũ vốn khẳng định open-edu là hành vi mong muốn bằng test fail-closed và allowlist chính xác. Bao phủ domain giáo dục không được duyệt, subdomain chưa duyệt, cấu hình rỗng/sai, blocklist, OTP cũ/domain bị loại, resume bị chặn, UI chưa cấu hình và trường hợp có chữ ký EOA thật nhưng domain không đủ điều kiện. Các trường hợp bị chặn không gửi mail, consume OTP, claim identity hoặc ký attestation.

Không push, deploy, chạy workflow từ xa, gửi OTP thật hoặc thay đổi quyền on-chain khi sửa code local này.

Kết quả local: 912 test ứng dụng qua, 13 integration test bỏ qua theo cấu hình; typecheck và webpack production build qua; lint các file thay đổi không có lỗi. Đây không phải kết quả kiểm tra phiên bản mới trên production.
