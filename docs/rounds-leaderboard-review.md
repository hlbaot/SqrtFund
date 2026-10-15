# Rounds và leaderboard — báo cáo triển khai

Header có Home (`/`) và Round (`/round`) riêng. Giữ nguyên landing page `/`, alias danh sách `/rounds` và các URL chi tiết vòng/dự án. Giao diện dùng Container rộng và các token màu hiện có; không thêm dependency, thay đổi hook, sửa contract, chạy deploy/broadcast hay đọc nội dung `.env*`.

## Kết quả

- Danh sách vòng: bộ lọc kèm số lượng, mới nhất trước, lưới 1/2/3 cột, thời gian GMT+7, trạng thái có chữ và ký hiệu, nút copy, quỹ đối ứng, các chỉ số nhỏ và CTA thẳng hàng. Chỉ vòng đang hoạt động có viền gradient.
- Chi tiết vòng: breadcrumb, bộ chuyển vòng với trạng thái, thống kê chia bằng hairline, tooltip hỗ trợ Enter/Escape/chạm, nhãn ước tính hoặc kết quả cuối.
- Podium desktop theo bố cục 2–1–3, nhưng DOM đọc theo thứ tự hạng. Một hoặc hai dự án được căn giữa, không có ô trống. Hạng nhất có viền gradient.
- Bảng desktop có header sticky và scrollbar đỏ trong khung cuộn riêng; mobile dùng thẻ. Tên dài có tooltip, số định dạng theo locale với tối đa sáu chữ số thập phân. Các thẻ số tiền nhỏ trên danh sách vòng dùng hai chữ số thập phân, tooltip chứa giá trị đầy đủ.
- Hạng dựa trên số người ủng hộ, hỗ trợ đồng hạng kiểu `=2`. Sort tiền trực tiếp/đối ứng chỉ thay đổi thứ tự hiển thị. Thanh tỷ lệ luôn đi kèm giá trị bằng chữ.
- Đánh dấu dự án của ví hiện tại; nhãn “Bạn đã ủng hộ” chỉ hiển thị khi props có dữ liệu đó.
- Có skeleton, empty, error/Retry, tìm kiếm không có kết quả, và dự án chưa có người ủng hộ. Các số không được làm mờ và không có bar khi bằng không.
- Count-up/bar khoảng 300ms, đổi hạng fade, đổi số liệu sau refetch highlight ngắn; có kiểm tra `prefers-reduced-motion`, không thêm animation lặp liên tục.

## File tạo mới

- `src/app/round/page.tsx`
- `src/app/rounds/page.tsx`
- `src/views/rounds.tsx`
- `src/components/rounds/RoundsList.tsx`
- `src/components/leaderboard/model.ts`
- `src/components/leaderboard/Primitives.tsx`
- `src/components/leaderboard/ProjectMetrics.tsx`
- `src/components/leaderboard/Podium.tsx`
- `src/components/leaderboard/Leaderboard.tsx`
- `src/components/leaderboard/RoundHeader.tsx`
- `src/app/dev/leaderboard-preview/page.tsx`
- `src/views/leaderboard-preview.tsx`
- `__tests__/leaderboard-presentation.test.ts`
- `docs/rounds-leaderboard-review.md`

## File chỉnh sửa trong yêu cầu này

- `src/views/round-detail.tsx`: thay grid dự án bằng header/podium/leaderboard và adapter qua hook hiện có.
- `src/components/layout/Navbar.tsx`, `NavLink.tsx`, `src/lib/navigation.ts`: dẫn Home đến `/` và Round đến `/round`, giữ trạng thái chọn ở trang chi tiết và alias `/rounds`. Menu thu gọn dưới 1280px để đủ chỗ khi có thêm mục Admin.
- `__tests__/navigation.test.ts`: kiểm tra Home, Round, alias và đường dẫn chi tiết không chọn sai mục.
- `src/components/project/SupporterMarks.tsx`: thêm cách hiển thị chỉ các dấu vuông, scale thích ứng và nhãn EN/VI.
- `src/components/round/CountdownTimer.tsx`: dịch các đơn vị thời gian và định dạng số theo locale.
- `src/lib/copy.ts`: thêm nhóm `competition`, đủ khóa EN/VI.
- `src/app/globals.css`: kiểu trình bày, focus, bar, highlight, scrollbar đỏ trong bảng; giữ nguyên viền rainbow của header khi chuyển giữa các trang.

