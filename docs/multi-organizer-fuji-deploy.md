# Triển khai Factory Multi-Organizer trên Fuji

## Trạng thái

Đã hoàn thành code và test hai Organizer độc lập. Giao dịch deploy đã được chuẩn bị và mở trong Core Wallet; đang chờ người dùng ký. Chưa ghi địa chỉ Factory dự đoán vào cấu hình và chưa xác nhận một bản triển khai mới trên blockchain.

## Thông số triển khai

| Mục | Giá trị |
| --- | --- |
| Mạng | Avalanche Fuji, chain ID `43113` |
| Platform Owner cần ký | `0x50f515Be4f56FAD1F8108e166da91605Ff4AF70b` |
| StudentRegistry dùng lại | `0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e` |
| MockUSDC hiện có trong file deployment | `0xFf56491e29085043DbB11cd01D54cC1449A3d686` |
| Factory cũ trong file deployment | `0xd9C0303bF8ED6163CC63eD570C188e5577dC47bD` |
| Solidity | `0.8.24`, optimizer 200 runs, `via_ir = true` |

Factory chỉ nhận địa chỉ StudentRegistry trong constructor; không triển khai lại Registry hoặc token. Chủ sở hữu Factory mới được xác định bằng ví ký deploy. Không tự cấp quyền Organizer cho bất kỳ ví nào trong bước này.

## Kiểm tra trước deploy

- Chạy lại `RoundFactoryMultiOrganizerTest`: **14 pass, 0 fail**.
- RPC trả đúng chain ID `43113`.
- Registry, token và Factory cũ đều có bytecode trên Fuji.
- Factory cũ trỏ đến Registry được chọn; getter `attester()` của Registry và `symbol()` của token đọc thành công.
- Ví Platform Owner được chọn có AVAX testnet; RPC ước tính gas triển khai là **3.445.007 gas**. Phí thực tế cần xem trong ví tại thời điểm ký.
- Trang ký local kiểm tra đúng chain ID và địa chỉ ví trước khi gửi giao dịch. Người dùng tự xác nhận trong Core; không nhập private key hoặc seed phrase vào ứng dụng.

## Kiểm tra sau khi ký

Chỉ cập nhật cấu hình sau khi:

1. Giao dịch có receipt thành công và trả về địa chỉ contract mới.
2. Địa chỉ mới có bytecode; giao dịch là contract creation với bytecode và tham số Registry đã chuẩn bị.
3. `owner()` bằng ví Platform Owner đã chọn.
4. `studentRegistry()` bằng Registry dùng lại.
5. `authorizedOrganizers(wallet)` đọc được, xác nhận giao diện Multi-Organizer tồn tại.
6. Đồng bộ địa chỉ đã xác minh vào file deployment và cấu hình môi trường.

## Lưu ý cấu hình hiện tại

`.env.local` đang có Factory cũ `0x04E59D34eCb2e82cBB441E20C2A42A91105d671d` và MockUSDC `0x38efb1BA71C7CDB8Dd44e860A0A5cADE864d3205`, trong khi `.env` và `contracts/deployments/fuji.json` ghi các địa chỉ khác ở bảng trên. Next.js ưu tiên `.env.local` hơn `.env`; chỉ sửa `.env` sẽ chưa đủ để website dùng Factory mới.

Không thay đổi cấu hình khi giao dịch còn đang chờ ký hoặc chưa được xác minh. Sau khi cập nhật cần khởi động lại dev server hoặc build lại ứng dụng. Các vòng thuộc Factory cũ không tự chuyển sang Factory mới; tiền trong các vòng cũ không được di chuyển bởi giao dịch deploy này.
