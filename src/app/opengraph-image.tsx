import { createSocialImage, socialImageSize } from "@/lib/socialImage";
export const alt = "N-Power — Quadratic Funding cho quỹ hoạt động sinh viên";
export const size = socialImageSize;
export const contentType = "image/png";
export default function Image() { return createSocialImage(); }
