import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { FeaturedFundingSections } from "@/components/home/FeaturedRounds";
import type { Project } from "@/types";

const { first, second, third } = vi.hoisted(() => ({
  first: "0x0000000000000000000000000000000000000001",
  second: "0x0000000000000000000000000000000000000002",
  third: "0x0000000000000000000000000000000000000003",
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});
vi.mock("@/hooks/useRoundSummaries", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/hooks/useRoundSummaries")>(),
  useRoundSummaries: () => ({
    summaries: [first, second, third].map((address, index) => ({
      address, index: index + 1, active: index === 0, cancelled: false,
      loaded: true, poolUsdc: 1000, projectCount: 2,
    })),
  }),
}));
vi.mock("@/hooks/useRound", () => ({
  useRound: (address: string) => ({ status: address === first ? "open" : "finalized" }),
}));
vi.mock("@/hooks/useProjects", () => ({
  useProjects: (address: string) => {
    const project = (id: string, supporterCount: number, totalDonated: number, approved = true) => ({
      id, supporterCount, totalDonated, approved,
    });
    const projects = {
      [first]: [project("1", 10, 20), project("2", 5, 25)],
      [second]: [project("1", 12, 50), project("2", 99, 999, false)],
      [third]: [project("1", 10, 40), project("2", 8, 99)],
    };
    return { projects: projects[address] };
  },
}));
vi.mock("@/components/round/RoundCard", () => ({ RoundCard: () => null }));
vi.mock("@/components/project/ProjectCard", () => ({
  ProjectCard: ({ project, roundId, canDonate }: { project: Project; roundId: string; canDonate: boolean }) =>
    createElement("a", { href: `/round/${roundId}/project/${project.id}`, "data-can-donate": canDonate }, project.rank),
}));

it("shows the three highest-ranked public projects across featured rounds", () => {
  const html = renderToStaticMarkup(createElement(FeaturedFundingSections));
  expect(html.match(/<a href="\/round\/[^" ]+\/project\/[^" ]+"[^>]*>\d<\/a>/g)).toEqual([
    `<a href="/round/${second}/project/1" data-can-donate="false">1</a>`,
    `<a href="/round/${third}/project/1" data-can-donate="false">2</a>`,
    `<a href="/round/${first}/project/1" data-can-donate="true">3</a>`,
  ]);
});
