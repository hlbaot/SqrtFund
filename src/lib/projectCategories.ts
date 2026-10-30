export const CATEGORY_IDS = ["technology", "education", "community", "environment", "arts"] as const;
export type FundingCategory = typeof CATEGORY_IDS[number];
export const CATEGORY_LABELS = {
  vi: { technology: "Công nghệ và nghiên cứu", education: "Giáo dục và học thuật", community: "Cộng đồng và thiện nguyện", environment: "Môi trường và phát triển bền vững", arts: "Văn hóa và nghệ thuật", uncategorized: "Chưa phân loại" },
  en: { technology: "Technology and research", education: "Education and learning", community: "Community and charity", environment: "Environment and sustainability", arts: "Culture and arts", uncategorized: "Uncategorized" },
};
export const CATEGORY_GUIDANCE = {
  vi: {
    technology: "Ví dụ: phần mềm, robot, nghiên cứu ứng dụng. Chuẩn bị sản phẩm mẫu hoặc thiết kế, mốc thử nghiệm và cách đánh giá tính khả thi kỹ thuật.",
    education: "Ví dụ: workshop, tài liệu học tập, hỗ trợ học sinh. Nêu đối tượng học, nội dung, số người tham gia dự kiến và cách đo kết quả học tập.",
    community: "Ví dụ: hoạt động tình nguyện, hỗ trợ hoàn cảnh khó khăn. Nêu người hưởng lợi, cách thực hiện, chi phí và minh chứng hỗ trợ; tránh công khai thông tin cá nhân nhạy cảm.",
    environment: "Ví dụ: tái chế, giảm rác, tiết kiệm năng lượng. Nêu kết quả có thể đo lường, cách theo dõi và thời gian đánh giá tác động.",
    arts: "Ví dụ: triển lãm, âm nhạc, bảo tồn văn hóa. Nêu sản phẩm/sự kiện, công chúng hướng đến, kế hoạch thực hiện và quyền sử dụng nội dung.",
  },
  en: {
    technology: "Examples: software, robotics and applied research. Provide a prototype or design, testing milestones and evidence of technical feasibility.",
    education: "Examples: workshops, learning resources and student support. Identify learners, content, expected participation and learning outcomes.",
    community: "Examples: volunteering and charitable support. Identify beneficiaries, delivery, costs and supporting evidence; avoid exposing sensitive personal information.",
    environment: "Examples: recycling, waste reduction and energy savings. Define measurable outcomes, tracking methods and an impact assessment timeline.",
    arts: "Examples: exhibitions, music and cultural preservation. Describe the work/event, audience, delivery plan and content rights.",
  },
};
export function isFundingCategory(value: unknown): value is FundingCategory {
  return typeof value === "string" && CATEGORY_IDS.includes(value as FundingCategory);
}
export function parseAllowedCategories(value: unknown): FundingCategory[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > CATEGORY_IDS.length || !value.every(isFundingCategory) || new Set(value).size !== value.length) throw Error("INVALID_GOVERNANCE");
  return value;
}
