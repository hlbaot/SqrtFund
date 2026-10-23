# Phân tích hệ thống SqrtFund

Ngày phân tích: 23/10/2026. Phạm vi: mã nguồn và cấu hình trong workspace, bao gồm thay đổi chưa commit ở luồng email–ví. Đây là đánh giá kiến trúc và rà soát mã tĩnh kèm kiểm thử cục bộ; không phải kiểm toán bảo mật độc lập hoặc xác nhận trạng thái production.

## 1. Đánh giá tổng thể

SqrtFund là ứng dụng tài trợ dự án sinh viên bằng Quadratic Funding (QF), triển khai cho Avalanche Fuji. Mã nguồn đã có vòng nghiệp vụ khá đầy đủ: xác minh sinh viên, xét đơn Organizer, nạp quỹ trước, tạo round, đăng ký và duyệt dự án, donate đơn/lô, phân bổ matching, claim, hủy và hoàn tiền.

Phần on-chain phân tách quyền và nguồn tiền tương đối rõ. Khoảng trống đáng ưu tiên nằm ở API bảo vệ dữ liệu cá nhân, bằng chứng sở hữu ví khi gắn danh tính, và tính nhất quán giữa DB với blockchain. Đây là một MVP testnet có nền tảng tốt, nhưng các kiểm tra hiện tại chưa đủ cơ sở để kết luận sẵn sàng giữ tiền thật.

## 2. Kiến trúc và nguồn dữ liệu

```text
Trình duyệt / ví injected
   │
   ├── Next.js App Router + React + Tailwind
   │     ├── wagmi / viem ── RPC Fuji ── RoundFactory
   │     │                               ├── StudentRegistry dùng chung
   │     │                               └── PrefundedQFRound / QFRound từng vòng
   │     │                                       └── ERC-20 MockUSDC
   │     └── Axios / TanStack Query
   │                └── Next.js Route Handlers
   │                      ├── Supabase PostgreSQL, RPC SQL, RLS
   │                      ├── SMTP gửi OTP
   │                      └── Khóa attester ký EIP-712
   └── Giao dịch cần chữ ký của ví người dùng
```

| Lớp | Trách nhiệm | Đặc điểm |
|---|---|---|
| `src/app` | Routes, metadata, providers, API | Next.js 16.4.0 theo manifest; React 19.3.0 |
| `src/views`, `src/components` | Trang và thành phần giao diện | Có VI/EN, loading/error, thông báo giao dịch, dashboard |
| `src/hooks` | Đọc chain, quyền, quản lý giao dịch | wagmi, viem, TanStack Query; polling phổ biến 15 giây |
| `src/lib` | QF, chính sách, định dạng, RPC, backend helpers | Có BigInt cho tính matching và hỗ trợ contract legacy |
| `contracts/src` | Quyền và tài sản on-chain | Solidity 0.8.24, OpenZeppelin, Foundry |
| `supabase/migrations` | Danh tính, OTP, đơn Organizer | 6 migration trong workspace; migration 0006 chưa commit |
| `.github/workflows/ci.yml` | Kiểm tra và triển khai | Frontend + contracts trước khi deploy Vercel |

Nguồn xác thực quyền là contract. Vai trò chọn trong menu chỉ thay đổi trải nghiệm. Supabase lưu thông tin nghiệp vụ ngoài chain; số dư, khoản góp, kết quả phân bổ và quyền quản lý round nằm trên chain.

## 3. Vai trò và vòng đời nghiệp vụ

| Chủ thể | Nguồn quyền | Phạm vi |
|---|---|---|
| Student | `StudentRegistry.isStudent(wallet)` | Đăng ký dự án và donate ở round dùng registry tương ứng |
| Organizer | `RoundFactory.authorizedOrganizers(wallet)` | Nạp trước và tạo round |
| Platform Owner | `RoundFactory.owner()` | Cấp/thu hồi Organizer; cũng có quyền tạo round |
| Round Admin | `QFRound.admin()` | Duyệt/từ chối dự án, bổ sung pool, hủy, chốt trong thời gian ưu tiên |
| Project Owner | `Project.owner` | Claim tiền của dự án sau finalize |

