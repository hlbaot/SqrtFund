# Hiệu năng và SEO — kiểm tra local ngày 18/10/2026

Không deploy, không thay contract/ABI/QF/payout, không đọc/in/sửa giá trị bí mật hay file `.env.local`. Build Next.js vẫn tự nạp cấu hình môi trường theo cơ chế của framework. Không gửi giao dịch hoặc OTP thật.

## Cách đo và giới hạn

- Build production bằng `ANALYZE_BUNDLE=1 pnpm build`. Plugin webpack tạo `.next/analysis/client-stats.json` tương đương phân tích bundle, không ghi source hoặc giá trị môi trường.
- Next.js 16.4.0 đang dùng không in bảng First Load JS theo route trong output build. `scripts/measure-routes.mjs` lấy danh sách script từ HTML route production, loại script `nomodule`, đo số byte file thật và gzip từng file. Đây là **JS trong HTML ban đầu**, không phải toàn bộ JS tải sau hydration; không phải số byte Brotli thực tế trên Vercel.
- Lighthouse 13.5.0: mobile mặc định, production `http://127.0.0.1:3100`, Chrome headless, hồ sơ mới cho từng route, không kết nối ví. Mỗi route có một lượt baseline và một lượt kiểm tra cuối. Số đo có dao động; không phải thử nghiệm thống kê hoặc kết quả Vercel.
- Route `/round/[id]` dùng fixture `0x1111111111111111111111111111111111111111`, hợp lệ cú pháp nhưng không được xác nhận là một round đã deploy. Kết quả của route này chỉ phản ánh vỏ trang/trạng thái đọc lỗi, không chứng minh hiệu năng một leaderboard đã tải đầy đủ.
- `/admin` của khách có thể chuyển hướng về trang chủ theo guard có sẵn. Lighthouse không đánh giá dashboard của admin đã đăng nhập. `/my` và `/register` cũng được đo ở trạng thái khách.
- Đếm JSON-RPC qua `Network.requestWillBeSent` trong log Chrome, phân biệt **gói HTTP**, **method JSON-RPC** và **eth_call**. Số này bao gồm request đã phát ra, retry/poll trong thời gian audit; không bảo đảm mọi RPC trả dữ liệu thành công, không phải cửa sổ đo dài cố định.
- LCP/CLS/TBT là số đo điều hướng tải mới. **Chưa đo INP hay thời gian chuyển trang ấm của ví thật**. Thanh phản hồi điều hướng và cache được kiểm tra bằng code/test; không gọi đó là số đo INP.
- Chỉ đưa bản tổng hợp không có URL RPC/cấu hình môi trường vào evidence; trace/HTML/network log thô ở `/tmp/sqrt-performance` không được đưa vào Git.

## Chẩn đoán trước khi sửa

| Nguyên nhân | Bằng chứng | Ảnh hưởng ước tính trước khi thử | Công sức |
| --- | --- | --- | --- |
| Splash khóa và che toàn bộ trang 3 giây | Baseline `SplashIntro.tsx:19`, CSS `html.splash-active #app-content` đặt `visibility:hidden`, khóa cuộn | Nội dung trang bị chặn ở lần truy cập đầu | Nhỏ |
| Import AeroShards/vgpu trực tiếp | Baseline `views/home.tsx:29`, `AeroShards.tsx:4`; trang chủ 452,8 KiB gzip | Thêm tải/parse/chạy mã trang trí ngay khi vào trang | Vừa |
| Cache tươi mặc định chỉ 5 giây | Baseline `app/providers.tsx`, nhiều hook dùng chung QueryClient | Trở lại route sau 5 giây có thể đọc lại | Nhỏ |
| Căn đồng hồ lặp trong `useClaim` | Baseline `useClaim.ts:92`: mỗi instance gọi `getBlock`, kể cả khách | Navbar/menu ví/trang cá nhân cùng đọc block | Nhỏ |
| Danh sách round tạo nhóm đọc cho từng round | `views/rounds.tsx:17`, `useRound.ts:14`, `useProjects.ts:47` | Số đọc logic tăng theo số round; có các bước phải đợi địa chỉ/probe | Vừa |
| Không có route loading hoặc robots/sitemap | Baseline cây `src/app` và bảng build | Ít phản hồi trong lúc chờ route; thiếu chỉ dẫn crawler | Nhỏ |

