# Thông báo realtime bằng Socket.IO — MVP

## Đã triển khai

| Tình huống | Người nhận | Nguồn xác nhận |
| --- | --- | --- |
| Gửi đơn xin làm Organizer | Platform Owner | API lưu đơn thành công |
| Duyệt / từ chối đơn Organizer | Ví gửi đơn | API cập nhật trạng thái sau kiểm tra quyền |
| Thu hồi quyền Organizer qua Dashboard | Ví bị thu hồi | Giao dịch thành công và API cập nhật đơn |
| Đăng ký dự án vào Round | Admin của chính Round đó | Log blockchain, đọc lại dự án |
| Duyệt / từ chối dự án | Ví chủ dự án | Log blockchain, đọc lại dự án |

Chuông đọc các Round công khai của Factory, không chỉ Round mặc định. Danh sách dự án phân trang 50 mục đến hết, không bỏ các dự án thứ 51 trở đi. Link thông báo dự án chứa địa chỉ Round để tránh trùng ID giữa các Round. Link xét duyệt chọn Round trong Organizer Dashboard, vẫn kiểm tra Round thuộc ví hiện tại.

## Luồng dữ liệu và code

1. `src/app/api/organizer-applications/route.ts`: sau khi ghi đơn hoặc cập nhật thành công, gọi `publishNotificationChange()`.
2. `src/lib/server/publishNotificationChange.ts`: gửi HTTP POST `/publish` tới service Socket.IO, xác thực bằng secret chỉ ở server. Timeout 2 giây; socket lỗi không làm thất bại thao tác đã lưu.
3. `realtime/server.mjs`: phát `data:changed` với `{ kind: "organizers" }`. Chặn browser tự publish; không phát nội dung đơn/email.
4. `realtime/chain-watcher.mjs`: mỗi 5 giây đọc log Factory và tất cả Round. Mỗi truy vấn tối đa 100 block, 20 địa chỉ; RPC lỗi không tiến cursor. Chỉ log đã ghi vào block mới kích hoạt cập nhật, không dùng giao dịch đang pending.
5. `src/components/common/RealtimeNotifications.tsx`: một socket cho ứng dụng; gộp sự kiện trong 250ms rồi invalidate query. Kết nối lại cũng đọc snapshot để bắt kịp thay đổi lúc offline. Ngắt socket khi đổi ví/mạng hoặc logout.
6. `src/lib/roundNotifications.ts` và `src/hooks/useRoundNotifications.ts`: đọc trạng thái dự án ở từng Round. RPC lỗi không được chuyển thành trạng thái duyệt hoặc danh sách rỗng thành công.
7. `src/hooks/useNotifications.ts`: dựng thông báo đúng người nhận, bao gồm đơn xin quyền gửi tới Platform Owner. Khóa thông báo Organizer có phiên bản `updatedAt` để duyệt/thu hồi lần sau vẫn là thông báo mới.

Socket chỉ báo cần tải lại. Nó không cấp quyền và không thay thế việc kiểm tra hợp đồng/database. Kênh phát công khai chỉ chứa loại thay đổi; vì không có thông tin riêng của ví nên không cần ký ví để đăng ký kênh.

## Chạy local

Node.js 22 trở lên. Thêm vào `.env.local`:

```dotenv
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
SOCKET_SERVER_URL=http://localhost:3002
SOCKET_PUBLISH_SECRET=<chuỗi ngẫu nhiên tối thiểu 32 ký tự>
SOCKET_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3015
SOCKET_PORT=3002
```

Giữ cấu hình Fuji/Factory đang dùng. Có thể tạo secret bằng `openssl rand -hex 32`; không commit giá trị thật. Nếu Next chạy ở port khác, thêm đúng origin đó vào danh sách.

Chạy hai terminal:

```sh
pnpm realtime
```

```sh
pnpm dev
```

Service dùng cùng `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_RPC_URL`, chain 43113. Lệnh realtime nạp `.env` rồi `.env.local`; bản local ghi đè bản chung. Không cần private key, Supabase key hay migration mới cho chức năng thông báo.

## Production và Vercel