Một ví có thể đồng thời mang nhiều quyền. Platform Owner không tự có quyền quản lý round của người khác. Thu hồi Organizer không đổi admin của round đã tạo; vì vậy thu hồi quyền tạo round không phải thao tác đóng băng toàn bộ hoạt động của ví đó.

Luồng sinh viên: yêu cầu OTP → xác nhận → backend ký attestation → người dùng gọi `verifyStudent` → chọn round → đăng ký dự án → admin duyệt → nhận donate → finalize → chủ dự án claim.

Luồng Organizer: xác minh email liên hệ → nộp đơn → Platform Owner gửi `setOrganizer` → ký quyết định → cập nhật DB → approve token → nạp Factory → tạo funded round.

Round nhận đăng ký/duyệt trước thời gian bắt đầu, nhưng trước thời gian kết thúc. Donate chỉ mở trong `[startTime, endTime)`. Sau kết thúc, admin được ưu tiên finalize trong 24 giờ; sau đó bất kỳ ai cũng được finalize. Admin có thể hủy bất kỳ lúc nào trước finalize, kể cả sau endTime.

## 4. Smart contract, QF và kế toán tiền

### Thiết kế đang làm tốt

- Factory gán admin của round bằng ví gọi tạo round, không nhận một địa chỉ admin tùy ý từ client.
- Tiền nạp trước được hạch toán riêng theo `(depositor, token)`. Ví vẫn rút được credit chưa dùng sau khi mất quyền Organizer.
- `createFundedRound` trừ credit, deploy và chuyển tiền trong cùng transaction; lỗi sẽ rollback toàn bộ.
- Factory kiểm tra chênh lệch số dư khi nhận/chuyển initial pool.
- `SafeERC20`, `ReentrancyGuard` và việc cập nhật trạng thái trước chuyển tiền bảo vệ nhiều đường tiền chính.
- Mỗi round tối đa 50 project, mỗi ví tối đa 2 project. Finalize không cần lặp qua toàn bộ donor.
- Donate nhiều lần cùng ví được cộng dồn trước khi tính căn bậc hai; chia một khoản thành nhiều transaction không tạo thêm donor hoặc matching tương ứng với nhiều người.
- Claim và rút quỹ dư tách biệt; hủy round cho phép donor tự refund, admin chỉ rút pool được ghi nhận.

### Công thức thực tế

Với mỗi project:

```text
S = tổng floor(sqrt(tổng góp của từng ví × 10^12))
raw = max(0, floor(S² / 10^12) - tổng tiền góp)
base = raw nếu tổng raw <= pool; ngược lại floor(pool × raw / tổng raw)
matching = min(base, floor(pool × maxMatchBps / 10000))
claim = tiền góp trực tiếp + matching
leftover = pool - tổng matching
```

Frontend có bản tính BigInt tương ứng trong `src/lib/qf.ts`. Trần matching được áp dụng sau bước chia tỷ lệ; phần bị cắt không được phân phối tiếp mà trở thành leftover cho admin. Ví dụ pool 10.000 USDC, hai dự án có raw 9.900 và 1.900, trần 30%: matching xấp xỉ 3.000 và 1.610, phần dư xấp xỉ 5.390. Đây là quyết định kinh tế cần được giải thích rõ cho nhà tài trợ.

### Giới hạn cần hiểu

- OTP xác nhận quyền truy cập hộp thư; không đảm bảo một con người chỉ có một email hoặc chống thông đồng giữa nhiều người. Cấm tự donate không ngăn được donate chéo giữa các ví.
- Quyền Student lưu vĩnh viễn trong registry hiện tại. Hạn attestation giới hạn thời gian gửi giao dịch xác minh, không phải hạn tư cách Student. Chưa có hàm revoke Student hoặc đổi ví.
- Round có admin immutable. Mất khóa admin sẽ mất khả năng duyệt/hủy/rút phần quỹ của admin, dù finalize vẫn mở cho mọi người sau thời gian ưu tiên.
- ERC-20 được truyền vào Factory là tham số tự do, nhưng frontend giả định token cấu hình và 6 decimals. Hỗ trợ nhiều token chưa đồng bộ giữa các lớp.

