# SF-01 — Bản vá quyền đọc đơn Organizer

## Thay đổi

`GET /api/organizer-applications` yêu cầu xác nhận đọc được ký bằng ví. Anonymous request trả 401 trước khi truy vấn dữ liệu. Ví đã xác thực được đọc các đơn của chính ví đó; truy vấn toàn bộ hoặc đơn ví khác chỉ được phép nếu server đọc được Factory owner hiện tại và signer là owner. Không tin vai trò do frontend gửi.

Chữ ký ràng buộc origin, địa chỉ ví, Factory, Fuji chain ID, thời điểm cấp/hết hạn và nonce ngẫu nhiên. Xác nhận có hạn 15 phút, là credential chỉ đọc có thể dùng lại trong thời hạn này cho polling; nonce không phải token một lần. Request hết hạn, sai chữ ký hoặc sai context bị từ chối. Đổi owner được kiểm tra trên chain ở mỗi lần đọc cần quyền owner.

Credential được truyền trong Authorization header, không ở URL, localStorage/sessionStorage hoặc query key. Frontend chỉ yêu cầu ký khi người dùng bấm nút xác thực; polling không tự bật ví ký. Đổi ví, đổi chain, đăng xuất hoặc hết hạn xóa quyền đọc khỏi bộ nhớ và ẩn dữ liệu cũ. Backend từ chối credential không thể xác minh; RPC lỗi trả 503, không trả dữ liệu.

Đăng xuất là xóa credential phía trình duyệt; credential đã bị sao chép ra ngoài vẫn có hiệu lực tối đa đến lúc hết hạn. Cơ chế này không cung cấp thu hồi từng credential tại server. Không thêm bảng session hoặc migration trong bản vá.

Mọi GET response, bao gồm lỗi, đặt `Cache-Control: no-store` và `Vary: Authorization`. Không log chữ ký, header xác thực hoặc dữ liệu đơn. Không thay đổi quyền PATCH và quy trình xét duyệt on-chain hiện có.

## Giao diện

- Modal đăng ký/đọc lại đơn: nút xác thực bằng ví, có hướng dẫn không tốn gas và không cấp quyền chuyển tiền.
- Admin: xác thực trước khi đọc danh sách; lỗi đọc không được hiển thị thành một danh sách rỗng thành công.
- Query/cache có phạm vi chain, Factory, ví và phiên xác nhận; dữ liệu private không xuất hiện khi chưa có xác nhận hợp lệ.
- Chữ ký trả về sau khi đổi tài khoản/đăng xuất không được khôi phục quyền đọc của tài khoản trước.

## Kiểm thử local

- 25 test backend: anonymous; chính chủ; ví khác; owner; đổi owner; chữ ký sai; context sai; thời hạn; token hỏng; RPC/config/database lỗi. Dùng chữ ký thật từ tài khoản fixture và mock RPC/database, không dùng email hoặc đơn thật.
- 8 test UI/hook: ký chủ động, đọc chính chủ, đọc danh sách Admin, không ký lại khi refresh, đổi ví/đăng xuất/sai chain, chữ ký trả về muộn, từ chối ký, hết hạn và credential bị server từ chối.
- Toàn suite: **838 test đạt, 13 integration test bỏ qua**. Bốn file jsdom trước đây thiếu dependency đã chạy được sau khi đồng bộ theo lockfile.
- Production build và TypeScript đạt; ESLint không lỗi, còn 5 warning unused đã có trước.
- Không sửa Solidity hoặc triển khai contract.

## Triển khai và xác nhận production

Project đích được đối chiếu bằng Vercel CLI với project đang phục vụ `www.sqrtfund.tech`; không tạo project mới. Bản triển khai lấy source đã kiểm thử trong thư mục staging riêng, loại file môi trường, báo cáo, bằng chứng và dữ liệu test. Dùng Production environment hiện có của project, không đưa secret vào code.

**Đã triển khai production và xác nhận lúc 23:41 ngày 26/10/2026.**

- Domain: https://www.sqrtfund.tech
- Deployment: https://sqrt-fund-d610bfedu-hlbaots-projects.vercel.app
- ID: `dpl_3hWVbw7W4WdPSHMoQq5yvAubRfFb`.
- Đây là deploy source local đã kiểm thử qua Vercel CLI; chưa tạo commit hoặc push Git. Cần đưa các thay đổi source vào Git trước lần deploy tiếp theo từ CI để tránh tái xuất hiện lỗi.

| Kiểm tra live | Kết quả |
|---|---|
| Anonymous lấy toàn bộ | 401, không có applications |
| Anonymous lọc theo ví/status | 401, không có applications |
| Credential không hợp lệ | 401 |
| Ví fixture ký hợp lệ đọc chính mình | 200, danh sách rỗng đúng kỳ vọng |
| Ví fixture đọc đơn ví fixture khác | 403 |
| Ví thường ký hợp lệ đọc toàn bộ | 403 |
| Credential hết hạn | 401 |
| HEAD trang chủ /admin | 200 / 200 |
| Cache-Control cho tất cả API response trên | no-store |

**10/10 kiểm tra live đạt.** Kiểm tra dùng request chỉ đọc và hai ví fixture ngẫu nhiên không nạp tiền, không tạo đơn, không gửi email, không upload và không gửi giao dịch. Không sử dụng private key của người dùng hoặc thu thập lại danh sách đơn. Việc đọc hồ sơ đã có dữ liệu và đọc bằng owner được kiểm tra bằng dữ liệu giả/chữ ký thật ở local, không ký thay owner trên production.

Bằng chứng đã loại dữ liệu cá nhân: `docs/evidence/sf01-production-verification-2026-10-26.json` (gitignored). Script kiểm tra nằm ở `tmp/security-review/verify-sf01-production.mjs` (gitignored), key/chữ ký fixture chỉ tồn tại trong bộ nhớ khi chạy. Lần kiểm tra đầu dùng Factory local bị từ chối đúng; sau khi đối chiếu Factory do frontend production công khai, cả 10 case đạt. Không sửa cấu hình Factory hoặc biến môi trường production.

Một lần build cloud ban đầu thất bại do quy tắc ignore của staging loại nhầm `src/lib/contracts`; đã sửa ignore thành đường dẫn gốc. Deployment lỗi đó không được gán vào domain chính. Build/deployment sau đã Ready và được gán vào domain production ở trên.

Lỗi SF-02/SF-03/SF-04 và quy tắc một lần donate nằm ngoài phạm vi bản vá này.

## Rà soát local bổ sung ngày 27/10/2026

Phiên đọc có generation riêng: kết quả ký cũ sau logout hoặc đổi A→B→A không được khôi phục credential. Khi credential hết hạn/bị xóa, hủy và xóa query cache riêng tư bên cạnh reset mirror store; không chỉ ẩn dữ liệu khỏi UI. Test đã kiểm tra cả A→B→A và dữ liệu thực trong cache sau expiry. Bản bổ sung chỉ ở local, chưa commit/push/deploy theo yêu cầu mới nhất.
