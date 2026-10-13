"use client";

import { useProjects } from "@/hooks/useProjects";

export function useMatchingEstimate() {
  const { projects, isLoading } = useProjects();
  return { projects, isLoading };
}
