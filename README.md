<p align="center">
  <img src="public/brand/logo_sqrtfund.png" alt="Logo SqrtFund" width="480" />
</p>

<h1 align="center">SqrtFund</h1>

<p align="center">Nền tảng tài trợ cộng đồng cho câu lạc bộ và dự án sinh viên, ứng dụng Quadratic Funding trên Avalanche.</p>

<p align="center">
  <a href="https://www.sqrtfund.tech/">Website</a> ·
  <a href="https://www.canva.com/design/DAHYhkwRwHU/_L6w-_FjVNtWDEsDq29LGw/edit">Slide giới thiệu</a> ·
  <a href="#cài-đặt-và-chạy-local">Chạy local</a> ·
  <a href="#tài-liệu-liên-quan">Tài liệu kỹ thuật</a>
</p>

**SqrtFund** giúp sinh viên gây quỹ cho ý tưởng của mình và giúp nhà tổ chức phân bổ nguồn tài trợ theo sự ủng hộ của cộng đồng. Nhà tổ chức chuẩn bị **quỹ đối ứng**; sinh viên đóng góp cho các dự án quan tâm; hợp đồng thông minh tính khoản tài trợ bổ sung bằng **Quadratic Funding (QF)**.

Với cùng tổng tiền đóng góp, dự án được nhiều người ủng hộ có thể nhận mức đối ứng cao hơn dự án chỉ nhận vài khoản góp lớn. Các khoản đóng góp và kết quả phân bổ được ghi nhận trên blockchain để người tham gia đối chiếu.

| Thông tin | Chi tiết |
| --- | --- |
| Nhóm phát triển | **43xTSD** |
| Chủ đề | Topic 6 — Avalanche Hackathon (Team1 Vietnam) |
| Mạng | Avalanche Fuji C-Chain — chain ID `43113` |
| Token thử nghiệm | MockUSDC — 6 chữ số thập phân |
| Giao diện | Tiếng Việt và tiếng Anh |

> Đây là phiên bản thử nghiệm sử dụng Fuji và MockUSDC. Hợp đồng chưa được kiểm toán bảo mật độc lập. README mô tả chức năng trong mã nguồn; trạng thái triển khai website và database cần được xác nhận riêng.

## Vấn đề và cách giải quyết

Nhiều nhóm sinh viên có ý tưởng nhưng thiếu kinh phí để triển khai. Nếu chỉ xét tổng tiền gây quỹ, sự quan tâm của nhiều người đóng góp nhỏ có thể bị lấn át bởi vài khoản góp lớn. Người tham gia cũng cần biết dự án được duyệt theo tiêu chí nào, kinh phí được chia ra sao và nhóm đã sử dụng tiền như thế nào.

SqrtFund tổ chức hoạt động này theo từng **vòng tài trợ — round**, với ngân sách, thời gian và giới hạn đóng góp rõ ràng. Nền tảng kết hợp cơ chế QF, quy định xét duyệt công khai, danh mục dự án và hồ sơ cập nhật kết quả.

## Chức năng chính

| Nhóm chức năng | Nội dung |
| --- | --- |
| Danh tính và phân quyền | Xác minh email trường bằng OTP, chứng minh quyền sở hữu ví, ghi danh Student qua attestation EIP-712; đăng ký và xét duyệt Organizer |
| Vòng tài trợ | Nạp quỹ trước vào Factory, tạo contract riêng cho từng round, công bố tiêu chí và lĩnh vực được tham gia |
| Đăng ký và xét duyệt | Nộp dự án, chọn lĩnh vực chính, duyệt hoặc từ chối kèm tiêu chí và lời giải thích gắn với giao dịch xác nhận |
| Hồ sơ dự án | Mục tiêu, người hưởng lợi, điểm khác biệt, sản phẩm mẫu, ngân sách, kế hoạch chi và mốc đo kết quả; báo cáo sau khi nhận tiền |
| Đóng góp và phân bổ | Góp đơn lẻ hoặc theo lô, cộng dồn theo ví/dự án, xem matching dự kiến, chốt kết quả và claim |
| Theo dõi và hoàn tiền | Bảng xếp hạng, bộ lọc lĩnh vực, Dashboard, thông báo, nhắc claim; hủy round và yêu cầu hoàn token |

