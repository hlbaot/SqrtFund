# Keeper tự động chốt Round sau 24 giờ

## Hành vi

Keeper lấy Round từ `getRounds()` của Factory đang cấu hình. Mỗi Round chỉ được chốt khi:

- Thời gian block đạt `endTime + 86.400 giây`.
- `FINALIZE_GRACE()` của Round bằng 86.400 giây.
- Round chưa finalized và chưa cancelled; mọi getter đều đọc thành công.

Trong 24 giờ đầu sau khi Round kết thúc, keeper không gửi giao dịch, kể cả ví keeper có quyền admin. Sau mốc này contract hiện tại cho phép bất kỳ ví nào gọi `finalize()`. Không cần cấp quyền Organizer, đổi contract, deploy Factory mới hoặc chạy migration Supabase.

Mỗi giao dịch được simulation trước khi ký, chờ receipt rồi mới xử lý Round tiếp theo. Nếu ví có nonce pending hoặc receipt chưa rõ kết quả, dừng lượt quét để chờ giao dịch cũ. Sau restart keeper đọc lại trạng thái và nonce blockchain; không chỉ dựa vào bộ nhớ. Chỉ chạy **một keeper bằng một ví riêng**, không dùng đồng thời workflow và service với cùng signer.

Keeper chỉ gọi `finalize()`. Chủ dự án vẫn tự claim; phần dư vẫn do admin rút theo contract. Socket.IO hiện có theo dõi log của Round nên có thể cập nhật giao diện sau giao dịch này.

## Code và comment

- `scripts/keeper/finalize.mjs`: điều kiện 24 giờ, simulation, phí gas, nonce và receipt. Có comment tiếng Việt.
- `scripts/finalize-keeper.mjs`: nạp cấu hình, chạy một lượt hoặc lặp; mặc định chỉ đọc.
- `.github/workflows/finalize-keeper.yml`: tùy chọn chạy theo lịch GitHub Actions, mặc định chưa bật.
- `__tests__/finalize-keeper.test.ts`: kiểm tra mốc thời gian, hủy/chốt, lỗi RPC, giao dịch pending và các giới hạn phí.

## Cách 1: Service Node chạy liên tục

Node.js 24, cài dependency bằng `pnpm install --frozen-lockfile`.

Giữ `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID=43113` giống website. `.env.local` ghi đè `.env`; biến môi trường hệ thống ưu tiên cao nhất.

Chạy thử một lượt, **không cần private key**:

```sh
pnpm keeper --once
```

Để gửi giao dịch, tạo ví keeper riêng, nạp AVAX testnet trên Fuji và cấu hình **tại máy chạy keeper**:

```dotenv
KEEPER_PRIVATE_KEY=<private key ví keeper riêng>
KEEPER_RPC_URL=<RPC Fuji, hoặc dùng NEXT_PUBLIC_RPC_URL>
KEEPER_INTERVAL_MS=60000
KEEPER_MAX_GAS=2500000
KEEPER_MAX_GAS_PRICE_GWEI=100
```

Không gửi private key trong chat, không commit, không đặt tiền tố `NEXT_PUBLIC_`. Không tự lấy key attester hay Platform Owner làm signer. File `.env.local` đã được gitignore.

Sau khi kiểm tra dry-run, chạy service:

```sh
pnpm keeper --send
```

Deploy tiến trình trên host/container Node chạy liên tục, dùng process manager để tự restart khi máy khởi động lại. Đây là service riêng; deploy website Vercel không tự chạy lệnh keeper. Nếu chạy trên laptop, keeper dừng khi tắt terminal, sleep hoặc tắt máy. Muốn gửi một lượt thủ công: `pnpm keeper --once --send`.

Khoảng cách giữa hai lượt quét mặc định là 60 giây sau khi lượt trước hoàn tất. Thời điểm chốt thực tế là sau mốc 24 giờ, cộng thời gian chờ lượt quét, xử lý Round, RPC và xác nhận giao dịch. Không bảo đảm đúng chính xác giây thứ 86.400.

## Cách 2: GitHub Actions, không cần host Node riêng

Sau khi đưa file workflow lên nhánh mặc định:

1. Repository **Settings → Secrets and variables → Actions → Variables**: đặt `NEXT_PUBLIC_FACTORY_ADDRESS` bằng Factory đang dùng trên Vercel.
2. **Secrets**: đặt `KEEPER_PRIVATE_KEY` của ví keeper riêng đã có AVAX Fuji. Có thể thêm secret `KEEPER_RPC_URL` nếu dùng RPC riêng.
3. Mở **Actions → Fuji - Finalize expired rounds → Run workflow**, giữ `dry_run=true` để kiểm tra trước.
4. Thêm repository variable `KEEPER_ENABLED=true` để bật lịch tự gửi. Muốn tắt lịch, đặt false hoặc xóa biến này. Workflow vẫn cho chạy dry-run thủ công khi lịch chưa bật.

Lịch quét mỗi 15 phút; GitHub có thể chạy trễ hoặc bỏ lịch tùy tình trạng dịch vụ/repository. Workflow có concurrency để không chạy chồng, không hủy giữa lượt gửi. Kiểm tra lịch sử Actions khi keeper báo lỗi hoặc không chốt. Actions tiêu tốn hạn mức runner của repository; chọn service liên tục nếu cần chủ động thời gian hơn.

Không bật hai phương án với cùng ví. Vercel không cần private key này.

## Giới hạn và vận hành

- Giới hạn mỗi giao dịch mặc định: gas limit tối đa 2.500.000 sau buffer 20%, gas price tối đa 100 gwei. Nếu vượt hoặc thiếu AVAX, bỏ qua và báo lỗi; lần quét sau thử lại.
- Round legacy thiếu getter, lỗi RPC, trạng thái hủy không đọc được: bỏ qua, không đoán trạng thái. Kiểm tra log và hợp đồng nếu Round liên tục bị bỏ qua.
- Thao tác chốt/hủy cạnh tranh của Organizer được simulation hoặc contract kiểm tra lại. Nếu đã gửi mà receipt timeout, không tự gửi lại ngay; đọc pending nonce và trạng thái ở lượt sau.
- Workflow chỉ một lần quét, trả exit code 1 khi có Round xử lý lỗi để Actions báo lỗi. Service liên tục ghi log và thử lại ở lượt tiếp theo. Không in private key hoặc raw RPC error.
- Chức năng phụ thuộc keeper chạy, RPC hoạt động và ví đủ AVAX. Smart contract không tự khởi chạy khi đồng hồ đạt 24 giờ.
- Chưa bật lịch GitHub, chưa đặt secret và chưa gửi giao dịch thật trong thay đổi local này.

## Kết quả kiểm tra local

- 10 test keeper đạt; TypeScript, ESLint các file mới và kiểm tra YAML workflow đạt.
- Đã chạy dry-run đọc Fuji bằng Factory local `0xac3c59afacb7df7d082d2dadeeca1c5763f63687`: `eligible=0, finalized=0, skipped=0, failed=0` (Factory trả danh sách Round rỗng tại thời điểm kiểm tra).
- Chưa có bằng chứng gửi finalize thật trên Fuji; đường gửi giao dịch được kiểm tra bằng mock, không dùng private key thật trong quá trình triển khai.
