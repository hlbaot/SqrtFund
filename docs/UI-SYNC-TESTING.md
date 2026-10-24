# Kiểm chứng đồng bộ giao diện

## Phạm vi đã chạy

- `pnpm tsc --noEmit`: đạt, không có lỗi TypeScript.
- `pnpm test`: 94 file đạt, 2 file bỏ qua; 754 test đạt, 13 test bỏ qua.
- `pnpm build`: lần chạy lại thoát mã 0, tạo 18 trang tĩnh. Lần đầu đã biên dịch nhưng bị chặn bởi `SecurityFatalError` cảnh báo phiên bản Next.js 16.4.0; chưa nâng Next.js trong thay đổi này.
- Vitest mới kiểm tra upsert/patch/remove/rollback, cách ly round/ví, ghi đè dữ liệu cũ, sự kiện receipt, quyền Organizer, thứ tự receipt → patch → xác nhận, phí gas thật và lỗi đọc xác nhận.
- Chưa chạy các tình huống hai trình duyệt/giao dịch ví thật dưới đây. Không sửa contract, không deploy; không cập nhật đánh giá UI/UX trong `docs/EVALUATION.md`.

## Chuẩn bị thử thủ công

Mở cùng ứng dụng bằng hai trình duyệt hoặc hai profile độc lập, cả hai tab ở trạng thái hiển thị. Dùng Fuji và cấu hình ứng dụng hiện có. Trình duyệt A dùng ví Admin nền tảng hoặc Organizer sở hữu round; B dùng ví Student đã xác minh, là chủ project. Khi thử donate/refund, đổi B sang ví Student C khác chủ project. Chuẩn bị AVAX gas và MockUSDC theo quy trình hiện có. Không cần reload trong bất kỳ bước nào.

Cập nhật ở trình duyệt thực hiện giao dịch xuất hiện ngay sau receipt; dữ liệu được đọc lại tại block receipt để xác nhận. Trình duyệt còn lại đồng bộ qua tín hiệu realtime (nếu dịch vụ đang chạy) và polling 5 giây khi tab hiển thị; thời gian thực tế còn phụ thuộc RPC/API.

## Năm tình huống

| Tình huống | Thao tác | Kết quả cần quan sát |
| --- | --- | --- |
| 1. Tạo round | A nạp quỹ theo luồng hiện có rồi tạo round với tên riêng dễ nhận biết. | Sau receipt, round có ngay ở **Vòng gọi vốn** và dropdown chọn round trên A. B nhìn thấy round trong lần đồng bộ tiếp theo. |
| 2. Đăng ký project | B đăng ký project vào round do A quản lý, có thể chọn round cũ hơn round mới nhất. | Sau receipt, B thấy project **chờ duyệt** ở **Hoạt động của tôi** đúng round. A thấy project trong danh sách chờ duyệt khi đồng bộ. |
| 3. Duyệt/từ chối project | A duyệt một project đang chờ; dùng project chờ khác để thử từ chối. | A đổi trạng thái ngay sau receipt; B và trang round đổi trạng thái khi đồng bộ. Project đã duyệt xuất hiện ở danh sách công khai; project bị từ chối không xuất hiện ở danh sách được duyệt. Phải dùng admin của chính round đó. |
| 4. Organizer | A dùng ví Admin nền tảng; B nộp đơn Organizer. A lần lượt thử duyệt, thu hồi với lý do; dùng đơn phù hợp khác để thử từ chối. Hoàn tất cả giao dịch quyền và bước lưu quyết định API theo giao diện. | A thấy trạng thái đơn cập nhật; B đổi trạng thái đơn, quyền và menu trong lần đồng bộ tiếp theo. Kiểm tra quyền tạo round thực tế theo contract. Thu hồi quyền Organizer không tự xóa quyền admin của các round đã tạo. |
| 5. Tiền và trạng thái round | Round R1: ví C donate cho project của B; sau hạn, admin finalize rồi B claim. Round R2: C donate, admin hủy trước finalize, C refund. | Tổng góp, số người góp, matching/payout, cờ finalized/canceled/claimed và số liệu hoàn tiền cập nhật sau receipt; trình duyệt kia đồng bộ theo polling/realtime. Toast có link Snowtrace đúng hash và phí AVAX tính bằng `gasUsed × effectiveGasPrice`. |

Khi thử mục 5, không donate cho project của chính ví đang kết nối; không hủy round đã finalize. Với khoản donate lặp lại từ cùng một ví, số người góp không tăng thêm. Claim ở **Hoạt động của tôi** phải gửi đến round của project được chọn, kể cả project thuộc round cũ.

## Tab ẩn và lỗi xác nhận

- Chuyển tab B sang ẩn, chờ request đang chạy hoàn tất rồi quan sát Network: polling định kỳ dừng. Trở lại tab B: dữ liệu được đọc lại và bắt kịp.
- Tín hiệu socket chỉ yêu cầu đọc lại; không dùng dữ liệu socket để cấp quyền. Polling vẫn hoạt động nếu dịch vụ realtime không có kết nối.
- Trong môi trường thử nghiệm, mô phỏng lỗi RPC sau receipt: patch giao diện phải hoàn tác, toast báo giao dịch đã xác nhận nhưng đồng bộ đang chờ. Không gửi lại giao dịch chỉ vì lỗi đọc; cho phép polling đọc lại sau khi RPC phục hồi.
- Store chỉ nằm trong bộ nhớ, không đọc localStorage ở render đầu. Contract/API là nguồn xác nhận. Polling đọc các round để cập nhật project nên tải RPC tăng theo số round.

## File thuộc thay đổi này

`src/views/home.tsx` có thay đổi riêng trong workspace, không thuộc phần triển khai đồng bộ này.

- `README.md`
- `__tests__/receipt-store-sync.test.ts`
- `__tests__/round-controls.test.ts`
- `__tests__/tx-action.test.ts`
- `__tests__/ui-stores.test.ts`
- `__tests__/use-tx-action.test.ts`
- `docs/UI-SYNC-TESTING.md`
- `package.json`
- `pnpm-lock.yaml`
- `src/components/admin/CreateRoundForm.tsx`
- `src/components/common/RealtimeNotifications.tsx`
- `src/components/organizer/ApplyOrganizerModal.tsx`
- `src/components/project/ProjectForm.tsx`
- `src/hooks/useAdminRounds.ts`
- `src/hooks/useClaim.ts`
- `src/hooks/useOrganizerApplications.ts`
- `src/hooks/useProjects.ts`
- `src/hooks/useRegistrationRounds.ts`
- `src/hooks/useRole.ts`
- `src/hooks/useRound.ts`
- `src/hooks/useTxAction.ts`
- `src/hooks/useTxFlow.ts`
- `src/hooks/useUiStoreSync.ts`
- `src/hooks/useVisiblePolling.ts`
- `src/lib/realtime.ts`
- `src/lib/store/chainSync.ts`
- `src/lib/store/index.ts`
- `src/lib/store/mirror.ts`
- `src/lib/store/organizerStore.ts`
- `src/lib/store/projectsStore.ts`
- `src/lib/store/roundsStore.ts`
- `src/lib/txAction.ts`
- `src/lib/txToast.ts`
- `src/views/my.tsx`
- `src/views/rounds.tsx`