Nút **“Quan tâm tài trợ”** hỗ trợ soạn/sao chép lời nhắn và mở kênh liên hệ của nhóm. Chức năng này chưa lưu danh sách người quan tâm, tự gửi tin nhắn hay thực hiện giao dịch tài trợ.

## Vai trò người dùng

| Vai trò | Trách nhiệm | Nguồn xác định quyền |
| --- | --- | --- |
| **Admin** | Xét duyệt đơn, cấp/thu hồi quyền Organizer; có thể tạo round | `RoundFactory.owner()` |
| **Organizer** | Nạp quỹ, tạo round, công bố tiêu chí, duyệt dự án và quản lý round của mình | Quyền trên Factory và `QFRound.admin()` |
| **Student** | Xác minh, đăng ký dự án, đóng góp cho dự án khác; chủ dự án nhận kinh phí và cập nhật kết quả | `StudentRegistry.isStudent(wallet)` và quyền sở hữu dự án |

**Chủ dự án** là Student sở hữu dự án. **Admin của round** là ví đã tạo round đó. Admin nền tảng và Organizer không tự có quyền quản lý round của ví khác. Việc đổi hồ sơ hiển thị trên giao diện không cấp thêm quyền blockchain.

## Quy trình tài trợ

1. **Chuẩn bị ví:** kết nối ví EVM với Fuji, có AVAX testnet trả gas và MockUSDC để thử nghiệm.
2. **Đăng ký Organizer:** xác thực email liên hệ và gửi đơn. Admin cấp quyền bằng giao dịch, rồi ký lưu quyết định xét duyệt.
3. **Tạo round:** Organizer/Admin approve token nếu cần, gọi `depositInitialPool`, đợi xác nhận và gọi `createFundedRound`. Quỹ được chuyển vào round mới trong cùng giao dịch tạo round.
4. **Công bố tiêu chí:** trước khi có dự án đầu tiên, người tạo round chọn lĩnh vực, nhập điều kiện và ký công bố. Nội dung đã lưu không thể chỉnh sửa.
5. **Nộp dự án:** Student xác thực tại `/verify`, hoàn tất ghi danh on-chain, đọc quy định tại `/rules` và chọn round tại `/register`. Sau giao dịch đăng ký, chủ dự án ký thêm để lưu lĩnh vực chính.
6. **Xét duyệt:** người tạo round chọn tiêu chí liên quan và nhập lý do, gửi giao dịch duyệt/từ chối, sau đó ký lưu lời giải thích. Dự án được duyệt có thể bổ sung hồ sơ chi tiết.
7. **Đóng góp:** trong thời gian nhận góp, Student đóng góp cho dự án đã duyệt của người khác bằng `donate` hoặc `donateMany`.
8. **Chốt và nhận tiền:** sau `endTime`, người tạo round có quyền finalize độc quyền trong 24 giờ đầu; sau đó bất kỳ ví nào cũng có thể finalize. Chủ dự án chủ động gọi `claim` và có thể đăng báo cáo sử dụng kinh phí sau khi giao dịch nhận tiền được xác nhận.

Nếu lưu lĩnh vực hoặc lý do xét duyệt thất bại sau giao dịch, trạng thái blockchain vẫn giữ nguyên. Giao diện cho phép bổ sung bản ghi từ chi tiết dự án; không cần gửi lại giao dịch đăng ký hoặc xét duyệt.

### Quy định xét duyệt