Thống kê webpack nhận diện AeroShards khoảng 109 KB source, vgpu khoảng 390 KB source, AOS khoảng 41 KB source; wagmi/viem/ox và framework cũng hiện trong graph. Đây là kích thước module source trước tối ưu, có thể gồm module orphan/graph của compiler, **không được cộng để suy ra kích thước gzip tải bởi một route**. Không tìm thấy nodemailer hay Supabase trong client stats; các module email/database vẫn có `server-only`. Không có three/d3 được import trong app. Lucide đang dùng named imports và Next.js đã có tối ưu barrel cho `lucide-react`; không đổi sang đường dẫn nội bộ không được hỗ trợ.

## Các lệnh đọc và điểm chờ theo trang

Các hook cùng key được React Query chia sẻ; không cộng số lần gọi hook thành số HTTP request.

| Nhóm | Đọc thực tế | Thứ tự/gộp |
| --- | --- | --- |
| Factory | `getRounds`, `owner` | Một `useReadContracts`/multicall, poll 15 giây (`useRound.ts:14`) |
| Round | `studentRegistry` để nhận diện phiên bản; sau đó `admin`, `token`, `startTime`, `endTime`, `minDonation`, `maxDonation`, `maxMatchBps`, `pool`, `finalized`, `leftover`, `leftoverWithdrawn`, `projectCount`; round mới thêm `name`, `organizer`, `maxPerRound`, `isCancelled`, `cancelledPoolWithdrawn` | Probe trước, fields sau bằng multicall; capability được nhớ theo địa chỉ. Round cũ bỏ trường không hỗ trợ (`roundReads.ts:36`) |
| Dự án | `rejected(0)` để chọn tuple ABI; `getProjects(0,50)`, `previewMatching` | Probe trước rồi hai getter trong một multicall. Nhánh round và nhánh dự án có thể chạy song song sau khi biết địa chỉ (`useProjects.ts:47`) |
| Ví Fuji đã kết nối | `isStudent`, USDC `balanceOf`, AVAX `eth_getBalance`; `lastFaucetMint`, `FAUCET_COOLDOWN`, `lifetimeMinted`, `FAUCET_AMOUNT`, `LIFETIME_CAP`; block để căn đồng hồ | Faucet gom 5 getter; balance có key riêng cho ví/token/chain. Căn đồng hồ trước đây gọi trực tiếp nhiều lần, nay dùng một query chung |

| Route | Đọc bổ sung/đọc cần thiết | Chặn gì, phần client/hiệu ứng |
| --- | --- | --- |
| `/` | Factory + round mới nhất + dự án; `eth_blockNumber` từ NetworkStats; REST `/api/verify/stats` | Hero có thể SSR không đợi RPC; phần round/dự án có skeleton. AeroShards, lattice, constellation, timeline, bộ đếm, AOS là client. Splash/AOS từng che nội dung |
| `/rounds` | Factory rồi các nhóm round + dự án cho từng địa chỉ | Các RoundData chạy song song, không await lần lượt từng round; view hiển thị dữ liệu những round đã xong. Không thể bỏ getter dự án vì đang dùng để tính số dự án/supporter/direct donation |
| `/round` | Cùng RoundsView với `/rounds` | Cùng cache/getter; là route overview, không redirect thêm |
| `/round/[id]` | Round/dự án được chọn; fields của các round cho dropdown phase; dữ liệu navbar mặc định dùng chung nếu trùng | Header/leaderboard chờ dữ liệu và có skeleton. Trước sửa role/navbar còn đọc dự án round mới nhất dù khách đang xem round khác |
| `/my` | Nhóm chung; `donationOf(wallet, projectId)` cho các dự án public, gom multicall; faucet/claim có sẵn | Ví chưa kết nối thấy lời nhắc; dữ liệu ví có loading riêng. AOS, avatar dialog, verification UI; query đồng hồ trước đây lặp thêm tại đây |
| `/admin` | Nhóm chung; `admin`, `name` cho danh sách round nạp pool; token `owner`; số dư ví/recipient cùng hook | Guard/loading trước dashboard. Các modal và transaction chỉ được mở/gửi khi người dùng thao tác. Không đổi quyền/điều kiện moderation |
| `/register` | Nhóm chung, `isStudent`; ProjectForm chỉ hiện khi đã là Student | Gate chờ status sinh viên; AOS, form client. Khách không còn đọc dự án chỉ để tính role/notification |
| `/verify` | Nhóm chung, `isStudent`; người có ví mới tải verification UI và GET chính sách domain `/api/verify/request-otp` | OTP/attestation/transaction là thao tác sau click, không phải RPC tự chạy khi điều hướng. Khách không còn đọc dự án phục vụ role |