Không xóa file. Các thay đổi đã có sẵn trong working tree (bao gồm `contracts/`, form admin, README và các file khác) được giữ nguyên.

## Giả định và giới hạn dữ liệu

Repo chưa có `ranking.ts`, `useRounds()` và `useRoundLeaderboard()`. Các component mới nhận typed props, không đọc contract. Adapter dùng `useRound`, `useProjects`, `useRole`, `useAccount` hiện có; không thêm contract function call hay thay đổi quyền.

Số vòng và thứ tự mới nhất dựa trên thứ tự `allRounds` từ factory, giống cách code hiện tại chọn vòng mới nhất. Các lần đọc giữa component dùng chung query cache hiện có.

`useProjects` hiện chỉ trả tối đa 50 dự án và chỉ có matching ước tính, chưa có payout đã chốt hay lịch sử đóng góp của ví. Vì vậy:

- UI thật không coi matching ước tính là payout cuối. Ở vòng đã chốt, Matching và Total hiển thị “—” kèm giải thích cho đến khi nguồn dữ liệu cung cấp `finalMatching`.
- Không thêm nhãn “Bạn đã ủng hộ” trên dữ liệu thật khi chưa có dữ liệu xác nhận.
- Xếp hạng và tổng hợp chỉ phản ánh những dự án đã tải qua hook hiện có. Chưa xác minh các vòng có hơn 50 dự án; phần đó cần data work ngoài phạm vi thiết kế này.

Preview có fixtures riêng, không dùng ở trang thật. Production gọi `notFound()`; metadata build của `/dev/leaderboard-preview` ghi HTTP 404 và HTML có `noindex`.

## Kiểm tra

- `pnpm lint`: qua, không warning.
- `pnpm exec tsc --noEmit`: qua.
- `pnpm test`: 80 test qua (13 file), gồm 5 test mới cho đồng hạng, giữ nguyên hạng khi sort, payout chưa có dữ liệu, số và GMT+7.
- `pnpm build`: qua.
- Đã rà DOM/accessibility và đo bounds cho 10 trạng thái × 6 chiều rộng × 2 ngôn ngữ = 120 trường hợp: 375, 768, 1024, 1280, 1536, 1920px. Không có page overflow hoặc control/card vượt cạnh trang. Table có overflow nội bộ ở chiều rộng cần thiết.
- 10 trạng thái: nhiều dự án, không dự án, một dự án, hai dự án, đồng hạng, finalized, loading, error, upcoming, không có vòng.
- Đã kiểm tra bộ lọc Active, Retry, tìm kiếm/clear, empty dành cho admin, sort giữ nguyên hạng, tooltip Enter/Escape/chạm và tooltip nằm gọn ở 375px.
- Đã mở `/rounds` với dữ liệu thật và đi đến trang chi tiết vòng hiện có; không ghi nhận console error trong luồng này.
- Tương phản token trên nền surface: primary 4.85:1, money 8.50:1, muted 7.03:1, text 17.12:1. Đây là phép tính cho các token chính, không phải chứng nhận audit WCAG toàn site.
- Chưa kiểm tra screen reader thật, bật/tắt reduced motion ở cấp hệ điều hành, ví thật, refetch với giao dịch mới hoặc payout đã chốt ngoài fixtures. Không thực hiện giao dịch blockchain.

Ảnh review và kết quả đo được lưu ở `/private/tmp/sqrt-fund-review/`:

- `desktop-1280-en.png`
- `table-1280-en.png`
- `mobile-375-vi.png`
- `layout-checks.json`