Trang `/rules` trình bày điều kiện tham gia, tiêu chí chung và các việc nên/không được làm. Các tiêu chí chung gồm: phù hợp chủ đề và đối tượng, lợi ích cộng đồng, kế hoạch khả thi, ngân sách rõ ràng, thông tin trung thực và quyền sử dụng nội dung.

Organizer bổ sung điều kiện riêng cho round và ký công bố một lần. Lý do duyệt/từ chối được lưu kèm các tiêu chí liên quan và hash giao dịch đã được API kiểm chứng. Dữ liệu cũ chưa có lời giải thích hoặc tiêu chí không được tự điền nội dung giả.

**Từ chối on-chain là quyết định cuối cùng cho mã dự án đó:** không thể duyệt lại và vẫn tính vào giới hạn đăng ký. Hiện chưa có luồng yêu cầu bổ sung hồ sơ hoặc quy trình khiếu nại chính thức.

### Danh mục dự án và phạm vi round

| Lĩnh vực | Ví dụ và minh chứng phù hợp |
| --- | --- |
| **Công nghệ và nghiên cứu** | Phần mềm, robot, nghiên cứu ứng dụng; thiết kế/sản phẩm mẫu và mốc thử nghiệm |
| **Giáo dục và học thuật** | Workshop, tài liệu học tập; đối tượng học và kết quả học tập dự kiến |
| **Cộng đồng và thiện nguyện** | Tình nguyện, hỗ trợ hoàn cảnh khó khăn; người hưởng lợi, chi phí và minh chứng hỗ trợ |
| **Môi trường và phát triển bền vững** | Tái chế, giảm rác, tiết kiệm năng lượng; kết quả đo lường và cách theo dõi |
| **Văn hóa và nghệ thuật** | Triển lãm, âm nhạc, bảo tồn văn hóa; sản phẩm/sự kiện, công chúng và quyền nội dung |

Mỗi dự án có một lĩnh vực chính do chủ ví ký công bố, không sửa sau khi lưu. Dự án chưa có bản ghi hiển thị **“Chưa phân loại”**. Bộ lọc áp dụng cho danh sách và nhóm dự án nổi bật, không thay đổi matching hoặc hạng theo người ủng hộ.

Round có thể nhận một lĩnh vực hoặc nhiều lĩnh vực. **Các lĩnh vực trong cùng round dùng chung quỹ đối ứng**; muốn có ngân sách độc lập phải tạo round riêng. Policy cũ chưa đặt danh mục được hiểu là không hạn chế trong năm lĩnh vực trên.

### Mốc khuyến nghị claim

SqrtFund khuyến nghị nhận kinh phí trong **30 ngày sau thời điểm finalize thực tế**. Dashboard và phần claim hiển thị ngày/giờ GMT+7 cùng thời gian còn lại. Thông báo trong ứng dụng nhắc khi còn tối đa **7, 3, 1 ngày** và khi đã quá hạn.

Dự án quá hạn chưa claim, có khoản nhận đã xác nhận lớn hơn 0, được gắn nhãn quá hạn, bỏ khỏi phần nổi bật và đưa cuối danh sách mặc định. Hạng theo người ủng hộ và kết quả tài chính vẫn giữ nguyên; khi claim thành công, hiển thị trở lại bình thường. Các lựa chọn sắp xếp theo số tiền vẫn giữ đúng thứ tự số tiền.

**Đây là mốc khuyến nghị, không phải hạn khóa claim.** Chủ dự án vẫn có thể claim muộn; tiền không bị tự thu hồi hoặc chuyển cho Organizer. Thông báo được tính khi ứng dụng đọc trạng thái, chưa có nhắc qua email/push.

Thời điểm finalize được xác minh từ trạng thái lịch sử, sự kiện `Finalized` và timestamp của block. RPC cần hỗ trợ đọc lịch sử contract, bytecode, block và event logs. Nếu chưa xác minh được thời gian, giao diện báo thiếu dữ liệu và không áp dụng hạ vị trí.

### Giới hạn trên contract