Round bị hủy có thêm `MAX_PROJECTS` và các `donationOf` cho hoàn tiền, chỉ khi ví/round đủ điều kiện; query được gộp và phân biệt các project. Các lệnh `balanceOf`/`allowance` trước donate/deposit, receipt polling và write contract sau click không được tính vào tải route và không thay trình tự nghiệp vụ. Hook lịch sử donation còn có trong thư viện nhưng không được tự bật để quét log ở đường render đang đo.

Với một round hiện đại, cache lạnh, nhóm factory/round/dự án tương ứng 2 + (1 + 17) + 3 = **23 getter logic**, không phải 23 HTTP request. Danh sách N round là khoảng `2 + 21N` getter logic trước khi tính ví, legacy, chunking và retry. Factory phải xong trước khi biết địa chỉ; probes phải xong trước khi chọn ABI/getter. HTTP batching đã có trước sửa, nên không tuyên bố biến tất cả nhóm phụ thuộc này thành một HTTP request.

## Thay đổi đã làm

- Menu chính dùng `next/link` có `prefetch`; có `loading.tsx` cho route chính. Thanh progress bắt click link nội bộ trước `next/link` xử lý, dừng khi pathname/query đổi, có timeout khi điều hướng thất bại. Dropdown round báo progress trước `router.push`; các CTA/router đang có vẫn là điều hướng client. Hard reload trong logout được giữ để không đổi quy trình kết thúc phiên.
- Baseline không cấu hình gcTime, dùng mặc định client 5 phút của TanStack Query (source `removable.ts` trong phiên bản cài đặt). Query mặc định sau sửa: tươi 15 giây, giữ cache 30 phút, retry 2 lần/backoff tối đa 3 giây. Round/factory/project dùng cùng chính sách. Metadata admin/name của danh sách round dùng stale 5 phút, không poll lại địa chỉ bất biến 15 giây một lần. Query key đổi khi danh sách địa chỉ đổi.
- Giữ HTTP batch cũ: chờ 20 ms, 10 JSON-RPC/gói, timeout 10 giây, retry 2; fallback đọc từ `NEXT_PUBLIC_RPC_URL_FALLBACK` **đã có trước sửa**. Cấu hình rõ multicall client: chờ 20 ms, ngân sách calldata 8192 byte thay vì mặc định 1024.
- Test transport thật với fetch mock: 50 getter hai đối số địa chỉ giảm từ **4 eth_call trong 1 gói HTTP → 1 eth_call trong 1 gói HTTP**, cùng trả đủ 50 kết quả. Đây là test cấu hình, không phải benchmark ví thật trên Fuji.
- Query căn đồng hồ chung theo chain, cache 30 giây, chỉ chạy khi ví có countdown cần dùng. Role/notification của khách không chủ động nạp project query. Cache theo exact key, không dùng placeholder của ví/round trước để hiển thị số dư/quyền của ví/round mới. Các invalidation/refetch sau giao dịch giữ nguyên.
- AeroShards/lattice, avatar picker và verification UI tải lười. WebGPU chỉ bật desktop >=1024px không giảm chuyển động/Save-Data; mobile giữ nền CSS. AOS import động và nội dung luôn nhìn thấy nếu script chưa sẵn hoặc lỗi. Chế độ giảm chuyển động không chạy AOS/WebGPU; lattice giữ SVG tĩnh theo logic sẵn có.
- Splash chỉ chạy lần đầu phiên như cũ, nay là thông báo góc không khóa scroll/che nội dung, bỏ chờ 3 giây của trang. Sửa kích thước logo theo PNG 182×126 để tránh đổi tỷ lệ khi ảnh decode. Dành chỗ thanh thông báo round trước RPC, giữ chiều cao trang chi tiết khi đổi skeleton/error.
- Wrapper page không có state chuyển sang Server Component để xuất metadata. View cần wagmi/state vẫn ở client; cookie locale khiến HTML các route chính vẫn dynamic, không khẳng định đã chuyển toàn bộ dApp thành static.
- Gỡ dependency không được import: `@base-ui/react`, `class-variance-authority`, `shadcn`, `tw-animate-css`, `sass` (199 package bị gỡ khỏi cây cài đặt). Không quy mọi giảm JS cho việc này vì chúng vốn không xuất hiện trong chunk tải ban đầu.
- Font đã dùng `next/font` với `display: swap`, tiếp tục giữ. Logo dùng `next/image`; avatar SVG data URI do app tự cung cấp giữ `<img>` có width/height. Không bật remote image host tùy ý.