## 5. Phát hiện cần xử lý

Các phát hiện dưới đây dựa trên mã trong workspace. Chưa thử khai thác trên production.

### F1 — Cao: API đọc đơn Organizer trả dữ liệu cá nhân cho người gọi chưa xác thực

**Bằng chứng:** `src/app/api/organizer-applications/route.ts:16` gọi `listOrganizerApplications` mà không kiểm tra chữ ký/session. `src/lib/server/organizerApplications.ts:130` đọc `select("*")` bằng service role và trả `contactEmail`, `reason`, thông tin reviewer và lý do thu hồi.

**Tác động:** Người gọi không cần đăng nhập có thể yêu cầu danh sách, hoặc lọc theo ví công khai, để lấy các thông tin này. RLS ở DB không bảo vệ được khi API dùng service role rồi phát dữ liệu ra ngoài. Đây là vấn đề truy cập dữ liệu; không tự cấp quyền Organizer trên chain.

**Xử lý:** Xác thực chủ ví cho việc đọc đơn cá nhân và owner của Factory cho danh sách quản trị. Nếu cần danh sách công khai, tạo DTO chỉ chứa trường được công khai. Thêm kiểm thử người dùng chưa xác thực không đọc được email/lý do.

### F2 — Cao: Có thể gắn email của người khác vào một ví chưa có liên kết mà không cần chữ ký ví

**Bằng chứng:** API yêu cầu OTP nhận `address`/`walletAddress` từ body. Các bước confirm chỉ chứng minh OTP; sau đó gọi `ensureEmailWallet(..., true)` để lưu liên kết. Migration 0006 có unique theo `wallet_address`. Không có bước kiểm tra chữ ký của ví mục tiêu trước khi claim danh tính.

**Kịch bản:** Một người dùng email do họ kiểm soát, chọn địa chỉ ví mục tiêu chưa có liên kết, nhận và xác nhận OTP. Backend lưu email đó cho ví mục tiêu. Sau này chủ ví dùng email thật sẽ gặp `WALLET_ALREADY_VERIFIED`. Luồng Organizer còn chấp nhận email liên hệ thông thường, không chỉ email trường.

**Giới hạn tác động:** Người thực hiện không nhờ đó ký được transaction từ ví mục tiêu hoặc rút tiền của ví. Vấn đề là khóa danh tính và khả năng giả mạo hồ sơ gắn với địa chỉ công khai; quyền Student trên chain vẫn yêu cầu giao dịch từ ví.

**Xử lý:** Yêu cầu signed challenge có nonce, hạn dùng và ràng buộc domain/chain/wallet trước khi lưu liên kết vĩnh viễn. OTP và chữ ký phải khớp cùng yêu cầu. Bổ sung đường xử lý liên kết sai và mất ví có chính sách rõ ràng.

### F3 — Cao về độ tin cậy: Đơn Organizer có thể báo lưu thành công nhưng chỉ tồn tại trong RAM

**Bằng chứng:** `src/lib/server/organizerApplications.ts:84` chuyển mọi lỗi insert sang `fallbackStore`; đường đọc cũng trả fallback khi DB lỗi. Fallback nằm trong `globalThis`, không có hàng đợi bền vững hoặc cơ chế ghi lại DB.

**Tác động:** Sau khi bước kiểm tra danh tính đã thành công, lỗi lưu đơn có thể vẫn trả HTTP 201 dù đơn chỉ nằm ở instance hiện tại. Trên môi trường serverless, instance khác hoặc cold start có thể không thấy đơn. DB lỗi ở đường đọc còn có thể hiện danh sách trống thay vì lỗi tải.

**Xử lý:** Production phải trả lỗi rõ ràng khi không lưu được DB; nếu cần dự phòng thì dùng kho bền vững và cơ chế retry. Chỉ bật fallback RAM bằng cấu hình phát triển rõ ràng. Không nuốt lỗi đọc hoặc cập nhật quyết định.

### F4 — Trung bình: DB có thể ghi approved/revoked mà chưa xác minh giao dịch tương ứng