- Tối đa **50 dự án/round** và **2 dự án/ví/round**, bao gồm dự án bị từ chối.
- Được đăng ký/duyệt trước giờ mở góp, nhưng phải trước khi round kết thúc và chưa chốt/hủy.
- Chỉ đóng góp khi `startTime <= thời gian hiện tại < endTime`; chủ dự án không được tự góp.
- `minDonation`, `maxDonation`, `maxPerRound` giới hạn khoản góp tối thiểu, tổng góp theo dự án và tổng góp của một ví trong round.
- Người tạo round có thể hủy trước finalize; người góp chủ động gọi `refund`/`refundMany` để nhận lại token đã góp. Phí gas không được hoàn.
- Thu hồi quyền Organizer chặn tạo round mới, không đổi admin của round đã tạo hoặc quyền rút số dư nạp trước chưa dùng của chính ví đó.

## Quadratic Funding hoạt động thế nào?

Với dự án $j$, gọi $d_{i,j}$ là **tổng** tiền người $i$ đã góp cho dự án đó. Nhu cầu đối ứng thô là:

$$
M_j = \left(\sum_i \sqrt{d_{i,j}}\right)^2 - \sum_i d_{i,j}
$$

Hai dự án cùng nhận **100 USDC** có thể có nhu cầu đối ứng khác nhau:

| Cách đóng góp | Tiền góp trực tiếp | Nhu cầu đối ứng thô |
| --- | ---: | ---: |
| 100 người × 1 USDC | 100 USDC | 9.900 USDC |
| 20 người × 5 USDC | 100 USDC | 1.900 USDC |

Đây là minh họa công thức, **không phải khoản tài trợ được bảo đảm**. Contract tính kết quả cuối cùng theo thứ tự:

1. Tính nhu cầu thô cho các dự án đã duyệt.
2. Nếu tổng nhu cầu vượt ngân sách, giảm theo tỷ lệ; nếu quỹ đủ, giữ nhu cầu thô.
3. Áp dụng trần đối ứng `maxMatchBps` cho từng dự án. Trần không giới hạn tiền góp trực tiếp.
4. Giữ phần dư do trần hoặc làm tròn, không phân phối lại. Admin của round có thể rút phần dư sau finalize.

Chủ dự án nhận **tiền góp trực tiếp + khoản đối ứng cuối cùng**. Một ví góp nhiều lần vẫn tính là một người ủng hộ; công thức lấy căn của tổng đã góp cho dự án đó. Xem [`QFRound.sol`](contracts/src/QFRound.sol) và [`qf.ts`](src/lib/qf.ts).

## Kiến trúc và nguồn dữ liệu

| Thành phần | Công nghệ | Trách nhiệm |
| --- | --- | --- |
| Giao diện | Next.js App Router, React, TypeScript, Tailwind CSS | Khám phá dự án, quản lý round, đăng ký, Dashboard và giao diện Việt/Anh |
| Kết nối ví | wagmi, viem | Đọc contract, ký thông điệp và gửi giao dịch |
| Truy vấn và trạng thái | TanStack Query, Axios, Zustand | Cache, API và phản chiếu trạng thái đã xác nhận |
| Smart contract | Solidity, OpenZeppelin, Foundry | Quyền Student/Organizer, quỹ, đóng góp, matching, claim và refund |
| Backend và database | Next.js API, Supabase/PostgreSQL | OTP, liên kết email–ví, đơn Organizer, hồ sơ/báo cáo dự án, tiêu chí, lý do xét duyệt và danh mục |
| Email và hình ảnh | SMTP/Resend, Cloudinary | Gửi OTP; upload ảnh có chữ ký và quota |
| Thông báo và chốt vòng | Socket.IO, Node.js keeper/GitHub Actions | Báo thay đổi để đọc lại dữ liệu; finalize sau thời gian ân hạn khi được cấu hình |

