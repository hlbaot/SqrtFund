import type { ProjectReviewStatus } from "@/components/ui/StatusBadge";
import type { ModerationRound } from "./projectModeration";
import type { ProjectModeration } from "./projectVisibility";

export type ReviewFilter = "all" | ProjectReviewStatus;
export function projectReviewStatus(project: ProjectModeration, round: Pick<ModerationRound, "endTime">, now: number): ProjectReviewStatus {
  if (project.rejected) return "rejected";
  if (project.approved) return "approved";
  if (round.endTime !== undefined && now > 0 && BigInt(now) >= round.endTime) return "expired";
  return "pending";
}
export function filterReviewProjects<T extends ProjectModeration & { name: string }>(projects: T[], query: string, filter: ReviewFilter, round: Pick<ModerationRound, "endTime">, now: number): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  return projects.filter(project => (filter === "all" || projectReviewStatus(project, round, now) === filter)
    && (!normalized || project.name.toLocaleLowerCase().includes(normalized) || project.ownerAddress.toLowerCase().includes(normalized)));
}

export const projectReviewCopy = {
  vi: {
    search: "Tìm theo tên dự án hoặc địa chỉ ví", filter: "Lọc trạng thái", all: "Tất cả", pending: "Chờ duyệt", approved: "Đã duyệt", rejected: "Đã từ chối", expired: "Hết hạn",
    pendingBadge: "Chờ xét duyệt", expiredBadge: "Không được duyệt (hết hạn)", approvedBadge: "Đã duyệt", rejectedBadge: "Đã từ chối",
    ended: "Round đã kết thúc", endedDetail: "Dự án này chưa được duyệt nên không nhận donate và không tham gia chia matching.",
    count: "Hiển thị {shown} / {total} dự án", empty: "Không có dự án chờ duyệt", noResults: "Không tìm thấy dự án phù hợp", loading: "Đang tải danh sách dự án…", readError: "Không tải được danh sách dự án. Vui lòng thử lại.", retry: "Thử lại",
    expand: "Xem chi tiết", collapse: "Thu gọn", registered: "Thời gian đăng ký", list: "Danh sách xét duyệt dự án", copied: "Đã sao chép địa chỉ", copyFailed: "Không sao chép được. Vui lòng sao chép địa chỉ trong chi tiết.",
  },
  en: {
    search: "Search project name or wallet address", filter: "Filter by status", all: "All", pending: "Pending", approved: "Approved", rejected: "Rejected", expired: "Expired",
    pendingBadge: "Pending review", expiredBadge: "Not approved (expired)", approvedBadge: "Approved", rejectedBadge: "Rejected",
    ended: "Round has ended", endedDetail: "This project was not approved, so it cannot receive donations or participate in matching allocation.",
    count: "Showing {shown} / {total} projects", empty: "No projects awaiting approval", noResults: "No matching projects found", loading: "Loading projects…", readError: "Could not load projects. Please try again.", retry: "Retry",
    expand: "View details", collapse: "Collapse", registered: "Registration time", list: "Project review list", copied: "Address copied", copyFailed: "Could not copy. Please copy the address from the details.",
  },
};
