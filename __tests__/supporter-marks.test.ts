import { describe, expect, it } from "vitest";
import { copy, fmt } from "../src/lib/copy";

describe("supporter marks and qf lesson copy and logic", () => {
  it("uses 1:1 scale for supporter count <= 25 and 1:5 with Math.ceil for > 25", () => {
    const calcMarks = (count: number, propScale?: number, maxMarks = 36) => {
      const scale = propScale ?? (count <= 25 ? 1 : 5);
      return {
        scale,
        markCount: Math.max(0, Math.min(maxMarks, Math.ceil(count / scale))),
      };
    };

    // <= 25 test cases
    expect(calcMarks(0)).toEqual({ scale: 1, markCount: 0 });
    expect(calcMarks(1)).toEqual({ scale: 1, markCount: 1 });
    expect(calcMarks(4)).toEqual({ scale: 1, markCount: 4 });
    expect(calcMarks(25)).toEqual({ scale: 1, markCount: 25 });

    // > 25 test cases
    expect(calcMarks(26)).toEqual({ scale: 5, markCount: 6 });
    expect(calcMarks(30)).toEqual({ scale: 5, markCount: 6 });
    expect(calcMarks(31)).toEqual({ scale: 5, markCount: 7 });

    // Explicit scale overrides default
    expect(calcMarks(4, 5)).toEqual({ scale: 5, markCount: 1 });
    expect(calcMarks(30, 10)).toEqual({ scale: 10, markCount: 3 });
  });

  it("formats Vietnamese marks labels using 'ô' instead of 'điểm'", () => {
    const vi = copy.vi;

    // Singular note for scale = 1
    expect(vi.projectCard.oneMarkNoteOne).toBe("1 ô = 1 người ủng hộ");
    expect(vi.competition.marksNoteOne).toBe("1 ô = 1 người ủng hộ");

    // Dynamic note for scale = 5
    expect(fmt(vi.projectCard.oneMarkNote, { n: 5 })).toBe("1 ô = 5 người ủng hộ");
    expect(fmt(vi.competition.marksNote, { n: 5 })).toBe("1 ô = 5 người ủng hộ");

    // Plural/singular marks count uses 'ô'
    expect(fmt(vi.projectCard.marksCount, { count: 4 })).toBe("4 ô");
    expect(fmt(vi.projectCard.marksCountOne, { count: 1 })).toBe("1 ô");
    expect(fmt(vi.competition.marksCount, { count: 4 })).toBe("4 ô");
    expect(fmt(vi.competition.marksCountOne, { count: 1 })).toBe("1 ô");
  });

  it("formats English marks labels with supporter / supporters and mark / marks", () => {
    const en = copy.en;

    // Singular note for scale = 1
    expect(en.projectCard.oneMarkNoteOne).toBe("1 mark = 1 supporter");
    expect(en.competition.marksNoteOne).toBe("1 mark = 1 supporter");

    // Dynamic note for scale = 5
    expect(fmt(en.projectCard.oneMarkNote, { n: 5 })).toBe("1 mark = 5 supporters");
    expect(fmt(en.competition.marksNote, { n: 5 })).toBe("1 mark = 5 supporters");

    // Plural/singular marks count
    expect(fmt(en.projectCard.marksCount, { count: 4 })).toBe("4 marks");
    expect(fmt(en.projectCard.marksCountOne, { count: 1 })).toBe("1 mark");
    expect(fmt(en.competition.marksCount, { count: 4 })).toBe("4 marks");
    expect(fmt(en.competition.marksCountOne, { count: 1 })).toBe("1 mark");
  });

  it("contains the exact Vietnamese QF lesson explanation text and supporter tooltip", () => {
    const vi = copy.vi.projectDetail;
    const combined = `${vi.qfLessonPre}**${vi.qfLessonBold}**${vi.qfLessonPost}`;
    expect(combined).toBe(
      "Trong Quadratic Funding, **số lượng sinh viên ủng hộ** tạo ra sức nặng tài trợ lớn hơn nhiều so với số tiền góp của một cá nhân. Mỗi sinh viên đã xác minh đóng góp sẽ giúp dự án nhận được nhiều tiền đối ứng (matching fund) hơn từ quỹ chung."
    );
    expect(vi.qfSupporterTooltip).toBe(
      "Vì sao số lượng người ủng hộ quan trọng hơn số tiền: Trong Quadratic Funding, số lượng sinh viên ủng hộ tạo ra sức nặng tài trợ lớn hơn nhiều so với số tiền góp của một cá nhân. Mỗi sinh viên đã xác minh đóng góp sẽ giúp dự án nhận được nhiều tiền đối ứng (matching fund) hơn từ quỹ chung."
    );
  });

  it("contains the corresponding English QF supporter tooltip without dot/mark references", () => {
    const en = copy.en.projectDetail;
    expect(en.qfSupporterTooltip).toBe(
      "Why supporter count matters more than amount: In Quadratic Funding, the number of student contributors carries far more funding weight than the size of an individual contribution. Each verified student contribution helps the project receive more matching funds from the shared pool."
    );
  });
});