**On-chain:** dữ liệu đăng ký dự án cơ bản, round, khoản góp, trạng thái duyệt, matching đã chốt, claim và refund. **Database:** thông tin xác minh, hồ sơ bổ sung, báo cáo, lĩnh vực, tiêu chí và lời giải thích có chữ ký. Cache và thông báo không thay thế kiểm tra quyền trên contract.

| Contract | Chức năng |
| --- | --- |
| [`StudentRegistry`](contracts/src/StudentRegistry.sol) | Ghi danh Student qua attestation EIP-712, liên kết hash email với ví |
| [`RoundFactory`](contracts/src/RoundFactory.sol) | Phân quyền Organizer, quản lý số dư nạp trước và tạo round |
| [`QFRound`](contracts/src/QFRound.sol) | Đăng ký/duyệt dự án, đóng góp, QF, finalize, claim, hủy và refund |
| [`PrefundedQFRound`](contracts/src/PrefundedQFRound.sol) | Kế thừa QFRound, nhận quỹ ban đầu từ Factory |
| [`MockUSDC`](contracts/src/MockUSDC.sol) | Token thử nghiệm có faucet |

## Cài đặt và chạy local

### Yêu cầu

- **Node.js 24** và phiên bản **pnpm** được ghim tại `packageManager` trong [`package.json`](package.json).
- **Foundry** nếu build/test/deploy contract.
- Supabase và dịch vụ email cho luồng xác minh; Cloudinary cho upload ảnh.
- Ví Fuji, AVAX testnet và MockUSDC để thử đầy đủ các giao dịch.

### 1. Cài dependencies

```bash
git clone --recurse-submodules https://github.com/hlbaot/SqrtFund.git
cd SqrtFund
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Nếu đã clone mà thiếu thư viện contract, chạy `git submodule update --init --recursive`. Nếu đã có `.env.local`, giữ cấu hình hiện tại và đối chiếu file mẫu thay vì ghi đè.

### 2. Cấu hình môi trường

Dùng [`.env.example`](.env.example) làm danh sách cấu hình đầy đủ:

| Nhóm | Biến chính |
| --- | --- |
| Mạng và địa chỉ | `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_RPC_URL_FALLBACK`, `NEXT_PUBLIC_EXPLORER_URL`, `NEXT_PUBLIC_FACTORY_ADDRESS`, `NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS`, `NEXT_PUBLIC_USDC_ADDRESS` |
| Supabase server | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Xác minh | `OTP_SECRET`, `ATTESTER_PRIVATE_KEY`, `ALLOWED_EMAIL_DOMAINS`, `BLOCKED_EMAIL_DOMAINS` |
| Email | `EMAIL_PROVIDER`, các biến `SMTP_*`; thêm `RESEND_API_KEY` khi dùng Resend |
| Cloudinary | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` hoặc `CLOUDINARY_URL` |
| Realtime — tùy chọn | `NEXT_PUBLIC_SOCKET_URL`, `SOCKET_SERVER_URL`, `SOCKET_PUBLISH_SECRET`, `SOCKET_ALLOWED_ORIGINS`, `SOCKET_PORT` |
| Keeper — tùy chọn | `KEEPER_PRIVATE_KEY`, `KEEPER_RPC_URL`, các biến `KEEPER_*` trong file mẫu |

`CLOUDINARY_URL` dùng dạng `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`; các biến riêng được ưu tiên khi có. Upload hiện dùng chữ ký phía server, không dựa vào unsigned preset cũ.

Chỉ `NEXT_PUBLIC_*` được đưa vào trình duyệt và nhúng lúc build. Không đặt khóa ký, khóa Supabase, mật khẩu email hoặc Cloudinary secret trong biến public hay commit file chứa giá trị thật. RPC public không được chứa thông tin đăng nhập bí mật.

