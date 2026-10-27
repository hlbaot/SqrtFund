# SF-03 — Xác thực và quota upload

Ngày: 27/10/2026 (Asia/Ho_Chi_Minh).

## Trạng thái

Code SF-03 đã được rà soát và kiểm tra local cùng SF-01/SF-02. Theo yêu cầu mới nhất, không commit, push, deploy hoặc chạy workflow từ xa; người dùng tự push. Người quản trị xác nhận đã chạy migration 0008 trên Supabase. `CLOUDINARY_API_SECRET` đã được thêm vào Vercel Production dưới dạng Secret, chỉ xác minh metadata; không lưu giá trị trong repository hoặc báo cáo.

Workflow CI kiểm tra frontend, contracts và database fixture riêng trước khi deploy production. Job database áp dụng toàn bộ migrations và chạy SQL security fixtures, bao gồm kiểm tra quota đồng thời. Migration production vẫn do operator quản lý, không tự chạy trong CI/CD.

## Hành vi mới

1. Người dùng chọn ảnh trong form đăng ký dự án và ký thông điệp upload bằng ví Student. Backend kiểm tra chữ ký EOA, origin, địa chỉ StudentRegistry, Fuji 43113, hash SHA-256 file, kích thước, MIME, thời gian và nonce. Thông điệp upload riêng biệt, không tái sử dụng quyền đọc hồ sơ hoặc chứng minh email. Proof sống 5 phút, chỉ nằm trong bộ nhớ và header Authorization, không trong URL/localStorage/log.
2. Backend đọc `isStudent(wallet)` từ StudentRegistry hiện hành, đồng thời kiểm tra chain ID RPC. Ví chưa là Student bị 403; chữ ký thiếu/sai/hết hạn bị 401; lỗi RPC bị 503. Không tin `isStudent` hoặc ví do frontend tự khai.
3. Chỉ đọc multipart sau bước xác thực. Giới hạn cả Content-Length và số byte thực đọc (bao gồm body chunked). Một file, tối đa 4MiB, định dạng PNG/JPEG/WebP. Kiểm tra MIME, magic bytes và digest so với file đã ký; không cho SVG/GIF. Sharp giải mã toàn bộ ảnh với failOn=warning, giới hạn 16 triệu pixel, mỗi chiều tối đa 8192 pixel và một frame. Không chỉ dựa vào metadata vì ảnh bị cắt cụt vẫn có thể đọc được metadata. Ảnh hỏng hoặc vượt giới hạn bị chặn trước provider; phép giải mã diễn ra sau khi đặt quota để replay không lặp lại tác vụ nặng. Chưa bổ sung antivirus.
4. Phải có Cloudinary API key/secret phía server. Không còn fallback unsigned preset. Sau kiểm tra nhẹ file/config (kích thước, MIME, magic bytes, hash), gọi RPC đặt quota trước khi giải mã đầy đủ và trước Cloudinary. Thiếu migration/database lỗi/response không nhận diện đều từ chối, không gọi provider.
5. Khi đủ điều kiện, backend gửi đúng một request ký server sang Cloudinary, timeout 20 giây và không retry tự động. Không trả chữ ký provider, khóa hoặc thông báo lỗi thô của Cloudinary cho browser. Chỉ trả HTTPS URL từ `res.cloudinary.com`.

