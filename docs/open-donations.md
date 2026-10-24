# Bỏ giới hạn đóng góp cho Round mới

## Hành vi

- Sinh viên đã xác minh tự chọn số tiền lớn hơn 0, tối đa 6 chữ số thập phân theo USDC và trong số dư ví.
- Không còn các ô mức góp tối thiểu, tối đa mỗi dự án hoặc tổng ngân sách mỗi ví trên form tạo Round.
- Round mới cho một ví góp thêm nhiều lần cho cùng dự án; `donorCount` vẫn chỉ tính một ví. Hiển thị khoản đã góp và giữ nút góp thêm.
- Form góp một/nhiều dự án không hiển thị số ngân sách khổng lồ để đại diện cho “không giới hạn”, không chờ đọc `remainingBudget` ở Round không đặt trần tổng.
- Các nút 1, 5, 10 USDC chỉ là gợi ý nhập nhanh, không phải giới hạn.
- Trần matching vẫn giữ: giới hạn tài trợ đối ứng cho mỗi dự án khác với giới hạn tiền sinh viên góp.

## Cách tương thích contract đang có

Factory và Round hiện tại đã nhận các tham số ngưỡng trong ABI. Chúng được dùng như sau khi tạo mới:

```text
minDonation = 1 micro-USDC (0.000001 USDC, đơn vị token dương nhỏ nhất)
maxDonation = uint256.max
maxPerRound = uint256.max
```

Đây là cách cấu hình không đặt trần nghiệp vụ, dùng trực tiếp ABI và constructor hiện có; không sửa Solidity, không cần redeploy Factory hoặc đổi ABI để tạo Round mới theo chính sách này. Kiểu uint256 và các phép tính số nguyên vẫn có giới hạn kỹ thuật của blockchain.

Source dùng chung tại `src/lib/donationPolicy.ts`, có comment tiếng Việt. `CreateRoundForm` truyền các giá trị này vào `createFundedRound`. Các API contract vẫn tồn tại để tương thích; gọi Factory trực tiếp bằng công cụ khác vẫn có thể truyền ngưỡng khác. Thay đổi này áp dụng chính sách cho luồng tạo Round của website, không xóa khả năng cấu hình ngưỡng khỏi ABI contract.

## Round đã deploy

Các ngưỡng cũ là immutable. Round có giới hạn 1–5 USDC hoặc 10 USDC/round vẫn giữ các giới hạn đó trên chain; frontend tiếp tục đọc và tôn trọng chúng. Không ẩn giới hạn cũ để khiến người dùng ký một giao dịch chắc chắn bị contract từ chối.

Muốn sử dụng chính sách mới, tạo Round mới qua giao diện đã cập nhật. Không thể chuyển nguyên trạng quỹ, lịch sử donation và quyền nhận tiền sang Round khác chỉ bằng sửa cấu hình; không tự xóa, hủy hay chuyển tiền của Round cũ trong thay đổi này.

## Kiểm tra

- Kiểm tra 0.000001 USDC, mức trên 5 USDC, góp lặp và mức trên ngân sách cũ được chấp nhận theo chính sách mới.
- Kiểm tra tiền 0, âm, quá 6 số thập phân và vượt số dư vẫn bị chặn.
- Kiểm tra encode calldata theo đúng Factory ABI, giữ trần matching và tiền nạp pool riêng.
- Kiểm tra form tạo Round bỏ các trường giới hạn trong cả tiếng Việt và tiếng Anh.
- Kiểm tra người đã góp vẫn thấy form góp thêm trên Round mới; Round cũ tiếp tục hiển thị giới hạn thực.

Chỉ sửa local, chưa deploy website, chưa tạo Round hoặc gửi giao dịch thật.

Kết quả kiểm tra: toàn bộ suite 707 test đạt, 13 integration test không bật; production build và TypeScript đạt; ESLint không có lỗi, còn 6 warning unused biến ở các file đã có trước. Build có warning từ dependency viem/ox. Không sửa Solidity trong thay đổi này: chính sách mới dùng tham số cấu hình được Factory ABI hiện tại hỗ trợ.
