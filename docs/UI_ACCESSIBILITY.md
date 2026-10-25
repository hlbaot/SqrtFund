# UI: phân trang round và tương phản

Ngày: 2026-10-25. Phạm vi: giao diện và kiểm thử; không đổi contract, API, quyền, tính QF, giao dịch hay store realtime. Không deploy.

## Hành vi

- `/round`: lọc theo tab → mới nhất trước → chia 6 thẻ/trang. Đổi tab về trang 1; trạng thái lỗi từng round vẫn giữ riêng.
- `?page=2`: chia sẻ/reload/quay lại; giữ query khác và hash. Đổi trang push history; đổi tab hoặc chuẩn hóa trang sai dùng replace. URL không bị ép về trang 1 khi discovery mới trả một phần dữ liệu.
- Dữ liệu realtime vẫn cập nhật toàn bộ như trước. Thêm/bớt round cập nhật lát cắt đang xem; khi trang vượt tổng, tự lùi về trang cuối sau khi đọc xong dữ liệu.
- Trước/Sau là nút HTML, khóa ở hai đầu; số trang hiện tại có `aria-current`, aria-label tiếng Việt/Anh, aria-controls và focus ring. Danh sách dài rút gọn bằng `...`; thông tin Trang X / Y và Hiển thị a-b / tổng có live status.
- Cuộn tới đầu danh sách khi trang thay đổi; `smooth` bình thường, `instant` khi prefers-reduced-motion. Loading và Suspense fallback đều có đúng 6 skeleton.
- Hai hàng × ba cột ở desktop (≥1024px); ba hàng × hai cột ở tablet (768–1023px); sáu hàng × một cột ở mobile (<768px). Khoảng cách 20px, grid stretch và CTA đáy thẻ. Trang cuối có thể ít hơn 6 thẻ.
- Danh sách duyệt project và đơn Organizer dùng chung `Pagination`, giữ 4 mục/trang và các bộ lọc hiện có.

## Thiết kế

Tokens tập trung ở `src/app/globals.css`: nền #0d0d12, thẻ #16161d, nền nổi #1e1e28, chữ #f4f4f6, phụ #c3c3cc, đỏ chữ #ff4d4f, xanh #4ade80. Viền trắng 12%; nhãn tối thiểu 12px, tracking 0.08em. Màu nút đỏ #cc3036 và hover #d3343a giữ chữ trắng ≥4.5:1; dùng màu đỏ nhấn sáng cho chữ sẽ không đạt AA với chữ trắng trên nền đỏ đó.

Các biến thể placeholder/opacity chữ được chuẩn hóa tập trung; màu hardcode của hai panel trang chủ chuyển sang tokens. Bỏ giảm opacity của container chữ trong timeline, vẫn giữ animation/decorative watermark. Lattice dịu hơn; hover/focus thẻ có viền và glow đỏ nhẹ. Portal modal, toast và form dùng cùng tokens, không thay đổi luồng nghiệp vụ.

## Đo tương phản trước/sau

Lệnh: `node scripts/check-ui-contrast.mjs` (exit 0). Script đọc tokens hiện tại trực tiếp từ CSS, dùng sRGB relative luminance và `(L_sáng + 0.05) / (L_tối + 0.05)`, composite alpha của chip/placeholder trước khi đo. Mốc trước lấy từ CSS cũ trong repo. Tất cả cặp dưới đây được kiểm tra ở ngưỡng chữ thường ≥4.5:1, nghiêm hơn ngưỡng chữ lớn ≥3:1.