Khi `ALLOWED_EMAIL_DOMAINS` để trống, chính sách MVP nhận hậu tố `.edu`/`.edu.vn`. Khi có danh sách cho phép, cần khớp chính xác tên miền, kể cả tên miền con; danh sách chặn được ưu tiên. Xem [chính sách email](docs/student-domain-policy.md).

### 3. Khởi tạo database

Chạy các file trong [`supabase/migrations/`](supabase/migrations/) theo thứ tự **0001 → 0012** trên Supabase của môi trường đích.

| Migration | Phạm vi |
| --- | --- |
| `0001`–`0009` | Xác minh, Organizer, liên kết danh tính, OTP, quota upload và xét duyệt Organizer |
| [`0010_project_profiles.sql`](supabase/migrations/0010_project_profiles.sql) | Hồ sơ dự án và lịch sử báo cáo |
| [`0011_round_governance.sql`](supabase/migrations/0011_round_governance.sql) | Tiêu chí round và lý do xét duyệt |
| [`0012_project_categories.sql`](supabase/migrations/0012_project_categories.sql) | Danh mục dự án có chữ ký |

Thiếu cấu hình hoặc migration khiến API liên quan báo lỗi; hệ thống không tự chuyển sang lưu bản ghi trong bộ nhớ. Các SQL fixture trong `supabase/tests/` chỉ dành cho database kiểm thử cô lập, không chạy trên production.

Mốc khuyến nghị claim không cần migration hoặc secret mới, nhưng cần RPC đọc được dữ liệu lịch sử.

### 4. Chạy ứng dụng