Giới hạn 4MiB được dùng để chừa multipart trong giới hạn body 4,5MB của [Vercel Functions](https://vercel.com/docs/functions/limitations). UI/API/SQL cùng dùng mức 4MiB.

## Quota bền vững và replay

- Theo ví Student: tối đa 5 lượt/1 giờ và 20 lượt/24 giờ, cửa sổ trượt.
- Toàn hệ thống: tối đa 100 lượt/24 giờ và tổng 200MiB/24 giờ.
- Tính số lượt thử đã đặt chỗ, kể cả ảnh bị từ chối khi giải mã hoặc provider trả lỗi/timeout. Không hoàn quota tự động vì có thể provider đã nhận file trước khi mất kết nối.
- Nonce dùng một lần, trùng trả 409. Bản ghi giữ 7 ngày, dài hơn hạn proof 5 phút. Thay nonce trong proof phải ký lại; vẫn chịu cùng quota ví/toàn hệ thống.
- Một advisory transaction lock chung đảm bảo check + insert nguyên tử giữa nhiều ví/instance. Không dùng limiter in-memory. RLS, revoke quyền public/anon/authenticated; chỉ server service role được gọi RPC. SQL không tự xác minh chữ ký, service-role key vẫn là miền tin cậy.
- 429 có Retry-After 3600: thời gian chờ tối thiểu để thử lại, không cam kết đã có quota nếu cửa sổ 24 giờ vẫn đầy.

Đây là quota của endpoint SqrtFund. Nó không giới hạn upload đi bằng credential/preset khác và không giới hạn traffic delivery ảnh đã lưu. Phải quản lý quota/billing ở Cloudinary riêng.

## Bằng chứng kiểm tra

39 test API dùng chữ ký EOA thật, mock chain/database/provider. Với mọi nhánh từ chối được kiểm tra, assert trực tiếp `provider fetch` không được gọi: anonymous, chữ ký ví khác, context sai, hết hạn, oversize, digest khác, MIME spoof, chưa là Student, RPC lỗi/sai chain, quota hết, nonce trùng, DB lỗi/throw/không có response, thiếu secret dù có unsigned preset, cross-origin và body chunked quá giới hạn. Request hợp lệ gọi provider đúng một lần và chỉ sau reserve quota; lỗi provider không retry/hoàn quota hoặc lộ thông báo thô.

Một test browser helper kiểm tra digest đúng file, origin, chuẩn hóa địa chỉ, TTL và nonce mới. Mười một test hook upload kiểm tra chữ ký, điều kiện Student, từ chối ký, đổi ví/vòng rồi quay lại, abort request và bỏ kết quả muộn, chặn double-click, reset khi bỏ ảnh. 12 test form đăng ký dự án vẫn qua sau khi bổ sung chữ ký upload.

Đã tạo database PostgreSQL 17.9 fixture mới, áp dụng migrations 0001–0008, chạy cả bốn SQL test script. Kiểm tra quota giờ/ngày, tổng số lượt/byte toàn hệ thống, hết cửa sổ trượt, nonce một lần và quyền truy cập. Test 12 kết nối đồng thời cùng ví: chính xác 5 OK và 7 RATE_LIMITED. Các bài SQL hiện có về OTP, uniqueness email/ví và recovery SF-02 tiếp tục qua. Không áp dụng migration vào database thật trong tác vụ này.

Không upload file thật sang Cloudinary hoặc tiêu thụ quota provider khi kiểm thử. Test dương tính provider dùng mock, chưa xác nhận upload end-to-end production.

Kiểm tra cuối: **911 test qua, 13 test integration bỏ qua theo cấu hình**; typecheck và Next.js webpack build qua. Các file SF-03 mới/sửa ở backend và test không có lỗi lint. Không thay smart contract. Không commit/push/deploy hoặc chạy workflow từ xa.

## Bật production

1. Chạy migration 0008 trên đúng Supabase project sau khi kiểm tra migrations 0001–0007 đã có. Không chạy các script fixture test trên database production. Migration chỉ thêm bảng/RPC quota, không sửa danh tính hoặc dữ liệu cũ.
2. Thêm `CLOUDINARY_API_SECRET` trực tiếp vào Vercel Production dưới dạng Secret/Sensitive; không dùng tên NEXT_PUBLIC và không gửi giá trị qua chat/issue. API key và cloud name phải cùng product environment.
3. Trong Cloudinary Console, disable/delete hoặc chuyển unsigned preset cũ sang Signed nếu chỉ SqrtFund dùng. Xác nhận các ứng dụng dùng chung trước khi thay đổi. Việc bỏ fallback trong code không tự vô hiệu preset ở provider. [Cloudinary giải thích signed/unsigned preset](https://cloudinary.com/documentation/upload_presets).
4. Triển khai source đã kiểm thử, giữ SF-01/SF-02 đang có trong working tree. Kiểm tra anonymous/giả chữ ký nhận 401 bằng fixture; không gửi OTP hoặc dùng danh tính thật để tái hiện lỗi.
5. Kiểm tra upload hợp lệ với một ví Student fixture đã xác minh và một ảnh fixture nhỏ do team kiểm soát; xác nhận nonce replay bị 409, quota trong DB được ghi. Bài này sẽ phát sinh đúng một provider call và nên được ghi nhận riêng. Chưa thực hiện upload end-to-end với ví Student fixture trên production; các test provider hiện dùng mock.

Nếu cần đóng endpoint trước khi có cấu hình, có thể deploy ngay với cơ chế từ chối khi thiếu cấu hình: upload hợp lệ sẽ tạm nhận 503, anonymous vẫn 401. Form vẫn hỗ trợ URL ảnh có sẵn. Không tự nhận rằng việc đó đồng nghĩa upload đầy đủ đã hoạt động.

## Tái kiểm tra ngày 27/10/2026

63 test riêng SF-03 qua. Hook theo dõi trực tiếp wallet/registry bên cạnh scope/allowed; quota được đặt trước giải mã đầy đủ. Đã kiểm tra 48 reservation đồng thời trên database local mới với cả trần ví, nonce, số lượt và byte toàn hệ thống. Chi tiết trong [sf03-retest-2026-10-27.md](sf03-retest-2026-10-27.md). Không thay SQL migration 0008 hoặc dữ liệu production.