## SEO

- Base URL từ `NEXT_PUBLIC_SITE_URL`, mặc định `https://sqrt-fund.vercel.app`. Chuẩn hóa thành origin và không chấp nhận credential trong URL.
- `robots.txt`: cho phép `/`, `/rounds`, `/verify`; chặn `/api/`, `/admin`, `/my`, `/register`, `/dev/`; trỏ sitemap cùng origin.
- Sitemap chỉ có `/`, `/rounds`, `/verify`, không đọc RPC hoặc liệt kê ví/URL riêng tư, không sinh thời gian lastModified giả.
- Metadata root có `metadataBase`, title template `%s | SqrtFund`; mỗi route có title/description/canonical riêng, tiếng Anh mặc định và tiếng Việt theo cookie, OG locale tương ứng, keywords nhẹ, Twitter `summary_large_image`.
- `/admin`, `/my`, `/register` có `noindex, nofollow`; `/api/:path*` thêm header `X-Robots-Tag: noindex, nofollow`; dev route cũng noindex.
- ImageResponse tạo OG/Twitter PNG 1200×630 bằng code, logo và tagline tiếng Việt. Đã xem ảnh thực tế. Icon sẵn có: `icon.png` 256×256, `apple-icon.png` 180×180. Không thêm manifest vì không cần cho phạm vi này.
- Kiểm tra HTML dưới user-agent preview bot, title/canonical/robots/OG/Twitter không trùng; cookie `sqrt-fund-locale=vi` cho `lang=vi` và metadata tiếng Việt. Không tạo hreflang giả cho URL không có route locale riêng.
- SEO của dApp chủ yếu giúp trang giới thiệu và ảnh xem trước khi chia sẻ link. Không bảo đảm Google index mọi dữ liệu on-chain/client, không cam kết thứ hạng Google.

Port dev 3000 không chạy ở lần curl đầu; robots/sitemap và head đã được kiểm tra trên **HTTP production localhost:3100**, không giả ghi là đã kiểm tra HTTPS localhost. Kết quả nằm trong thư mục evidence. Việc kiểm tra thêm dev 3000, nếu chạy, được ghi riêng bên dưới.

## Lệnh tái hiện

```sh
ANALYZE_BUNDLE=1 pnpm build
pnpm start -p 3100
# Chạy trong terminal khác:
node scripts/measure-routes.mjs http://127.0.0.1:3100 /tmp/sqrt-performance/check.json
node scripts/audit-routes.mjs check http://127.0.0.1:3100
node scripts/check-seo.mjs http://127.0.0.1:3100
curl -s http://127.0.0.1:3100/robots.txt
curl -s http://127.0.0.1:3100/sitemap.xml
```

Script audit dùng Lighthouse qua `pnpm dlx` và Chrome ở đường dẫn macOS phổ biến. Máy khác cần chỉnh `CHROME_PATH`/đường dẫn Chrome trong script. Gzip là số đo asset local, không tính là thời gian chuyển trang.

