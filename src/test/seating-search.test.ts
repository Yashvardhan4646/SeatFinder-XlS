import { describe, expect, it } from "vitest";
import {
  groupByStudent,
  normalize,
  normalizeQuery,
  searchEntries,
  type SeatEntry,
} from "../lib/seating";

function entry(overrides: Partial<SeatEntry>): SeatEntry {
  return {
    sno: "1",
    admissionNo: "",
    enrollmentNo: "",
    name: "",
    program: "",
    sem: "",
    sec: "",
    subCode: "",
    subjectName: "",
    roomNo: "",
    seatNo: "",
    shiftIndex: 0,
    shiftLabel: "",
    shiftTiming: "",
    ...overrides,
  };
}

describe("normalize", () => {
  it("trims and collapses whitespace, handles null/numbers", () => {
    expect(normalize("  23CS   1001 ")).toBe("23CS 1001");
    expect(normalize(null)).toBe("");
    expect(normalize(42)).toBe("42");
  });

  it("normalizeQuery lowercases", () => {
    expect(normalizeQuery("  RAHUL  Sharma ")).toBe("rahul sharma");
  });
});

describe("searchEntries", () => {
  const data: SeatEntry[] = [
    entry({ enrollmentNo: "23CSE1001", name: "Rahul Sharma", admissionNo: "ADM23CSE101" }),
    entry({ enrollmentNo: "23ECE1002", name: "Rahul Verma" }),
    entry({ enrollmentNo: "24BBA1003", name: "Priya Patel", admissionNo: "ADM24BBA300" }),
  ];

  it("short queries return nothing", () => {
    expect(searchEntries("r", data)).toHaveLength(0);
    expect(searchEntries("  ", data)).toHaveLength(0);
  });

  it("prioritizes roll/admission matches over name matches", () => {
    // "rahul" matches two names, but "1001" only matches one roll number
    const byRoll = searchEntries("1001", data);
    expect(byRoll).toHaveLength(1);
    expect(byRoll[0]!.name).toBe("Rahul Sharma");

    const byAdmission = searchEntries("adm23cse101", data);
    expect(byAdmission).toHaveLength(1);
    expect(byAdmission[0]!.name).toBe("Rahul Sharma");
  });

  it("matches partial roll numbers case-insensitively", () => {
    expect(searchEntries("23cse", data).map((e) => e.enrollmentNo)).toEqual([
      "23CSE1001",
    ]);
  });

  it("falls back to substring name matching", () => {
    const matches = searchEntries("rahul", data);
    expect(matches).toHaveLength(2);
  });
});

describe("groupByStudent", () => {
  it("buckets multi-shift entries under one student", () => {
    const g = groupByStudent([
      entry({ admissionNo: "ADM1", name: "A", shiftIndex: 1 }),
      entry({ admissionNo: "ADM1", name: "A", shiftIndex: 0 }),
      entry({ admissionNo: "ADM2", name: "B", shiftIndex: 0 }),
    ]);
    expect(g).toHaveLength(2);
    const a = g.find((x) => x.key === "ADM1")!;
    expect(a.entries).toHaveLength(2);
    expect(a.entries[0]!.shiftIndex).toBe(0); // sorted by shift
  });

  it("separates same-name students with different roll numbers", () => {
    const g = groupByStudent([
      entry({ enrollmentNo: "R1", name: "Same Name" }),
      entry({ enrollmentNo: "R2", name: "Same Name" }),
    ]);
    expect(g).toHaveLength(2);
  });
});
