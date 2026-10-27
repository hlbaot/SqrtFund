# Rà soát code SF-01–SF-03 — 27/10/2026

## Phạm vi và trạng thái

Rà lại logic và các đường đi của SF-01, SF-02, SF-03, bao gồm phần code đã viết trước đó. Sửa tại local theo yêu cầu người dùng; không commit, push, deploy hay gọi workflow từ xa. HEAD vẫn `61536542269d25af2a80c39b171d35aceaa29a94`. Không sửa smart contract hoặc chạy recovery trên dữ liệu thật. SF-04 (repository Organizer fallback sang memory) đã được xử lý ở lượt riêng sau đó; xem [báo cáo SF-04](sf04-durable-organizer-applications.md).

## Các lỗi được sửa thêm

| Phần | Sai ở đâu | Sửa trong code | Bằng chứng |
|---|---|---|---|
| SF-01: phiên đọc | Chỉ so địa chỉ ví không phân biệt A→B→A; kết quả ký cũ có thể khôi phục phiên đã hủy | Credential có generation; chỉ kết quả thuộc đúng generation hiện tại được lưu | Test chờ signature, đổi A→B→A, trả signature cũ: không có credential hoặc API read |
| SF-01: cache | Hết hạn/reset mirror chưa xóa dữ liệu trong React Query cache | Hủy query và xóa private query cache khi mất credential | Test kiểm tra dữ liệu cache sau expiry, không chỉ kiểm tra UI |
| SF-02: deployment | Student proof buộc có Factory dù kiến trúc StudentRegistry độc lập | Ràng buộc proof với deployment theo purpose: StudentRegistry hoặc Factory | Test verifier thật vẫn nhận Student proof khi Factory trống |
| SF-02: trạng thái OTP | Chuyển email chỉ ẩn challenge/token, có thể khôi phục lại khi quay về; rate-limit callback có thể ghép requestId cũ vào identity mới | Xóa toàn bộ OTP session khi đổi identity; retry state chỉ giữ challenge cùng identity | Test A→B→A; email mới bị rate limit không có challenge cũ |
| SF-02: confirm UI | Có thể gọi verify thiếu requestId hoặc thiếu sáu số rồi vẫn mở ví | Kiểm tra challenge/code trước khi ký hoặc gọi API | Test không có wallet/API call khi thiếu challenge/code |
| SF-03: vòng đời upload | Async upload nằm trong form, không hủy kết quả ký/request khi đổi ví/vòng; không khóa thao tác lặp ở handler | Hook quản lý scope, generation, AbortController, submitting lock; reset hủy cả tác vụ chờ ký | Test đổi scope rồi quay lại, response muộn, double-click, reset khi đang ký |
| SF-03: file | MIME và đầu file đúng chưa chứng minh ảnh giải mã được; chưa chặn kích thước giải mã lớn | Sharp giải mã toàn bộ, giới hạn pixel/chiều/frame và bắt lỗi decode trước provider; quota đặt trước decode theo tái kiểm tra bên dưới | Test fake PNG, ảnh truncated vẫn đọc metadata, ảnh quá chiều; PNG/JPEG/WebP thật vẫn đi qua |
| CI local | Job-level env không phải chỗ hợp lệ để dùng context job.services | Đặt service container ID vào env của từng step | YAML/dependency/context placement kiểm tra local; chưa chạy GitHub Actions |

Upload vẫn bắt chữ ký đúng hash/size/MIME/nonce, xác minh Student on-chain, dùng quota nguyên tử trong PostgreSQL, và chỉ gọi provider sau khi toàn bộ điều kiện hợp lệ. SQL migration 0008 không đổi trong lượt rà bổ sung; không cần migration mới cho thay đổi code này. Sharp được khai báo dependency trực tiếp và đồng bộ frozen lockfile, không dựa vào dependency gián tiếp của Next.js.

## Kiểm tra hoàn tất

