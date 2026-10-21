# Báo cáo nâng cấp Multi-Organizer — Phase 1–2

## 1. Phạm vi thực hiện

Thực hiện phần cần làm ngay trong tài liệu yêu cầu: chốt phân quyền và sửa `RoundFactory` để nhiều Organizer được phê duyệt có thể tạo vòng độc lập. Bổ sung test để kiểm chứng thay đổi trước khi chuyển sang triển khai.

Toàn bộ thay đổi ở local. Chưa deploy Factory mới, chưa đổi địa chỉ trong `.env` hoặc file deployment, chưa xây backend đăng ký doanh nghiệp và chưa tích hợp dashboard Organizer.

## 2. Quy tắc phân quyền (Phase 1)

| Vai trò | Quyền |
| --- | --- |
| Platform Owner | Ví được trả về bởi `RoundFactory.owner()`; cấp/thu hồi Organizer và có thể tự tạo vòng. Không tự có quyền quản trị vòng do Organizer khác tạo. |
| Organizer | Ví có `authorizedOrganizers(wallet) == true`; được tạo nhiều vòng, mỗi vòng có admin và pool riêng. Không cấp quyền cho bản thân hoặc ví khác. |
| Round Admin | Ví đã gọi `createRound` cho vòng đó; quản lý dự án, nạp quỹ, chốt hoặc hủy vòng theo các điều kiện hiện có của `QFRound`. |
| Student | Theo cơ chế `StudentRegistry` hiện có; độc lập với quyền Organizer. Việc được duyệt Organizer không tự xác minh sinh viên. |

Một ví có thể có nhiều quyền cùng lúc. Đây là các quyền kiểm tra trên blockchain, không phải vai trò người dùng tự chọn.

Mỗi vòng vẫn có đúng một admin cố định. Multi-Organizer cho phép nhiều bên tổ chức các vòng riêng, không thêm nhiều admin cho cùng một vòng hay cơ chế khôi phục khi mất khóa admin.

### Đối chiếu business rules

| Quy tắc | Cách thực hiện |
| --- | --- |
| BR-01 | Dùng `owner()` sẵn có của OpenZeppelin `Ownable` làm Platform Owner. |
| BR-02 | `setOrganizer` có `onlyOwner`; không cho địa chỉ zero. |
| BR-03 | Organizer được gọi `createRound` nhiều lần. |
| BR-04 | Nhiều ví được cấp quyền độc lập trong cùng Factory; các giao dịch được blockchain thực thi tuần tự. |
| BR-05 | Mỗi lần tạo triển khai một `QFRound` mới với `admin = msg.sender` và pool riêng. |
| BR-06 | Giữ kiểm tra `onlyAdmin` trong từng `QFRound`; admin vòng A không quản lý vòng B. |
| BR-07 | Người dùng không truyền admin tùy ý khi tạo vòng; chỉ owner được sửa danh sách Organizer. |
| BR-08 | Thu hồi Organizer chỉ chặn tạo vòng mới; admin và quỹ của vòng cũ không thay đổi. |

**Quyết định về dữ liệu:** chuỗi `organizer` truyền khi tạo vòng vẫn là tên hiển thị. Quyền tạo vòng được kiểm tra theo địa chỉ ví, không dựa vào tên doanh nghiệp. Mapping on-chain ghi nhận quyền, chưa phải hồ sơ doanh nghiệp đã được thẩm định.

## 3. Thay đổi code (Phase 2)

| File | Thay đổi |
| --- | --- |
| `contracts/src/RoundFactory.sol` | Thêm `authorizedOrganizers`, sự kiện `OrganizerUpdated`, hàm `setOrganizer` và modifier `onlyOrganizer`. `createRound` cho owner hoặc Organizer được phê duyệt gọi. Bổ sung comment tiếng Việt về ranh giới quyền, tên hiển thị và ảnh hưởng của thu hồi. |
| `contracts/test/RoundFactoryMultiOrganizer.t.sol` | Test grant/revoke, sự kiện, địa chỉ zero, truy cập trái phép, nhiều vòng/nhiều Organizer, pool độc lập, chuyển owner, thu hồi và quyết toán hai vòng có sinh viên chung. Có comment giải thích các điểm phân quyền quan trọng. |
| `src/lib/contracts/abis/roundFactory.ts` | Đồng bộ ABI từ artifact đã compile, bổ sung getter Organizer, hàm cấp/thu hồi và sự kiện; chưa thay đổi hook/dashboard frontend. |
| `contracts/test/QFRound.t.sol` | Đổi tên test cũ có chữ `OnlyOwner` để mô tả đúng hành vi mới; giữ các kiểm tra hiện có. |

### Hành vi cấp và thu hồi

- `setOrganizer(wallet, true)`: owner cấp quyền tạo vòng cho ví.
- `setOrganizer(wallet, false)`: owner thu hồi quyền tạo vòng mới của ví.
- Cả hai thao tác phát `OrganizerUpdated(wallet, authorized)` để công cụ ngoài chuỗi theo dõi.
- Ví không có quyền tạo vòng nhận lỗi `Not authorized`; địa chỉ Organizer zero nhận lỗi `Invalid address`.
- Chuyển owner Factory không xóa danh sách Organizer đã phê duyệt. Owner mới có quyền quản lý danh sách; owner cũ mất quyền tạo vòng mặc định nếu không được cấp Organizer riêng.
- Thu hồi một ví đang là owner khỏi mapping không chặn quyền tạo vòng từ `owner()`; đây là hai nguồn quyền độc lập theo yêu cầu.