Service này là tiến trình Node chạy liên tục, gồm HTTP Socket.IO và worker đọc blockchain. Deploy service riêng trên máy chủ/container hỗ trợ tiến trình liên tục; website Next vẫn giữ cách deploy Vercel hiện tại. Không đặt worker này vào API Route của Next. Đây là lựa chọn triển khai cho worker của dự án, không phụ thuộc phiên bản hỗ trợ WebSocket của Vercel.

Tại service đặt:

- `SOCKET_PUBLISH_SECRET`, `SOCKET_ALLOWED_ORIGINS`, `PORT` (hoặc `SOCKET_PORT`).
- `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID=43113` giống website.
- Chạy `node realtime/index.mjs`, mở HTTPS qua reverse proxy/hosting có WebSocket upgrade. Health endpoint: `GET /health` (HTTP service hoạt động, không khẳng định RPC đang hoạt động).

Tại Vercel đặt:

- `NEXT_PUBLIC_SOCKET_URL=https://<domain-service>` để browser kết nối.
- `SOCKET_SERVER_URL=https://<domain-service>` để API publish.
- `SOCKET_PUBLISH_SECRET` giống service, tuyệt đối không thêm tiền tố `NEXT_PUBLIC_`.

Build/deploy website mới sau khi đặt URL public. Chỉ thêm biến môi trường chưa đủ khởi chạy service. Không tự động sửa môi trường hay deploy trong thay đổi local này.

## Phạm vi MVP

- Mất socket hoặc chưa cấu hình URL: query tự tải lại khoảng 15 giây; reconnect sẽ đồng bộ lại trạng thái.
- Không cần reload trang để nhận đơn hoặc kết quả duyệt. Độ trễ dự án khoảng chu kỳ worker 5 giây cộng thời gian RPC tải lại; phụ thuộc blockchain và RPC.
- Thông báo được dựng từ trạng thái hiện tại; chưa có bảng lưu toàn bộ lịch sử notification. Đơn đã duyệt không còn là đơn chờ duyệt của Platform Owner. Các lần thay đổi cũ có thể không còn hiển thị sau khi trạng thái mới thay thế.
- Đã đọc/chưa đọc lưu local theo ví trên trình duyệt, chưa đồng bộ giữa thiết bị.
- Thông báo Organizer dựa vào đơn và trạng thái được cập nhật qua Dashboard/API. Chỉnh quyền trực tiếp ngoài Dashboard cập nhật quyền blockchain nhưng không tự tạo bản ghi lịch sử đơn bị thu hồi.
- Worker dùng cursor trong bộ nhớ, một instance cho MVP. Restart lấy mốc hiện tại; các browser luôn đọc snapshot để khôi phục trạng thái. Chưa triển khai hàng đợi thông báo bền vững hoặc Redis nhiều instance.
- Cơ chế Organizer đang có fallback bộ nhớ nếu database lỗi. Realtime không biến fallback này thành lưu trữ bền vững; production phải có đủ migration và Supabase hoạt động.

## Kiểm tra

- Test kết nối Socket.IO thật: publish hợp lệ nhận được tín hiệu; thiếu secret bị từ chối; origin lạ bị chặn; payload email không được phát xuống browser.
- Test đọc log: chia đúng giới hạn 100 block, theo dõi cả Round, không mất cursor khi RPC lỗi.
- Test dự án: đọc 51 dự án qua hai trang; chỉ admin nhận đơn chờ, chủ dự án nhận kết quả; Round hết hạn không báo còn chờ xét duyệt.
- Test API: request sai không publish, cập nhật thành công mới publish.

Kiểm tra thủ công sau cấu hình: mở hai trình duyệt với hai ví, gửi đơn ở ví A và giữ trang Platform Owner ở ví B; sau đó duyệt/thu hồi, đăng ký dự án và duyệt dự án mà không reload trang.

Kết quả kiểm tra local khi triển khai: toàn bộ suite 681 test đạt, 13 integration test không bật; TypeScript và production build đạt. ESLint không còn lỗi ở phần thông báo; các warning unused biến ở PlatformDashboard, ConnectWalletButton và AdminView đã có sẵn. Test Socket.IO dùng client/server thật trên cổng loopback tạm thời. Chưa kiểm tra với hai ví thật trên production, chưa deploy service hoặc thay cấu hình Vercel.