| Cặp màu | Trước | Sau | AA ≥ 4.5 |
|---|---:|---:|:---:|
| Chữ chính / nền trang | 17.46:1 | 17.65:1 | Đạt |
| Chữ chính / nền thẻ | 17.12:1 | 16.39:1 | Đạt |
| Chữ chính / nền nổi | 16.46:1 | 15.03:1 | Đạt |
| Chữ phụ / nhãn / nền trang | 7.17:1 | 11.07:1 | Đạt |
| Chữ phụ / nhãn / nền thẻ | 7.03:1 | 10.28:1 | Đạt |
| Chữ phụ / nhãn / nền nổi | 6.76:1 | 9.44:1 | Đạt |
| Chữ đỏ / nền trang | 4.95:1 | 5.93:1 | Đạt |
| Chữ đỏ / nền thẻ | 4.85:1 | 5.51:1 | Đạt |
| Chữ đỏ / nền nổi | 4.67:1 | 5.05:1 | Đạt |
| Số liệu xanh / nền trang | 8.66:1 | 11.12:1 | Đạt |
| Số liệu xanh / nền thẻ | 8.50:1 | 10.33:1 | Đạt |
| Số liệu xanh / nền nổi | 8.17:1 | 9.48:1 | Đạt |
| Placeholder / thẻ (opacity 60% → 100%) | 3.22:1 | 10.28:1 | Đạt |
| Chữ trắng / nút đỏ | 3.99:1 | 5.19:1 | Đạt |
| Chữ trắng / nút đỏ hover | 3.06:1 | 4.86:1 | Đạt |
| Nhãn mở / chip đỏ 10% | 4.49:1 | 4.95:1 | Đạt |
| Nhãn / chip đỏ 20% trên nền nổi | 3.81:1 | 11.68:1 | Đạt |
| Nhãn đã chốt / chip xanh 10% | 7.45:1 | 8.56:1 | Đạt |
| Chữ / nút viền đỏ hover 22% | 14.11:1 | 13.55:1 | Đạt |

Phạm vi đo là các cặp token và trạng thái liệt kê, không phải chứng nhận tự động mọi pixel, hình ảnh, trạng thái ví hoặc tất cả trang. Chưa chụp/kiểm tra thủ công ở ba viewport trên trình duyệt; bố cục ở trên được mô tả từ breakpoint CSS và kiểm thử render. Trạng thái disabled và watermark trang trí không nằm trong bảng chữ nội dung.

## Kết quả kiểm tra

- `pnpm tsc --noEmit`: PASS, exit 0.
- `pnpm test`: PASS, 95 file pass / 2 skip; 762 test pass / 13 skip, tổng 775. Trong đó 8 test render DOM mới kiểm tra 7 round → 6 + 1, lọc và reset trang, URL vượt tổng, query/hash, discovery một phần, realtime thêm/bớt, Back, reduced motion, empty/invalid page, 6 skeleton, classes responsive và phân trang dài.
- `pnpm build`: PASS, exit 0. Còn cảnh báo webpack `Critical dependency: the request of a dependency is an expression` từ `ox/viem`; build vẫn hoàn tất các route.
- `git diff --check`: PASS.
- Lần đầu full test bị sandbox chặn localhost của realtime test; lần chạy có quyền localhost đã qua. Kiểm thử integration được skip theo điều kiện của bộ test hiện có.

## File thay đổi

- [README.md](../README.md)
- [__tests__/round-loading.test.ts](../__tests__/round-loading.test.ts)
- [docs/PERFORMANCE_SEO.md](../docs/PERFORMANCE_SEO.md)
- [package.json](../package.json)
- [pnpm-lock.yaml](../pnpm-lock.yaml)
- [src/app/globals.css](../src/app/globals.css)
- [src/components/admin/PlatformDashboard.tsx](../src/components/admin/PlatformDashboard.tsx)
- [src/components/admin/ProjectReviewList.tsx](../src/components/admin/ProjectReviewList.tsx)
- [src/components/common/RouteLoading.tsx](../src/components/common/RouteLoading.tsx)
- [src/components/home/HowItWorksTimeline.tsx](../src/components/home/HowItWorksTimeline.tsx)
- [src/components/home/NetworkStats.tsx](../src/components/home/NetworkStats.tsx)
- [src/components/rounds/RoundsList.tsx](../src/components/rounds/RoundsList.tsx)
- [src/components/ui/StatusBadge.tsx](../src/components/ui/StatusBadge.tsx)
- [src/views/home.tsx](../src/views/home.tsx)
- [src/views/rounds.tsx](../src/views/rounds.tsx)
- [__tests__/rounds-pagination.test.ts](../__tests__/rounds-pagination.test.ts)
- [scripts/check-ui-contrast.mjs](../scripts/check-ui-contrast.mjs)
- [src/components/common/Pagination.tsx](../src/components/common/Pagination.tsx)
- [src/components/rounds/pagination.ts](../src/components/rounds/pagination.ts)
- [docs/UI_ACCESSIBILITY.md](../docs/UI_ACCESSIBILITY.md)