```bash
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000). Next.js có thể chọn cổng khác nếu cổng này đang được dùng. Lệnh kiểm tra Factory chỉ đọc:

```bash
pnpm check:factory
```

Nếu cần dịch vụ tùy chọn, cấu hình biến tương ứng rồi chạy `pnpm realtime` hoặc `pnpm keeper` ở terminal riêng. Keeper dùng ví Fuji riêng có AVAX trả gas. Xem hướng dẫn [realtime](docs/realtime-notifications.md) và [keeper](docs/finalize-keeper.md).

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

Integration test cần RPC/Supabase riêng phải được bật theo cấu hình từng bộ test. Dùng database và khóa kiểm thử riêng. Các báo cáo kiểm chứng trong `docs/` mô tả phạm vi tại thời điểm kiểm tra, không thay thế việc chạy lại các lệnh trên cho phiên bản muốn triển khai.

### Contract Fuji

Các địa chỉ sau lấy từ [`contracts/deployments/fuji.json`](contracts/deployments/fuji.json):

| Contract | Địa chỉ |
| --- | --- |
| StudentRegistry | [`0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e`](https://testnet.snowtrace.io/address/0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e) |
| RoundFactory | [`0xB2A91fd342d4C81061A97C42A789253d2252D85E`](https://testnet.snowtrace.io/address/0xB2A91fd342d4C81061A97C42A789253d2252D85E) |
| MockUSDC | [`0xFf56491e29085043DbB11cd01D54cC1449A3d686`](https://testnet.snowtrace.io/address/0xFf56491e29085043DbB11cd01D54cC1449A3d686) |

Mỗi round có địa chỉ riêng do Factory tạo. Khi tự triển khai contract, đối chiếu receipt và cấu hình trước khi cập nhật địa chỉ. Thay ABI không nâng cấp contract đã triển khai; thay `NEXT_PUBLIC_*` cần build lại frontend.

Workflow [CI/CD](.github/workflows/ci.yml) kiểm tra ứng dụng, contract và SQL fixture. Deploy Vercel chỉ chạy trên `main` sau khi các nhóm kiểm tra đạt. Workflow không tự triển khai contract hoặc áp dụng migration vào database production; cần chuẩn bị schema môi trường đích trước khi deploy ứng dụng phụ thuộc schema mới.

## Giới hạn hiện tại

- **Danh tính:** OTP chứng minh quyền truy cập email, chưa bảo đảm đang theo học hoặc mỗi người chỉ có một danh tính. Backend giữ khóa attester; cơ chế hiện tại chưa phải ZK-Email.
- **Chống thông đồng:** ràng buộc email–ví, hạn mức và xét duyệt giúp giảm lạm dụng nhưng chưa loại bỏ phối hợp đóng góp để tác động QF.
- **Quy định ngoài chain:** tiêu chí, danh mục và yêu cầu lời giải thích được thực thi ở ứng dụng/API. Contract hiện không bắt buộc có các bản ghi này khi người dùng gửi giao dịch trực tiếp.
- **Hai nguồn dữ liệu:** giao dịch blockchain và lưu database không nguyên tử. Lỗi lưu hồ sơ không hoàn tác giao dịch đã thành công; cần đối chiếu trạng thái và dùng luồng bổ sung bản ghi.
- **Tài trợ:** quỹ đối ứng được nạp qua Organizer/Admin; chưa có luồng nạp quỹ công khai cho mọi nhà tài trợ. Claim quá hạn không tạo quyền thu hồi tiền cho Organizer.
- **Nội dung và quyền riêng tư:** hồ sơ, báo cáo và lý do là nội dung tự công bố, không được bên thứ ba chứng thực. Chỉ đăng thông tin có quyền công khai. Hash email trên chain không đồng nghĩa với ẩn danh hoàn toàn.
- **Vận hành:** nhắc claim phụ thuộc nguồn thời gian đã xác minh và trạng thái đọc lại trong ứng dụng. Cần kiểm toán độc lập và đánh giá vận hành trước khi cân nhắc sử dụng tài sản thật.

## Hướng phát triển

- Thử nghiệm vòng tài trợ nhỏ với câu lạc bộ, nhà trường và nhà tài trợ.
- Nghiên cứu xác minh giảm phụ thuộc backend và biện pháp hạn chế thông đồng.
- Bổ sung luồng yêu cầu chỉnh sửa hồ sơ, làm rõ phản hồi và khiếu nại.
- Mở rộng sự tham gia của nhà tài trợ và đánh giá cách xử lý quỹ dư.
- Kiểm toán bảo mật và kiểm chứng trải nghiệm ví thật trước khi mở rộng triển khai.

## Cấu trúc mã nguồn

```text
SqrtFund/
├── contracts/             # Solidity, Foundry, script và địa chỉ triển khai
├── src/
│   ├── app/               # Trang Next.js và API
│   ├── components/        # Giao diện dự án, round, quy định và quản trị
│   ├── hooks/             # Truy vấn, ví, thông báo và thao tác contract
│   ├── lib/               # QF, xác thực, danh mục, claim timing và store
│   └── views/             # Các màn hình chính
├── public/brand/          # Logo và nhận diện
├── realtime/              # Socket.IO và worker sự kiện blockchain
├── scripts/               # Kiểm tra cấu hình, keeper và công cụ hỗ trợ
├── supabase/
│   ├── migrations/        # Schema và quyền database
│   └── tests/             # SQL fixture cho môi trường kiểm thử
├── __tests__/             # Test ứng dụng/API bằng Vitest
├── docs/                  # Hướng dẫn và báo cáo kỹ thuật
└── .env.example           # Mẫu cấu hình
```

## Tài liệu liên quan

- [Điểm nổi bật dự án và liên hệ tài trợ](docs/project-highlights.md)
- [Quy định, tiêu chí round và lời giải thích xét duyệt](docs/round-governance.md)
- [Danh mục dự án và round](docs/project-categories.md)
- [Mốc khuyến nghị nhận kinh phí](docs/claim-recommendation.md)
- [Hành trình dự án, hồ sơ và báo cáo](docs/project-journey-2026-10-28.md)
- [Cơ chế chốt và phân bổ matching](docs/matching-settlement.md)
- [Cấp quyền Admin và Organizer](docs/platform-admin-access.md)
- [Triển khai và CI/CD](docs/vercel-cd.md)