**Bằng chứng:** `src/lib/server/organizerReviewAuthorization.ts:25` kiểm tra chain, owner và chữ ký quyết định, nhưng không đọc receipt/log `OrganizerUpdated`, không đối chiếu ví ứng viên hoặc trạng thái quyền hiện tại. `txHash` được phép null; nếu có thì chỉ kiểm tra định dạng.

**Tác động:** Giao diện có trình tự transaction rồi ký, nhưng API vẫn có thể ghi trạng thái không phản ánh quyền trên chain. Giao dịch thành công rồi người dùng hủy ký hoặc DB lỗi cũng gây sai lệch theo chiều ngược lại. Chữ ký owner vẫn bảo vệ endpoint trước người ngoài; đây không phải lỗ hổng tự cấp quyền của khách.

**Xử lý:** Đối chiếu receipt thành công, đúng Factory, đúng event và đúng ví; xác định quy tắc cho transaction cũ. Thêm tác vụ đối soát hoặc luồng khôi phục từ event để hoàn tất quyết định bị gián đoạn.

### F5 — Trung bình: Kiểm tra một đơn pending mỗi ví chưa nguyên tử

**Bằng chứng:** `src/app/api/organizer-applications/route.ts:65` đọc đơn trước rồi insert riêng. Các migration hiện có không có partial unique index cho ví với `status = 'pending'`.

**Tác động:** Hai POST đồng thời có cùng email proof hợp lệ có thể cùng vượt kiểm tra và tạo hai đơn pending. Khóa advisory ở hàm liên kết email không bao phủ transaction đọc/ghi đơn.

**Xử lý:** Dùng unique index có điều kiện theo `lower(wallet_address)` khi pending, ánh xạ lỗi unique thành 409. Nếu bổ sung constraint, cần xử lý F3 để lỗi không bị chuyển thành thành công trong RAM.

### F6 — Trung bình, khi mở rộng token: Kế toán round giả định token chuyển đủ số lượng

**Bằng chứng:** `contracts/src/QFRound.sol` tăng `pool`/`totalDonated` theo amount rồi `safeTransferFrom`, không kiểm tra chênh lệch balance. Factory có kiểm tra này ở initial pool nhưng round không có ở `depositPool`, `donate`, `donateMany`.

**Tác động:** Với token thu phí khi chuyển, nợ được ghi nhận có thể lớn hơn tài sản thực, làm claim/refund về sau thiếu tiền. MockUSDC hiện tại không có phí chuyển, nên phát hiện này phụ thuộc loại token được chọn. `SafeERC20` không đảm bảo số token nhận thực bằng amount.

**Xử lý:** Giới hạn token được hỗ trợ, hoặc kiểm tra số dư nhận thực và từ chối token không phù hợp. Đọc decimals đúng token nếu chủ đích hỗ trợ nhiều tài sản.

### F7 — Trung bình về tính đúng sản phẩm: Category chọn trong form không được lưu

**Bằng chứng:** `src/components/project/ProjectForm.tsx:109` gửi 4 tham số đăng ký, không có category. Contract không có trường category. `src/hooks/useProjects.ts:154` gán mọi dự án thành `technology`.

**Tác động:** Người dùng chọn education/environment/arts thấy đúng trong preview nhưng khi đọc lại bị đổi thành technology. Phân loại hoặc bộ lọc dựa trên category không phản ánh lựa chọn đã gửi.

**Xử lý:** Bỏ lựa chọn nếu chưa hỗ trợ, hoặc lưu metadata có category và ràng buộc với project/owner; lên kế hoạch tương thích round cũ nếu thay contract.

### F8 — Thấp: Tổng supporters của round không phải số ví duy nhất

**Bằng chứng:** `src/lib/roundStats.ts:37` cộng supporterCount của tất cả project. Mỗi project lưu donorCount riêng.

**Tác động:** Một ví góp hai project được đếm hai lần trong tổng round. Chỉ số đúng nếu ý nghĩa là số lượt ủng hộ theo cặp ví–project; sẽ gây hiểu nhầm nếu gọi là số sinh viên/nhà tài trợ duy nhất.