## Việc chủ dự án tự làm

1. Cài dependency theo lockfile mới; restart dev bằng `pnpm dev` nếu đang dùng checkout cũ.
2. Thêm `NEXT_PUBLIC_SITE_URL` trên Vercel theo domain canonical thực tế. Nếu domain chính là `https://www.sqrtfund.tech`, dùng giá trị đó; nếu tiếp tục dùng Vercel thì dùng `https://sqrt-fund.vercel.app`. Chưa có biến thì code dùng domain Vercel theo yêu cầu. Không sửa domain/DNS từ tác vụ này.
3. Có thể thêm `NEXT_PUBLIC_RPC_URL_FALLBACK` với endpoint công khai khác nếu cần; không bắt buộc.
4. Tự Redeploy Vercel, bỏ tick **Use existing Build Cache**. Không có deploy tự động trong tác vụ này.
5. Kiểm tra lại robots/sitemap/canonical/OG trên domain thật; chạy Lighthouse nhiều lượt và kiểm tra điều hướng với ví thật, INP bằng tương tác/field data. Dùng công cụ xem trước Facebook và kiểm tra chia sẻ Zalo, làm mới cache preview khi đổi ảnh/domain.

## Số đo cuối, kết quả kiểm tra và file

Phần này được điền từ bộ số đo cuối và output lệnh thực tế, không lấy kết quả tốt nhất của các lần thử trung gian.

### JS ban đầu và Lighthouse

| Route | JS gzip KiB trước → sau | LCP giây trước → sau | CLS trước → sau | TBT ms trước → sau | Điểm mobile trước → sau |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 452.8 → 383.6 | 5.37 → 4.37 | 0.0000 → 0.0000 | 30 → 78 | 78 → 85 |
| `/rounds` | 371.2 → 370.2 | 4.93 → 3.54 | 0.0000 → 0.0002 | 49 → 46 | 80 → 91 |
| `/round` | 371.2 → 370.2 | 4.93 → 2.26 | 0.0000 → 0.0005 | 43 → 57 | 81 → 99 |
| `/round/[id]` | 387.9 → 382.5 | 4.91 → 4.86 | 0.0000 → 0.0000 | 80 → 86 | 80 → 82 |
| `/my` | 385.1 → 378.5 | 4.87 → 4.08 | 0.0000 → 0.0000 | 18 → 87 | 80 → 86 |
| `/admin` | 389.0 → 383.4 | 5.59 → 5.18 | 0.0000 → 0.0000 | 42 → 84 | 77 → 80 |
| `/register` | 375.8 → 370.2 | 4.87 → 4.95 | 0.0000 → 0.0000 | 59 → 133 | 81 → 81 |
| `/verify` | 369.8 → 364.3 | 4.80 → 4.46 | 0.0000 → 0.0000 | 35 → 170 | 81 → 82 |

JS ban đầu giảm ở cả tám route trong cách đo trên. LCP không giảm ở `/register` trong lượt đo này; TBT tăng ở nhiều route, dù tất cả vẫn dưới 200 ms. Không khẳng định mọi trang hoặc INP đều cải thiện. Máy developer dùng chung và mỗi route chỉ một lượt; cần đo nhiều lần trên Vercel trước khi kết luận cho người dùng thật. CLS của `/rounds` và `/round` có thay đổi rất nhỏ, được giữ nguyên số thay vì ghi thành 0 tuyệt đối.

### JSON-RPC được Chrome ghi nhận

| Route | Gói HTTP trước → sau | Method JSON-RPC trước → sau | eth_call trước → sau |
| --- | ---: | ---: | ---: |
| `/` | 3 → 3 | 9 → 5 | 5 → 4 |
| `/rounds` | 3 → 3 | 8 → 4 | 5 → 4 |
| `/round` | 3 → 3 | 8 → 4 | 5 → 4 |
| `/round/[id]` | 3 → 3 | 10 → 4 | 7 → 4 |
| `/my` | 3 → 4 | 9 → 5 | 5 → 5 |
| `/admin` | 4 → 4 | 9 → 5 | 5 → 4 |
| `/register` | 3 → 3 | 8 → 3 | 5 → 3 |
| `/verify` | 3 → 3 | 10 → 3 | 5 → 3 |