- 911 test ứng dụng qua; 13 integration test bỏ qua theo cấu hình. Test security dùng chữ ký EOA thật; chain/DB/provider được giả lập theo ranh giới test.
- 181 test Solidity qua; không sửa Solidity trong lượt này.
- TypeScript typecheck và Next.js webpack production build qua.
- ESLint: 0 lỗi, 5 warning unused hiện có; không thêm warning mới.
- Frozen lockfile qua kiểm tra pnpm 11.20.0 và chính sách dependency.
- SQL migrations/fixtures và concurrency quota đã qua trên PostgreSQL fixture trước đó; SQL không đổi. 12 request cùng ví: 5 nhận, 7 từ chối.
- Workflow YAML/context và syntax script Python kiểm tra local. Chưa chạy GitHub Actions/Docker service trên runner từ xa.
- Không có provider call thật trong kiểm thử upload. Mọi nhánh từ chối trong API tests assert provider fetch không được gọi.
- Kiểm tra các secret đã biết từ cấu hình local trong changed text files: không phát hiện; không in giá trị. Báo cáo/PDF kiểm tra riêng và dữ liệu fixture không tự đưa lên Git.

## Giới hạn cần phân biệt

Đây là kết quả kiểm tra code local và fixture; không phải kết luận đã xác minh end-to-end bản mới trên production. SF-01/SF-02 từng triển khai là các phiên bản trước lượt rà này. SF-03 chưa deploy. Migration 0008 production do người dùng xác nhận đã chạy; Cloudinary API secret đã thêm trước đó, chỉ xác minh metadata. Chưa xác minh upload dương tính bằng ví Student fixture trên production hoặc vô hiệu unsigned preset qua Cloudinary Console.

Proof email/upload hiện phục vụ Core EOA, chưa hỗ trợ ERC-1271. Quota áp dụng cho API SqrtFund, không chặn credential/preset Cloudinary khác. Không có API recovery công khai; công cụ SQL recovery yêu cầu operator xác minh bằng chứng và chain riêng.

## Tái kiểm tra SF-03 lúc 11 giờ ngày 27/10/2026

Đã phát hiện và sửa thêm hai điểm sau bằng test tái hiện thất bại trước khi sửa:

1. Hook upload trước đây chỉ invalidation theo scope/allowed. Dù form hiện có ghép ví vào scope, hook vẫn có thể gửi chữ ký cũ nếu caller thay wallet hoặc registry mà giữ scope. Dependency hiện bao gồm cả wallet và registry. Hai test đổi riêng từng giá trị đã qua sau sửa.
2. Quota trước đây kiểm tra sau giải mã ảnh, nên replay/hết quota vẫn chạy decoder. API hiện kiểm tra chữ ký/quyền, body, kích thước/MIME/magic/hash và config trước; đặt quota nguyên tử; chỉ decode khi đặt quota thành công; chỉ gọi provider khi decode hợp lệ. REPLAY/RATE_LIMITED không decode và không gọi provider. Ảnh hỏng phát hiện ở bước decode được tính một lượt thử và nonce đã dùng, không thể replay để decode lại miễn phí.

Tái kiểm tra riêng SF-03: 39 test API + 11 test hook upload + 1 test permit helper + 12 test form = 63 test qua. Đã thêm WebP hai frame, tổng pixel vượt 16 triệu, multipart trùng file, permit đúng chữ ký nhưng hết hạn, provider timeout, đổi identity khi đang hash, và response cũ không mở khóa upload mới.

Quota SQL chạy trên database PostgreSQL fixture mới, không dùng production: toàn bộ migrations và bốn SQL fixture qua; bốn nhóm 12 kết nối đồng thời (48 attempts) kiểm tra cùng ví (5 OK/7 RATE_LIMITED), cùng nonce (1 OK/11 REPLAY), còn một lượt toàn hệ thống (1 OK/11 RATE_LIMITED), còn một suất 4MiB trong trần byte (1 OK/11 RATE_LIMITED).

AbortController chỉ hủy request phía client khi có thể; không thu hồi một provider call đã bắt đầu. Không trả kết quả cũ vào draft mới, không tự retry/hoàn quota. Test không gọi Cloudinary thật. Không commit/push/deploy hoặc chạy workflow từ xa. Xem [báo cáo tái kiểm tra](sf03-retest-2026-10-27.md).

## Cập nhật SF-04 sau lượt rà soát ban đầu

Đã bỏ toàn bộ fallback memory của Organizer repository và dùng lỗi 503 khi DB không xác nhận thao tác. Review/thu hồi wallet-wide chuyển sang một transaction SQL, giữ revision check và rollback đầy đủ khi lỗi. Cần migration 0009 trước khi deploy. UI giữ draft, không success khi DB lỗi hoặc acknowledgment không hợp lệ. 955 test ứng dụng và SQL fixture qua tại local; chưa commit/push/deploy. Chi tiết: [sf04-durable-organizer-applications.md](sf04-durable-organizer-applications.md).
