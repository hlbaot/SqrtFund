import { notFound } from "next/navigation";
import { LeaderboardPreview } from "@/views/leaderboard-preview";

export default function LeaderboardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LeaderboardPreview />;
}