Method RPC giảm không đồng nghĩa số gói HTTP giảm: JSON-RPC batching đã có từ baseline. `/my` còn tăng một gói trong thời gian audit; có thể khác thời điểm phát query/poll hoặc retry, không gán chắc chắn cho một nguyên nhân khi chưa đo cửa sổ thời gian cố định. Số phía trên là quan sát thực tế, không phải lời hứa giảm HTTP trên mọi route. Test cache chứng minh quay lại cùng key trong 10 giây không gọi getter thêm; test 50 mục chứng minh giảm số multicall như mô tả.

### Kiểm tra lệnh

```text
pnpm tsc --noEmit: PASS (exit 0)
pnpm test: PASS — 39 files passed, 2 skipped; 360 tests passed, 13 skipped
ANALYZE_BUNDLE=1 pnpm build: PASS (exit 0), Next.js 16.4.0, webpack
Existing warning: ox/tempo dynamic dependency on the server verification signer import graph.
curl HTTP localhost:3000/robots.txt: 200
curl HTTP localhost:3000/sitemap.xml: 200
Production localhost:3100 head audit: 8 routes, no duplicate selected SEO tags; English and Vietnamese locale checks passed.
API X-Robots-Tag: noindex, nofollow
OG PNG: 1200x630
```

13 test integration bị bỏ qua theo cấu hình sẵn có (12 email/OTP và 1 RPC), không được coi là đã chạy kết nối dịch vụ thật. Build có cảnh báo ox/tempo có sẵn trên graph server; không có lỗi build. Không sửa Solidity nên không chạy lại forge cho tác vụ frontend/SEO này.

### Curl/head rút gọn

```text
GET http://localhost:3000/robots.txt  → 200
GET http://localhost:3000/sitemap.xml → 200
```

Lần khởi động dev riêng bị `EADDRINUSE` vì port 3000 sau đó đã được một server khác sử dụng. Không dừng server đó; curl lại hai endpoint trên server hiện có thành công.

```text
User-Agent: *
Allow: /
Allow: /rounds
Allow: /verify
Disallow: /api/
Disallow: /admin
Disallow: /my
Disallow: /register
Disallow: /dev/

Sitemap: https://sqrt-fund.vercel.app/sitemap.xml
```

Sitemap thực tế có đúng ba URL:

```text
https://sqrt-fund.vercel.app/
https://sqrt-fund.vercel.app/rounds
https://sqrt-fund.vercel.app/verify
```

Head production (trích các trường cần thiết):

| Route | Title | Robots |
| --- | --- | --- |
| `/` | Quadratic funding for students \| SqrtFund | index, follow |
| `/rounds` | Explore funding rounds \| SqrtFund | index, follow |
| `/round` | Funding round overview \| SqrtFund | index, follow |
| `/round/0x1111111111111111111111111111111111111111` | Funding round \| SqrtFund | index, follow |
| `/verify` | Verify your student identity \| SqrtFund | index, follow |
| `/admin` | Administration \| SqrtFund | noindex, nofollow |
| `/my` | My activity \| SqrtFund | noindex, nofollow |
| `/register` | Register a project \| SqrtFund | noindex, nofollow |

Tất cả head kiểm tra có canonical, OG image 1200×630, `summary_large_image`, không trùng những thẻ được audit. Mẫu cookie `vi` có `lang=vi`, title `Xác thực danh tính sinh viên | SqrtFund`; mặc định là `lang=en`. Không dùng HTTPS ở localhost vì server không cấu hình TLS.

### Kiểm tra bằng trình duyệt

Đã mở `/rounds` và bấm menu Round: URL sang `/round`, title cập nhật và bảng round đã finalize hiển thị 1 round, 2 dự án, 6 supporter, 16 USDC direct. Đây là smoke test điều hướng/dữ liệu, không phải phép đo độ trễ click hoặc giao dịch. Ảnh chụp [navigation-after.png](evidence/2026-10-18/performance-seo/navigation-after.png). Ảnh chia sẻ thực tế [opengraph-image.png](evidence/2026-10-18/performance-seo/opengraph-image.png).

