import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectCard } from "@/components/project/ProjectCard";
import type { Project } from "@/types";

let mockDonationAmount = 0n;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", isConnected: true }),
  useReadContract: () => ({ data: mockDonationAmount }),
}));

vi.mock("@/lib/context/locale", async () => {
  const { copy } = await import("@/lib/copy");
  return { useLocale: () => ({ t: copy.vi, locale: "vi" }) };
});

const sampleProject: Project = {
  id: "1",
  roundId: "0x0000000000000000000000000000000000000001",
  name: "EcoTracker",
  nameVi: "EcoTracker VI",
  shortDescription: "Track environmental impact",
  shortDescriptionVi: "Theo dõi tác động môi trường",
  description: "Full description",
  category: "environment",
  contactUrl: "https://example.com",
  status: "approved",
  supporterCount: 15,
  totalDonated: 50,
  estimatedMatching: 120,
  ownerAddress: "0x1234567890123456789012345678901234567890",
};

describe("ProjectCard", () => {
  it("renders both View Details and Donate buttons when donatable", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectCard, {
        project: sampleProject,
        roundId: "0x1111111111111111111111111111111111111111",
        canDonate: true,
      })
    );

    expect(html).toContain("Chi tiết");
    expect(html).toContain("Ủng hộ");
    expect(html).toContain('href="/round/0x1111111111111111111111111111111111111111/project/1"');
  });

  it("omits Donate button when canDonate is false", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectCard, {
        project: sampleProject,
        roundId: "0x1111111111111111111111111111111111111111",
        canDonate: false,
      })
    );

    expect(html).toContain("Chi tiết");
    expect(html).not.toContain("Ủng hộ");
  });

  it("omits Donate button when project status is pending", () => {
    const html = renderToStaticMarkup(
      createElement(ProjectCard, {
        project: { ...sampleProject, status: "pending" },
        roundId: "0x1111111111111111111111111111111111111111",
      })
    );

    expect(html).toContain("Chi tiết");
    expect(html).not.toContain("Ủng hộ");
  });

  it("offers another donation alongside the already supported badge", () => {
    mockDonationAmount = 1000000n;
    const html = renderToStaticMarkup(
      createElement(ProjectCard, {
        project: sampleProject,
        roundId: "0x1111111111111111111111111111111111111111",
        canDonate: true,
      })
    );

    expect(html).toContain("Chi tiết");
    expect(html).toContain("Ủng hộ thêm");
    expect(html).toContain("Đã ủng hộ");
    mockDonationAmount = 0n;
  });
});
