import type { Project } from "@/types";
/** Undefined nghĩa là chưa đọc, không tự bịa số 0 sau khi settle. */
export function projectFunding(
  project: Pick<
    Project,
    | "totalDonated"
    | "estimatedMatching"
    | "finalMatching"
    | "status"
    | "matchingUnavailable"
  >,
  finalized = false,
  cancelled = false,
) {
  const matching = cancelled
    ? 0
    : finalized
      ? project.finalMatching
      : project.status === "approved"
        ? project.matchingUnavailable
          ? undefined
          : project.estimatedMatching
        : 0;
  return {
    direct: project.totalDonated,
    matching,
    total: matching === undefined ? undefined : project.totalDonated + matching,
  };
}
