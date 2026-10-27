<p align="center">
  <img src="public/brand/npower-horizontal.png" alt="Logo N-Power" width="480" />
</p>

<h1 align="center">N-Power</h1>

<p align="center">Nền tảng Quadratic Funding cho câu lạc bộ và dự án sinh viên trên Avalanche.</p>

<p align="center">
  <a href="https://www.sqrtfund.tech/">Ứng dụng</a> ·
  <a href="https://www.canva.com/design/DAHYhkwRwHU/_L6w-_FjVNtWDEsDq29LGw/edit">Slide giới thiệu</a> ·
  <a href="#cài-đặt-và-chạy-local">Cài đặt</a> ·
  <a href="#tài-liệu">Tài liệu</a>
</p>

**N-Power** giúp sinh viên gây quỹ cho ý tưởng của mình và cùng quyết định những dự án nên nhận thêm tài trợ. Nhà tổ chức cung cấp một quỹ đối ứng, sinh viên đóng góp cho dự án quan tâm, còn hợp đồng thông minh tính khoản tài trợ bổ sung theo cơ chế **Quadratic Funding (QF)**.

Ở cùng tổng tiền đóng góp, một dự án có nhiều người ủng hộ có thể nhận mức đối ứng cao hơn dự án chỉ nhận vài khoản góp lớn. Các khoản góp và kết quả phân bổ được ghi nhận trên blockchain để người tham gia có thể đối chiếu.

| Thông tin | Chi tiết |
| --- | --- |
| Nhóm phát triển | **43xTSD** |
| Chủ đề | Topic 6 — Avalanche Hackathon (Team1 Vietnam) |
| Mạng thử nghiệm | Avalanche Fuji C-Chain, chain ID `43113` |
| Token dùng thử | MockUSDC, 6 chữ số thập phân |
| Tên repository | `SqrtFund` — tên cũ còn được giữ trong package, script và một số thông điệp ký |

> Repository chứa phiên bản thử nghiệm trên Fuji với MockUSDC. Hợp đồng chưa được kiểm toán bảo mật độc lập. Địa chỉ triển khai bên dưới lấy từ repository, không phải xác nhận rằng website luôn chạy cùng phiên bản mã nguồn.

## Vấn đề và giải pháp

Các nhóm sinh viên cần kinh phí cho hoạt động câu lạc bộ, nghiên cứu và sản phẩm thử nghiệm. Nếu chỉ xét tổng tiền gây quỹ, một số khoản góp lớn có thể lấn át sự quan tâm của nhiều sinh viên đóng góp ít hơn. Việc theo dõi cách phân bổ quỹ cũng khó khăn khi dữ liệu nằm rải rác.

N-Power tổ chức việc gây quỹ thành từng **vòng tài trợ** với thời gian, ngân sách và giới hạn đóng góp cụ thể. Sinh viên đã xác minh chọn dự án để ủng hộ. Khi vòng kết thúc, hệ thống tính phần quỹ đối ứng theo quy tắc đã thiết lập.

### Chức năng hiện có trong mã nguồn

- **Xác minh sinh viên:** xác thực email trường bằng OTP, chứng minh quyền sở hữu ví và ghi danh vào `StudentRegistry` bằng attestation EIP-712. Registry dùng chung cho nhiều vòng.
- **Quản lý nhà tổ chức:** xác thực email liên hệ, gửi đơn, xét duyệt, thu hồi quyền kèm lý do và nộp lại đơn.
- **Nhiều vòng tài trợ:** nhà tổ chức nạp quỹ trước vào Factory rồi tạo một contract riêng cho mỗi vòng.
- **Đăng ký và duyệt dự án:** sinh viên chọn vòng để nộp dự án, người tạo vòng xét duyệt hoặc từ chối.
- **Đóng góp đơn lẻ hoặc theo lô:** `donate` và `donateMany`, cộng dồn khoản góp theo ví/dự án và đếm người ủng hộ không trùng trong từng dự án.
- **Phân bổ quỹ on-chain:** xem matching dự kiến, chốt kết quả, nhận tiền góp cùng khoản đối ứng và rút phần quỹ dư.
- **Hủy vòng và hoàn tiền:** người tạo vòng hủy trước khi chốt. Người góp yêu cầu hoàn lại khoản đã góp qua `refund` hoặc `refundMany`.
- **Theo dõi hoạt động:** danh sách vòng, dự án, bảng xếp hạng, hoạt động cá nhân và thông báo qua Socket.IO kết hợp tải lại dữ liệu.