**Xử lý:** Đặt tên chỉ số theo đúng ý nghĩa, hoặc tính distinct donor từ events/indexer. Không dùng tổng này làm bằng chứng số người tham gia duy nhất.

## 6. Danh tính, dữ liệu và bảo mật vận hành

OTP dùng bộ sinh số ngẫu nhiên mật mã, HMAC gắn với request ID và so sánh hash có thời gian hằng ở lớp JavaScript. SQL consume dùng khóa hàng và giới hạn 5 lần thử. SQL reserve khóa các định danh theo thứ tự cố định, nên rate limit không phụ thuộc bộ nhớ của từng serverless instance.

Migration 0006 chuyển email mới sang khóa email chuẩn hóa và ID ngẫu nhiên 32 byte, giữ tên ABI `emailHash` để tương thích. Điều này tránh đưa hash email mới có thể dò từ danh sách email lên chain, nhưng DB vẫn chứa email trực tiếp. Email và ví chỉ được gắn sau OTP, có unique constraint và tương thích dữ liệu hash cũ.

Các điểm vận hành cần chốt:

- Tự động áp dụng/kiểm tra migration trước khi phiên bản API mới nhận traffic. Chưa thấy bước migration trong workflow CI/CD hiện tại; chưa xác nhận DB thật đã chạy 0006.
- SQL regression trong `supabase/tests/plain_email_wallet.sql` chưa được workflow chạy và chưa được thực thi trong lần phân tích này.
- Có bảng email/OTP nhưng chưa thấy cơ chế cleanup định kỳ đồng nhất cho mọi bảng. Student OTP được dọn cũ trong request; Organizer OTP chưa thấy job cleanup tương ứng.
- Xác định thời hạn lưu PII, backup/restore, quản lý truy cập service role và khóa ký. Attester là bên được tin cậy để cấp tư cách Student; khóa bị lộ ảnh hưởng mọi round dùng registry đó.
- Chuẩn hóa `+tag` cho mọi domain là quyết định danh tính cần khớp hành vi email trường; không phải mọi hệ thống email đều có cùng quy tắc alias.

## 7. Frontend, hiệu năng và khả năng mở rộng

Điểm tích cực: cache có stale/gc policy tập trung, multicall/batching RPC, retry/backoff, hỗ trợ RPC fallback ở client, dò khả năng contract legacy, giữ trạng thái không đọc được thay vì luôn hiển thị số 0, có kiểm tra token và xử lý hủy flow khi ví/network thay đổi.

Các điểm sẽ giới hạn khi tăng quy mô:

- Factory `getRounds()` trả toàn bộ danh sách; `useAdminRounds` đọc admin/name cho mọi round rồi lọc ở client. Chi phí tăng theo tổng round, dù ví chỉ quản lý một vài round.
- Nhiều hook chia sẻ truy vấn nhưng có nhiều biến thể query key theo ví và tập contracts. Không thể giả định số request được gộp hoàn toàn; cần đo trên trang và quy mô dữ liệu thật.
- Danh sách đơn Organizer đọc toàn bộ từ DB rồi phân trang ở UI. Phân trang 4 mục không làm nhỏ dữ liệu server trả; truy vấn không có cursor/limit rõ ràng còn chịu giới hạn trả dữ liệu của backend.
- Polling 15 giây cho metadata và dữ liệu thay đổi chậm làm tăng tải RPC theo số người dùng đang mở trang. Có thể cache metadata immutable lâu hơn và invalidation theo receipt/event.
- Chưa thấy indexer phục vụ lịch sử/donor duy nhất/thống kê tổng hợp. Với MVP, đọc trực tiếp đơn giản; khi nhiều round cần read model có phân trang và khả năng đối soát chain.
- API ký xác minh và xét đơn tự tạo public client bằng `http(primary)`; chưa dùng cùng RPC fallback policy với frontend.
- Các view quản trị và hoạt động cá nhân dài hàng trăm dòng; `copy.ts` gần 2.000 dòng. Tách theo nghiệp vụ giúp sửa đổi và rà soát quyền dễ hơn.

Không có số liệu Lighthouse, độ trễ RPC production hoặc kiểm thử tải mới trong lần này; không suy ra hiệu năng thực từ build thành công.