### Evidence

[Bộ file đo đã lọc dữ liệu cấu hình](evidence/2026-10-18/performance-seo/): JS trước/sau, Lighthouse trước/sau, head, robots/sitemap, checks và ảnh. Không chép trace/log HTTP thô vào Git.

### File thay đổi trong tác vụ hiệu năng/SEO

- `README.md`
- `__tests__/performance-policy.test.ts`
- `__tests__/rpc-transport.test.ts`
- `__tests__/seo.test.ts`
- `docs/PERFORMANCE_SEO.md`
- `docs/evidence/2026-10-18/performance-seo/checks.txt`
- `docs/evidence/2026-10-18/performance-seo/javascript-after.json`
- `docs/evidence/2026-10-18/performance-seo/javascript-before.json`
- `docs/evidence/2026-10-18/performance-seo/lighthouse-after.json`
- `docs/evidence/2026-10-18/performance-seo/lighthouse-before.json`
- `docs/evidence/2026-10-18/performance-seo/navigation-after.png`
- `docs/evidence/2026-10-18/performance-seo/opengraph-image.png`
- `docs/evidence/2026-10-18/performance-seo/robots-dev.txt`
- `docs/evidence/2026-10-18/performance-seo/robots.txt`
- `docs/evidence/2026-10-18/performance-seo/seo-head.jsonl`
- `docs/evidence/2026-10-18/performance-seo/sitemap-dev.xml`
- `docs/evidence/2026-10-18/performance-seo/sitemap.xml`
- `next.config.ts`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/audit-routes.mjs`
- `scripts/bundle-stats.mjs`
- `scripts/check-seo.mjs`
- `scripts/measure-routes.mjs`
- `src/app/admin/loading.tsx`
- `src/app/admin/page.tsx`
- `src/app/dev/layout.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/app/loading.tsx`
- `src/app/my/loading.tsx`
- `src/app/my/page.tsx`
- `src/app/opengraph-image.tsx`
- `src/app/page.tsx`
- `src/app/providers.tsx`
- `src/app/register/loading.tsx`
- `src/app/register/page.tsx`
- `src/app/robots.ts`
- `src/app/round/[id]/loading.tsx`
- `src/app/round/[id]/page.tsx`
- `src/app/round/[id]/project/[projectId]/page.tsx`
- `src/app/round/loading.tsx`
- `src/app/round/page.tsx`
- `src/app/rounds/loading.tsx`
- `src/app/rounds/page.tsx`
- `src/app/sitemap.ts`
- `src/app/twitter-image.tsx`
- `src/app/verify/loading.tsx`
- `src/app/verify/page.tsx`
- `src/components/background/DeferredLattice.tsx`
- `src/components/common/AOSInit.tsx`
- `src/components/common/RouteLoading.tsx`
- `src/components/home/DeferredAeroShards.tsx`
- `src/components/home/HowItWorksTimeline.tsx`
- `src/components/layout/ConnectWalletButton.tsx`
- `src/components/layout/Footer.tsx`
- `src/components/layout/NavLink.tsx`
- `src/components/layout/Navbar.tsx`
- `src/components/layout/NavigationProgress.tsx`
- `src/components/layout/SplashIntro.tsx`
- `src/components/project/DonateBox.tsx`
- `src/components/verify/DeferredStudentVerifyBox.tsx`
- `src/hooks/useAdminRounds.ts`
- `src/hooks/useClaim.ts`
- `src/hooks/useIdleVisual.ts`
- `src/hooks/useNotificationCounts.ts`
- `src/hooks/useProjects.ts`
- `src/hooks/useRole.ts`
- `src/hooks/useRound.ts`
- `src/lib/navigationProgress.ts`
- `src/lib/queryPolicy.ts`
- `src/lib/seo.server.ts`
- `src/lib/seo.ts`
- `src/lib/socialImage.tsx`
- `src/lib/tokenBalance.ts`
- `src/lib/wagmi.ts`
- `src/views/admin.tsx`
- `src/views/home.tsx`
- `src/views/my.tsx`
- `src/views/round-detail.tsx`
- `src/views/verify.tsx`