## Quadratic Funding hoạt động thế nào?

Với dự án $j$, gọi $d_{i,j}$ là **tổng** tiền sinh viên $i$ đã góp cho dự án đó. Nhu cầu đối ứng thô được tính theo:

$$
M_j = \left(\sum_i \sqrt{d_{i,j}}\right)^2 - \sum_i d_{i,j}
$$

Ví dụ minh họa với hai dự án cùng nhận tổng cộng **100 USDC**:

| Cách đóng góp | Tiền góp trực tiếp | Nhu cầu đối ứng thô |
| --- | ---: | ---: |
| 100 người, mỗi người 1 USDC | 100 USDC | 9.900 USDC |
| 20 người, mỗi người 5 USDC | 100 USDC | 1.900 USDC |

Các con số trên minh họa công thức, chưa áp dụng giới hạn riêng của vòng. Chúng **không phải số tiền tài trợ được bảo đảm**. Contract tính khoản đối ứng cuối cùng như sau:

1. Tính nhu cầu thô của các dự án đã duyệt.
2. Nếu tổng nhu cầu vượt quỹ, giảm các khoản theo tỷ lệ tương ứng. Nếu quỹ đủ, giữ mức nhu cầu thô.
3. Áp dụng trần `maxMatchBps` cho khoản đối ứng của từng dự án. Trần này không giới hạn tiền góp trực tiếp.
4. Giữ phần dư do trần hoặc làm tròn, không phân phối lại. Admin của vòng có thể rút phần dư sau khi chốt.

Chủ dự án nhận **tiền góp trực tiếp + khoản đối ứng cuối cùng**. Một ví góp nhiều lần cho cùng dự án vẫn chỉ tính là một người ủng hộ, và công thức lấy căn của tổng đã góp. Xem cách tính trong [`QFRound.sol`](contracts/src/QFRound.sol) và [`qf.ts`](src/lib/qf.ts).

## Vai trò và quy trình sử dụng

| Vai trò | Trách nhiệm | Quyền được xác định bởi |
| --- | --- | --- |
| **Student — Sinh viên** | Xác minh email trường, đăng ký dự án, đóng góp, nhận kinh phí hoặc yêu cầu hoàn tiền khi vòng bị hủy | `StudentRegistry.isStudent(wallet)` |
| **Organizer — Nhà tổ chức** | Xin quyền, nạp quỹ, tạo vòng và quản lý các vòng do chính ví mình tạo | Quyền trên `RoundFactory` và `QFRound.admin()` |
| **Admin — Quản trị nền tảng** | Xét đơn và cấp/thu hồi quyền Organizer, đồng thời có thể tạo vòng | `RoundFactory.owner()` |

**Chủ dự án** là sinh viên sở hữu dự án, không phải một vai trò riêng. **Admin của vòng** là ví đã tạo vòng đó. Admin nền tảng và Organizer không tự có quyền quản lý vòng của ví khác. Việc chọn hồ sơ trên giao diện không cấp quyền trên blockchain.

### Luồng trải nghiệm

