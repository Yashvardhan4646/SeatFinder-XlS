import { describe, expect, it } from "vitest";
import {
  groupByStudent,
  normalize,
  searchEntries,
  type SeatEntry,
} from "../lib/seating";

function createEntry(overrides: Partial<SeatEntry>): SeatEntry {
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
    shiftLabel: "Shift 1",
    shiftTiming: "09.30 AM - 12.30 PM",
    ...overrides,
  };
}

describe("Course selector & filtering logic", () => {
  const dataset: SeatEntry[] = [
    createEntry({
      enrollmentNo: "24131040494",
      admissionNo: "24SCSE1040446",
      name: "Praveen",
      program: "BCA III 2024-2025",
      roomNo: "C102",
      seatNo: "1A",
    }),
    createEntry({
      enrollmentNo: "24131040076",
      admissionNo: "24SCSE1040320",
      name: "Aman Sharma",
      program: "BCA III 2024-2025",
      roomNo: "C102",
      seatNo: "1C",
    }),
    createEntry({
      enrollmentNo: "24131040999",
      admissionNo: "24SCSE1040999",
      name: "Praveen Kumar",
      program: "Btech_CSE III 2024-2025",
      roomNo: "A401",
      seatNo: "2B",
    }),
    createEntry({
      enrollmentNo: "24131040888",
      name: "Rahul Verma",
      program: "BBA II 2025-2026",
      roomNo: "B202",
      seatNo: "3A",
    }),
  ];

  it("extracts unique courses and candidate counts accurately", () => {
    const courseCounts = new Map<string, number>();
    for (const e of dataset) {
      const p = normalize(e.program);
      if (p) courseCounts.set(p, (courseCounts.get(p) || 0) + 1);
    }

    expect(courseCounts.get("BCA III 2024-2025")).toBe(2);
    expect(courseCounts.get("Btech_CSE III 2024-2025")).toBe(1);
    expect(courseCounts.get("BBA II 2025-2026")).toBe(1);
    expect(courseCounts.size).toBe(3);
  });

  it("filters search results strictly to selected course", () => {
    const selectedCourse = "BCA III 2024-2025";
    const inCourse = dataset.filter((e) => normalize(e.program) === selectedCourse);
    expect(inCourse).toHaveLength(2);

    // Searching 'Praveen' in BCA III should only return Praveen from BCA, NOT Praveen Kumar from Btech
    const matches = searchEntries("Praveen", inCourse);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.enrollmentNo).toBe("24131040494");
    expect(matches[0]!.program).toBe("BCA III 2024-2025");
  });

  it("returns no candidates if roll number belongs to another course", () => {
    const selectedCourse = "BCA III 2024-2025";
    const inCourse = dataset.filter((e) => normalize(e.program) === selectedCourse);

    // Roll number 24131040999 is in Btech_CSE, not in BCA
    const matches = searchEntries("24131040999", inCourse);
    expect(matches).toHaveLength(0);
  });

  it("returns all candidates in selected course when query is empty", () => {
    const selectedCourse = "BCA III 2024-2025";
    const inCourse = dataset.filter((e) => normalize(e.program) === selectedCourse);
    const groups = groupByStudent(inCourse);
    expect(groups).toHaveLength(2);
  });
});
