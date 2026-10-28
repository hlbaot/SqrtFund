# Kiểm thử local trên trình duyệt — 28/10/2026

## Môi trường và cấu hình

Ứng dụng SqrtFund có server dev sẵn ở **http://localhost:3001**. Không dừng server này hoặc ứng dụng khác ở cổng 3000. Factory trong cấu hình local cũ trả danh sách round rỗng, làm người dùng không mở được dự án để thấy hướng dẫn. Đã sửa riêng NEXT_PUBLIC_FACTORY_ADDRESS và NEXT_PUBLIC_USDC_ADDRESS trong .env.local để trỏ deployment Fuji đang dùng. Không thay secret, chain ID hoặc Registry; không commit .env.local. Dữ liệu rollback chỉ gồm hai biến public trong tmp/local-ui-review/public-config-before.json.

Người dùng xác nhận migration 0010 chạy thành công. GET API hồ sơ local cho dự án đã duyệt trả 200/document=null: đọc DB thành công, chưa có hồ sơ được chủ ví công bố. Không phải fallback memory hoặc lỗi DB giả thành danh sách rỗng. PUT fixture không có chữ ký trả 401/PROFILE_AUTH_INVALID, không trả document.

## UI đã quan sát trực tiếp

- Trang /guide luôn đọc được trước khi kết nối ví và khi không có round đang mở; có đủ sáu bước. Có link từ menu desktop/mobile và sau phần How it works trên trang chủ. Hai ngôn ngữ, các link xác thực/round/faucet rõ ràng.
- Desktop 1440×900 và mobile 390×844: trang hướng dẫn có 6 mục, scrollWidth bằng clientWidth, không tràn ngang. Ở mobile, menu có mục Hướng dẫn.
- Các component onboarding của round mở được kiểm tra bằng fixture browser có banner ghi rõ dữ liệu mô phỏng. Nút Mở hướng dẫn bật panel, hiện sáu bước và nút Kết nối ví. Ba khoản tài trợ 15 + 24 = 39 USDC hiển thị tách biệt. Route fixture tạm đã được chuyển vào tmp và loại khỏi src/app sau kiểm thử.
- Dữ liệu Fuji thật tại thời điểm kiểm tra không có round đang mở. Trên trang dự án đã chốt: ba khoản tiền dùng matching đã chốt; trong lúc chưa đọc được payout hiển thị —, sau đó cập nhật kết quả đọc thật. Hồ sơ chưa công bố có empty state đúng; claim yêu cầu kết nối ví chủ dự án.
- Đã sửa CTA mobile còn mời Ủng hộ ở round đã chốt: nay dẫn đến #claim; round hủy dẫn đến #refund; round kết thúc nhưng chưa finalize hiển thị chờ chốt. Nút claim status đã bấm và tới đúng anchor. DonateBox giải thích round kết thúc trước khi mời kết nối/góp.
- Browser console không có error trong lần kiểm tra cuối. Đã reset viewport về mặc định và để lại tab /guide để người dùng xem.

Bằng chứng ảnh local nằm trong tmp/local-ui-review/: guide-desktop-real.png, guide-mobile-real.png, mobile-guide-open.png, mobile-finalized-project.png. Các ảnh và fixture không đưa vào Git.

## Kiểm tra tự động

- 1004 test ứng dụng qua; 13 integration test bỏ qua theo cấu hình. Có regression cho lối mở hướng dẫn mobile trên component trang dự án, round finalized, link hướng dẫn cho guest, trang guide không cần tài khoản và sitemap/robots.
- Typecheck qua; lint 0 lỗi, còn 4 warning có sẵn.
- Không sửa contract/SQL thêm trong lượt kiểm tra UI này. Không gọi mail/upload provider, không mint/approve/donate/claim/refund và không lưu hồ sơ thử lên DB thật. Các luồng ghi dương tính đã kiểm thử bằng fixture ở lượt triển khai trước; chưa khẳng định wallet end-to-end bằng tài khoản thật.
- Chưa commit/push/deploy. Production không thay đổi trong lượt này.