1. **Chuẩn bị ví:** kết nối ví EVM với Avalanche Fuji, có AVAX testnet để trả phí và MockUSDC để thử nạp quỹ hoặc đóng góp.
2. **Cấp quyền nhà tổ chức:** Organizer xác thực email liên hệ và gửi đơn. Admin nền tảng duyệt bằng giao dịch cấp quyền, sau đó ký quyết định để cập nhật hồ sơ.
3. **Tạo vòng:** Organizer/Admin cho phép Factory sử dụng token nếu cần, gọi `depositInitialPool`, đợi xác nhận rồi gọi `createFundedRound`. Quỹ được chuyển vào vòng mới trong giao dịch tạo vòng.
4. **Xác minh và nộp dự án:** sinh viên xác thực email tại `/verify`, hoàn tất giao dịch ghi danh, sau đó chọn vòng tại `/register` để nộp dự án. Chỉ nhận OTP chưa đủ để có quyền Student on-chain.
5. **Duyệt và đóng góp:** người tạo vòng duyệt dự án. Trong thời gian nhận đóng góp, sinh viên góp cho các dự án đã duyệt của người khác.
6. **Chốt và nhận tiền:** sau `endTime`, admin của vòng có quyền chốt độc quyền trong 24 giờ đầu. Hết khoảng thời gian này, bất kỳ ví nào cũng có thể gọi `finalize`. Chủ dự án dùng `claim` để nhận kinh phí.

Nếu vòng bị hủy trước khi chốt, người góp có thể nhận lại toàn bộ **số token đã góp**. Phí gas của các giao dịch không nằm trong khoản hoàn này.

### Các quy tắc cần biết

- Mỗi vòng tối đa **50 dự án**, mỗi ví đăng ký tối đa **2 dự án/vòng**. Dự án bị từ chối vẫn tính vào giới hạn và không thể được duyệt lại trên chain.
- Có thể đăng ký và duyệt trước giờ mở đóng góp, nhưng phải trước khi vòng kết thúc và khi vòng chưa chốt hoặc bị hủy.
- Đóng góp chỉ diễn ra trong khoảng `startTime <= thời gian hiện tại < endTime`. Chủ dự án không được tự góp cho dự án của mình.
- `minDonation`, `maxDonation` và `maxPerRound` giới hạn khoản góp tối thiểu, tổng góp theo dự án và tổng chi của một ví trong vòng. Mức **1–5 USDC** chỉ là ví dụ cấu hình.
- Giao diện hồ sơ Organizer tập trung vào tài trợ và quản lý vòng, không mở thao tác quyên góp. Điều kiện đóng góp trên contract vẫn dựa vào quyền Student và các ràng buộc của vòng.
- Thu hồi quyền Organizer chặn tạo vòng mới, không đổi admin của vòng đã tạo. Ví vẫn có thể rút số dư nạp trước chưa sử dụng của chính mình.

## Kiến trúc

| Thành phần | Công nghệ | Phạm vi |
| --- | --- | --- |
| Giao diện | Next.js App Router, React, TypeScript, Tailwind CSS | Khám phá dự án, quản lý vòng, biểu mẫu và giao diện tiếng Việt/Anh |
| Kết nối blockchain | wagmi, viem | Đọc contract, ký và gửi giao dịch qua ví |
| Dữ liệu giao diện | TanStack Query, Axios, Zustand | Truy vấn API, cache và phản chiếu trạng thái giao diện |
| Hợp đồng thông minh | Solidity, OpenZeppelin, Foundry | Danh tính Student, quyền tạo vòng, quỹ, đóng góp và phân bổ QF |
| API và database | Next.js API, Supabase/PostgreSQL | OTP, liên kết email–ví, hồ sơ Organizer và quyết định xét duyệt |
| Email | SMTP hoặc Resend | Gửi OTP xác thực |
| Hình ảnh dự án | Cloudinary | Upload có chữ ký ví, kiểm tra ảnh và quota phía server |
| Thông báo | Socket.IO service riêng | Báo thay đổi để client đọc lại dữ liệu từ nguồn |
| Tác vụ chốt vòng | Node.js keeper hoặc GitHub Actions | Gọi `finalize` sau thời gian ân hạn khi được cấu hình |