## 8. Kiểm thử và triển khai

Kết quả chạy cục bộ:

| Kiểm tra | Kết quả |
|---|---|
| Vitest qua binary hiện có | 77 file đạt, 2 file bỏ qua; 670 test đạt, 13 test bỏ qua |
| ESLint | 0 lỗi, 4 cảnh báo biến/import không dùng |
| `next typegen` + `tsc --noEmit` | Đạt |
| Production build (`next build --webpack`) | Đạt; có cảnh báo dynamic dependency từ `ox` qua `viem/chains` |
| Foundry | Chưa chạy được: không có `forge` trong môi trường |
| SQL regression | Chưa chạy trên PostgreSQL thử nghiệm |
| End-to-end với ví/SMTP/chain thật | Chưa chạy; integration test mặc định bị tắt |

`pnpm test`/`pnpm lint` ban đầu bị cơ chế kiểm tra dependency của pnpm chặn vì muốn cài lại modules và không có TTY. Đã chạy trực tiếp binary hiện có trong `node_modules/.bin`, không cài lại dependency. Vì vậy kết quả phản ánh dependency đang cài trong workspace, không chứng minh một clean install từ lockfile sẽ có kết quả giống hệt.

Test bao phủ nhiều logic nghiệp vụ, SSR markup, API mock và cả kiểm tra nội dung mã nguồn. Có bộ Foundry cho quyền, QF, initial pool, cancellation và invariant bảo toàn tiền; chưa xác nhận kết quả chạy Foundry trong phiên này. Test dùng mock hoặc kiểm tra chuỗi nguồn không thay thế kiểm thử thao tác ví trong trình duyệt. Các vấn đề F1/F2 cho thấy test suite xanh vẫn có thể thiếu tình huống đối kháng ở ranh giới API.

CI tách frontend/contracts; deploy production đợi cả hai job. Deploy chạy build lại bằng môi trường Vercel và dùng output đó, thay vì artifact build từ job frontend. Đây là bước build theo cấu hình production, nhưng chưa thấy bước kiểm thử tích hợp/migration/smoke test sau deploy. Git deployment tự động của Vercel bị tắt trong `vercel.json`, nên cần đảm bảo đường GitHub Actions luôn hoạt động.

## 9. Thứ tự cải thiện đề xuất

| Ưu tiên | Công việc | Tiêu chí hoàn thành |
|---|---|---|
| 1 | Chặn đọc dữ liệu Organizer trái quyền — F1 | Khách không lấy được PII; chủ ví chỉ đọc đơn mình; owner đọc danh sách quản trị |
| 1 | Xác thực sở hữu ví trước claim danh tính — F2 | OTP đúng nhưng thiếu/sai chữ ký ví không tạo liên kết |
| 1 | Bỏ fallback RAM trong production — F3 | DB lỗi trả lỗi rõ ràng; không báo thành công khi chưa lưu bền vững |
| 2 | Chống trùng pending bằng DB — F5 | Hai request đồng thời chỉ tạo được một đơn |
| 2 | Đối soát quyết định với chain — F4 | Transaction không khớp không ghi approved/revoked; khôi phục được sau gián đoạn |
| 2 | Kiểm thử migration và luồng ví thực | Có PostgreSQL test tách biệt, Foundry chạy được và E2E approve/donate/claim/refund |
| 3 | Chốt phạm vi token và category — F6/F7 | Token/decimals nhất quán; lựa chọn category được lưu hoặc bỏ khỏi form |
| 3 | Pagination server và cache dữ liệu round | Dữ liệu/request được đo ở nhiều quy mô; không tải toàn bộ khi chỉ cần một trang |
| 3 | Định nghĩa chỉ số supporters — F8 | Nhãn giao diện khớp cách đếm và thống kê công bố |

Các cải thiện trước mắt chủ yếu thuộc API, DB và quy trình kiểm thử; chưa có lý do từ đánh giá này để viết lại toàn bộ kiến trúc. Thay đổi contract cần kế hoạch deployment và hỗ trợ round cũ vì các round hiện tại không có cơ chế upgrade trong mã đã đọc.