Constructor của Factory, tham số `createRound`, StudentRegistry dùng chung và logic `QFRound` được giữ nguyên. Các chức năng donate, cancel/refund, finalize và claim tiếp tục do từng vòng kiểm soát.

## 4. Kiểm thử local

Kết quả kiểm tra ngày 21/10/2026:

| Kiểm tra | Kết quả |
| --- | --- |
| `forge build --root contracts` | Pass; các contract và script triển khai compile thành công. |
| `node scripts/sync-abis.mjs` | Pass; chỉ ABI Factory có thay đổi nội dung. |
| `forge test --root contracts` | 160 pass, 0 fail, 0 skip; gồm 14 test Multi-Organizer mới. |
| Fuzz quyền cấp Organizer / tạo vòng | Mỗi test chạy 256 trường hợp. |
| Invariant bảo toàn tiền khi hủy vòng hiện có | 256 runs, 128.000 calls, 0 revert. |
| `npm test` | 452 pass; 13 integration tests được skip theo cơ chế opt-in hiện có. |
| `npm run lint` | Pass. |
| `npm run typecheck` | Pass. |
| `forge fmt --check` với Factory và test mới | Pass. |
| `git diff --check` | Pass. |

Môi trường contract: Forge 1.7.1, Solidity 0.8.24, `via_ir = true` theo cấu hình repo. Các test chạy bằng EVM local, không cần private key thật và không broadcast giao dịch. Compiler có cảnh báo sẵn có về hàm `signature` trong `StudentVerification.t.sol` có thể khai báo `view`; không ảnh hưởng kết quả test. `forge build` còn báo các cảnh báo lint sẵn có về phép ép kiểu và `block.timestamp`; lần sửa này không thay đổi logic tài chính hoặc thời gian của QFRound.

Các tình huống mới đã kiểm chứng:

1. Owner tạo vòng mà không cần tự cấp Organizer.
2. Owner cấp/thu hồi quyền và phát đúng sự kiện.
3. Địa chỉ zero bị từ chối; ví khác không được cấp/thu hồi quyền.
4. Ví chưa được cấp hoặc đã bị thu hồi không tạo vòng mới được.
5. Organizer A và B tạo các vòng khác địa chỉ, đúng admin, đúng thứ tự trong registry.
6. Một Organizer tạo nhiều vòng; mỗi pool có số dư riêng.
7. A không duyệt dự án của B; B không nạp pool hoặc hủy vòng của A; Platform Owner không vượt quyền admin của vòng.
8. Sau thu hồi, Organizer vẫn quản lý và thu hồi pool của vòng cũ khi hủy.
9. Cấp quyền lại cho phép tạo vòng trở lại.
10. Chuyển owner không đổi admin vòng cũ hoặc danh sách Organizer đã cấp.
11. Tạo vòng với dữ liệu không hợp lệ không thay đổi danh sách vòng hay quyền Organizer.
12. Sinh viên được xác minh dùng chung hai vòng; donation, ngân sách, finalize, claim và rút phần dư được tính độc lập.

## 5. Trạng thái các phase và phần còn lại

| Phase | Trạng thái trong lần sửa này |
| --- | --- |
| 1 — Nghiệp vụ/phân quyền | Đã chốt các quy tắc ở mục 2. |
| 2 — Smart contract | Đã sửa Factory; các test hiện có và test mới đều pass. |
| 3 — Test contract | Đã bổ sung và chạy test local; kết quả thực tế ở mục 4. |
| 4 — Deploy Fuji | Chưa thực hiện. Factory cũ không tự nhận logic mới, các vòng cũ không tự chuyển sang Factory mới. |
| 5 — Frontend nhận diện quyền | Chưa tích hợp. UI hiện tại chưa có dashboard/luồng tạo vòng cho Organizer mới. |
| 6 — Hồ sơ doanh nghiệp | Chưa thực hiện: đăng ký, xác thực ví, trạng thái PENDING/APPROVED/REJECTED và lưu hồ sơ. |
| 7 — Luồng Organizer trên UI | Chưa tích hợp; các chức năng contract được kiểm chứng bằng local EVM. |
| 8 — End-to-end qua bốn ví | Chưa chạy trên trình duyệt hoặc Fuji. Test EVM nhiều ví không thay thế kiểm thử ví thật. |

**Bước tiếp theo:** review thay đổi và test; sau đó mới triển khai Factory mới và tích hợp quyền Organizer vào frontend. ABI Factory mới đã được sinh sẵn. Khi tích hợp cần cập nhật địa chỉ Factory, đọc `authorizedOrganizers`, hỗ trợ nhiều quyền cùng lúc và chọn/lọc vòng theo admin. Không chỉ đổi badge `role` trên giao diện để cấp quyền.