**Dữ liệu round, project, khoản góp và kết quả phân bổ nằm on-chain.** Supabase lưu dữ liệu xác minh và hồ sơ Organizer. Zustand, cache và thông báo không thay thế nguồn dữ liệu hoặc kiểm tra quyền trên contract.

### Các contract chính

| Contract | Chức năng |
| --- | --- |
| [`StudentRegistry`](contracts/src/StudentRegistry.sol) | Xác minh ví Student qua attestation EIP-712, ràng buộc hash email với ví |
| [`RoundFactory`](contracts/src/RoundFactory.sol) | Phân quyền Organizer, quản lý số dư nạp trước và tạo vòng |
| [`QFRound`](contracts/src/QFRound.sol) | Đăng ký/duyệt dự án, đóng góp, tính QF, chốt, nhận tiền, hủy và hoàn tiền |
| [`PrefundedQFRound`](contracts/src/PrefundedQFRound.sol) | Kế thừa vòng QF và nhận quỹ ban đầu từ Factory |
| [`MockUSDC`](contracts/src/MockUSDC.sol) | Token ERC-20 dùng cho thử nghiệm, có hàm faucet |

## Cài đặt và chạy local

### Yêu cầu

- **Node.js 24** để đồng bộ với môi trường CI.
- **pnpm** theo phiên bản `packageManager` trong [`package.json`](package.json).
- **Foundry** nếu cần build, kiểm thử hoặc triển khai contract.
- Supabase, dịch vụ email và ví Fuji để sử dụng đầy đủ luồng xác minh. Upload ảnh cần thêm Cloudinary.

### 1. Lấy mã nguồn và cài dependencies

```bash
git clone --recurse-submodules https://github.com/hlbaot/SqrtFund.git
cd SqrtFund
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Nếu đã clone mà chưa có thư viện contract, chạy `git submodule update --init --recursive`.

### 2. Cấu hình môi trường

Điền giá trị trong `.env.local` theo [`.env.example`](.env.example). File mẫu là danh sách cấu hình đầy đủ, gồm:

| Nhóm | Biến chính | Mục đích |
| --- | --- | --- |
| Mạng và contract | `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL`, `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS` | Kết nối Fuji và đúng bộ contract |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Lưu dữ liệu xác minh, hồ sơ và quota |
| Xác minh | `OTP_SECRET`, `ATTESTER_PRIVATE_KEY` | Băm OTP và ký bằng khóa tương ứng với attester trên registry |
| Chính sách email | `ALLOWED_EMAIL_DOMAINS`, `BLOCKED_EMAIL_DOMAINS` | Cho phép tên miền cụ thể và chặn tên miền không phù hợp |
| Email | `EMAIL_PROVIDER`, các biến `SMTP_*` hoặc `RESEND_API_KEY` | Gửi OTP qua SMTP hoặc Resend |
| Upload ảnh | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Upload có chữ ký phía server. Unsigned preset cũ không thay thế cấu hình này |
| Realtime, tùy chọn | `NEXT_PUBLIC_SOCKET_URL`, `SOCKET_SERVER_URL`, `SOCKET_PUBLISH_SECRET`, `SOCKET_ALLOWED_ORIGINS` | Kết nối và publish thông báo qua Socket.IO |
| Keeper, tùy chọn | `KEEPER_PRIVATE_KEY`, `KEEPER_RPC_URL` | Chạy tác vụ chốt vòng bằng ví riêng |

Chỉ các biến `NEXT_PUBLIC_*` được đưa vào trình duyệt và được nhúng khi build. Giữ khóa ký, khóa Supabase, mật khẩu email và Cloudinary secret ở phía server. Không commit file môi trường chứa giá trị thật.

Khi `ALLOWED_EMAIL_DOMAINS` để trống, chính sách MVP chấp nhận hậu tố `.edu`/`.edu.vn`. Khi cấu hình danh sách cho phép, tên miền phải khớp chính xác, kể cả tên miền con. Xem [chính sách email sinh viên](docs/student-domain-policy.md).

### 3. Khởi tạo cơ sở dữ liệu

Chạy các file SQL trong [`supabase/migrations/`](supabase/migrations/) theo thứ tự **0001 đến 0009** trên Supabase project của bạn. Các migration bao gồm xác minh email, đơn Organizer, OTP liên hệ, liên kết email–ví, lý do thu hồi, thời hạn OTP, quota upload và transaction xét duyệt.

Đơn Organizer sử dụng database làm nguồn dữ liệu duy nhất. Thiếu cấu hình hoặc migration có thể khiến API trả lỗi dịch vụ, không tự chuyển sang lưu đơn trong bộ nhớ. Không chạy các SQL fixture trong `supabase/tests/` trên database production.

### 4. Chạy ứng dụng

```bash
pnpm dev
```

Mở **http://localhost:3000**. Để kiểm tra Factory đã cấu hình, chạy:

```bash
pnpm check:factory
```

Lệnh này chỉ đọc cấu hình/contract. Nếu cần realtime, cấu hình biến Socket.IO rồi chạy `pnpm realtime` ở terminal riêng. Xem [hướng dẫn realtime](docs/realtime-notifications.md) và [keeper chốt vòng](docs/finalize-keeper.md) cho các dịch vụ tùy chọn.

## Kiểm thử và triển khai

### Kiểm tra ứng dụng

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

### Kiểm tra contract

```bash
cd contracts
forge build
forge test --gas-report
```

Các integration test cần RPC hoặc Supabase riêng phải được bật và cấu hình theo từng bộ test. Không dùng khóa hoặc dữ liệu production cho test fixture.

### Cấu hình triển khai Fuji

Địa chỉ dưới đây lấy từ [`contracts/deployments/fuji.json`](contracts/deployments/fuji.json):

| Contract | Địa chỉ trên Fuji |
| --- | --- |
| StudentRegistry | [`0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e`](https://testnet.snowtrace.io/address/0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e) |
| RoundFactory | [`0xB2A91fd342d4C81061A97C42A789253d2252D85E`](https://testnet.snowtrace.io/address/0xB2A91fd342d4C81061A97C42A789253d2252D85E) |
| MockUSDC | [`0xFf56491e29085043DbB11cd01D54cC1449A3d686`](https://testnet.snowtrace.io/address/0xFf56491e29085043DbB11cd01D54cC1449A3d686) |

Mỗi vòng có địa chỉ `QFRound` riêng do Factory tạo ra. Khi tự triển khai, đối chiếu receipt, registry và khả năng nạp quỹ của Factory trước khi cập nhật file địa chỉ và biến môi trường. Thay ABI không nâng cấp contract đã triển khai. Thay `NEXT_PUBLIC_*` cần build lại frontend.

Workflow [CI/CD](.github/workflows/ci.yml) kiểm tra frontend, contract và database fixture. Job deploy Vercel chỉ chạy trên `main` sau khi cả ba nhóm kiểm tra đạt. Workflow không tự triển khai smart contract hoặc chạy migration production.

## Giới hạn và giả định tin cậy

- **Xác minh email có giới hạn:** OTP chứng minh quyền truy cập hộp thư theo chính sách tên miền, chưa chứng minh một người là sinh viên đang theo học hoặc chỉ có một hộp thư. Cơ chế hiện tại chưa phải ZK-Email.
- **Backend giữ khóa attester:** hệ thống tin cậy backend trong việc xác thực email và ký attestation. Owner của registry có thể thay attester.
- **QF vẫn có rủi ro thông đồng:** các nhóm phối hợp đóng góp có thể tác động kết quả. Ràng buộc email–ví, hạn mức và duyệt dự án giúp giảm lạm dụng, không loại bỏ hoàn toàn rủi ro.
- **Người tạo vòng có quyền quản lý:** họ quyết định duyệt/từ chối dự án và có thể hủy vòng trước khi chốt, kể cả sau giờ kết thúc. Người góp phải tự gửi giao dịch yêu cầu hoàn token nếu vòng bị hủy.
- **Nguồn quỹ qua nhà tổ chức:** nạp vào Factory dành cho Organizer/Admin, bổ sung vào vòng dành cho admin của vòng. Chưa có luồng nạp trực tiếp công khai cho mọi nhà tài trợ.
- **Blockchain và database là hai hệ thống riêng:** giao dịch cấp/thu hồi quyền thành công không bị hoàn tác nếu cập nhật hồ sơ thất bại. Cần đối chiếu receipt và trạng thái quyền khi xử lý sai lệch.
- **Dữ liệu dự án công khai:** mô tả, liên kết, địa chỉ ví và khoản góp được lưu trên blockchain. Email và hồ sơ xác minh nằm trong backend; hash email on-chain không đồng nghĩa với ẩn danh hoàn toàn.
- **Phạm vi testnet:** cần kiểm toán độc lập và đánh giá vận hành trước khi cân nhắc sử dụng tài sản thật.

## Hướng phát triển

- Kiểm chứng mô hình với câu lạc bộ, nhà trường và nhà tài trợ trong các vòng thử nghiệm nhỏ.
- Nghiên cứu ZK-Email và các hình thức xác minh giảm phụ thuộc vào attester tập trung.
- Đánh giá pairwise matching và ngưỡng người ủng hộ tối thiểu để hạn chế thông đồng.
- Mở rộng cơ chế nạp quỹ đối ứng và xử lý phần dư cho nhiều nhà tài trợ.
- Bổ sung thống kê người ủng hộ duy nhất trên toàn vòng/nền tảng.
- Kiểm toán bảo mật trước khi triển khai ngoài phạm vi thử nghiệm.

## Cấu trúc dự án

```text
SqrtFund/
├── contracts/             # Solidity, kiểm thử Foundry, script và địa chỉ triển khai
├── src/
│   ├── app/               # Next.js App Router và API
│   ├── components/        # Giao diện vòng, dự án, xác minh và quản trị
│   ├── hooks/             # Truy vấn, ví và thao tác contract
│   ├── lib/               # Toán QF, API, store, xác thực và logic server
│   └── views/             # Các màn hình chính
├── public/brand/          # Logo và nhận diện N-Power
├── realtime/              # Socket.IO service và worker đọc sự kiện blockchain
├── scripts/               # Kiểm tra cấu hình, keeper và công cụ hỗ trợ
├── supabase/migrations/   # Schema, hàm SQL và quyền truy cập database
├── __tests__/             # Kiểm thử ứng dụng và API bằng Vitest
├── docs/                  # Hướng dẫn và báo cáo kỹ thuật
└── .env.example           # Mẫu cấu hình, không chứa khóa thật
```

## Tài liệu

| Nội dung | Tài liệu |
| --- | --- |
| Hợp đồng và lệnh Foundry | [Smart contracts](contracts/README.md) |
| Nạp quỹ trước khi tạo vòng | [Prefunded Factory](docs/prefunded-factory-deployment.md) |
| Quyền quản trị nền tảng | [Platform Admin](docs/platform-admin-access.md) |
| Công thức và quyết toán quỹ | [Matching settlement](docs/matching-settlement.md) |
| Liên kết email với ví | [Email–wallet identity](docs/email-wallet-identity.md) |
| Chính sách tên miền | [Student domain policy](docs/student-domain-policy.md) |
| Upload ảnh có xác thực và quota | [SF-03](docs/sf03-upload-auth-quota.md) |
| Lưu đơn và xét duyệt bền vững | [SF-04](docs/sf04-durable-organizer-applications.md) |
| Thông báo | [Realtime notifications](docs/realtime-notifications.md) |
| Tự động chốt vòng | [Finalize keeper](docs/finalize-keeper.md) |
| Kiểm tra và bản build | [CI](docs/ci.md) |
| Triển khai website | [Vercel CD](docs/vercel-cd.md) |
